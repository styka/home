-- Raport implementacyjny z sesji „magiczna ikona → asystent-czat".
-- Seed jako system-report (authorId NULL → widoczny dla wszystkich), idempotentny.
INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-03',
  'omnia-implementacja-2026-06-03',
  $report$# Omnia — Raport implementacji 2026-06-03

## Magiczna ikona AI → profesjonalny asystent-czat

**Diagnoza:** „Magiczna ikona" była dotąd arkuszem sterowanym fazami (jedno polecenie → jedna odpowiedź, brak trwałej historii). Agent czytał tylko 5 modułów (zadania, zakupy, notatki, zwierzęta, magazyn), nie miał dostępu do internetu, a wyniki analityczne pokazywał jako jednorazowy markdown bez możliwości zachowania. Wymaganie właściciela: prawdziwy asystent-czat z dostępem do **wszystkich** danych użytkownika (odczyt + tworzenie/modyfikacja/usuwanie z zabezpieczeniem), z dostępem do internetu, swobodnym dialogiem, prezentacją wyników w markdown z linkami oraz możliwością zapisania wyniku lub całej sesji jako raport.

**Rozwiązanie:** Przebudowano funkcję na pełny interfejs czatu z trwałą pamięcią i rozszerzono backend agenta, zachowując dotychczasową bramkę akceptacji akcji (`ActionDrawer`) i zasadę opt-in dla operacji destrukcyjnych — bezpieczeństwo nie zostało rozluźnione. Świadome decyzje projektowe:

- **Trwała pamięć w bazie** (`AiConversation` + `AiMessage`, per-user) zamiast stanu ulotnego — pozwala wracać do rozmów i robić „raport z naszej sesji". Do modelu LLM wysyłamy jednak tylko przycięte okno ostatnich tur (higiena kontekstu), a nie cały transkrypt — chroni to przed przepełnieniem okna tokenów.
- **Odczyt całości** zrealizowano przez dołożenie read-tools do istniejącego, model-agnostycznego protokołu JSON agenta (a nie przez przepisywanie pętli), więc działa też na Groq bez natywnego tool-callingu.
- **Zapis we wszystkich modułach** mapuje typy akcji na **istniejące Server Actions** (bez duplikowania logiki DB ani dostępu) — każda akcja przechodzi przez `assert*Access`, więc id z klienta jest weryfikowane po stronie serwera.
- **Internet** podpięto reużywając gotowego klienta wyszukiwarki z modułu Wiadomości (Brave → DuckDuckGo) — żadnego nowego kodu sieciowego.
- **Raporty** zapisuje nowa akcja per-user (`createUserReport`) z bezkolizyjnym slugiem — `createReport` (admin) pozostaje nietknięty.
- **Głos i UX**: composer korzysta z istniejącego `SmartTextarea`, który ma już dyktowanie (Web Speech) z poprawnym sprzątaniem przy unmount — zero nowego długu na mikrofonie.

**Zmienione pliki:**

| Plik | Zmiana |
|------|--------|
| `prisma/schema.prisma` | Nowe modele `AiConversation`, `AiMessage` + relacja w `User` |
| `prisma/migrations/0078_ai_conversations` | Migracja Postgres (idempotentna, FK w `DO $$ … EXCEPTION`) |
| `src/actions/aiConversations.ts` | Nowy — CRUD rozmów/wiadomości asystenta (per-user) |
| `src/actions/reports.ts` | Nowa akcja `createUserReport` (per-user, bezkolizyjny slug) |
| `src/lib/ai/agentTools.ts` | Read-tools wszystkich modułów (habits, health, wallet, recipes, meal-plan, pantry, vehicles, decks, news, weather) + dokumentacja `web_search` |
| `src/app/api/llm/home/agent/route.ts` | Kontekst wielo-turowy (`history`), narzędzie `web_search`, krok `report`, więcej modułów, szersza whitelist nawigacji |
| `src/app/api/llm/home/execute/route.ts` | Akcje zapisu dla health/languages/news/weather/kitchen/portfel/flota + `save_report` (mapowanie na Server Actions) |
| `src/app/api/llm/home/interpret/route.ts` | Rozszerzony union `AIAction["module"]` o health/languages/news/weather/reports |
| `src/components/home/AICommandSheet.tsx` | Przebudowa na czat: wątek wiadomości, karty (plan/raport/nawigacja/wyniki), sugestie startowe, historia rozmów, klikalne deep-linki, composer z dyktowaniem |
| `src/components/home/ActionDrawer.tsx` | Nowe typy destrukcyjne + ikony/kolory/etykiety dla health/languages/news/weather |
| `CLAUDE.md`, `doświadczenia.md` | Aktualizacja dokumentacji i wpis z lekcją |

## Podsumowanie

Sesja objęła **jedno** (ale duże) zgłoszenie: podniesienie „magicznej ikony" do poziomu profesjonalnego asystenta-czatu — głównej wartości aplikacji. Główne obszary zmian: warstwa danych (2 nowe modele + migracja), backend agenta (wielo-turowy kontekst, web search, krok raportu, pełny odczyt i zapis wszystkich modułów) oraz front (przebudowa na trwały wątek rozmowy z kartami akcji, raportów i nawigacji, sugestiami i dyktowaniem). Zachowano bramkę akceptacji i opt-in dla akcji destrukcyjnych. Weryfikacja: `npx tsc --noEmit` oraz `npx next build` przechodzą bez błędów; lokalnie schemat rozmów potwierdzony przez `prisma generate`. Uwaga eksploatacyjna: jakość rozumowania zależy od przypisanego modelu w `/admin/llm` (domyślnie Groq `llama-3.3-70b`, łatwo przełączalny na Claude po dodaniu klucza), a wyszukiwarka internetowa działa najpełniej z kluczem `brave_search_api_key` w `/admin/config`.
$report$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
