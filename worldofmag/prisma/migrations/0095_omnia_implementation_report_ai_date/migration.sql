-- Raport implementacyjny: prezentacja dzisiejszej daty w Asystencie AI (magiczna ikona).
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-06',
  'omnia-implementacja-2026-06-06-data-asystent',
  $omnia_ai_date$# Omnia — Raport implementacji 2026-06-06

Sesja realizuje jedno zgłoszenie: **prezentacja daty w Magicznej ikonie** (asystent AI
otwierany Sparkles-FAB-em). Zgłoszenie miało pusty opis, więc intencję doprecyzowano z
kontekstu: asystent już teraz wysyła do agenta pole `today` (bieżąca data), ale **nigdzie
nie pokazuje jej użytkownikowi**. Celem było uczynienie tego kontekstu przejrzystym —
żeby użytkownik widział, względem jakiego „dziś" asystent rozumuje.

---

## Prezentacja daty w Magicznej ikonie

**Diagnoza:** Magiczna ikona (`home/AICommandSheet.tsx`) to globalny asystent AI. Przy
każdym poleceniu do agenta trafia `today: new Date().toISOString()`, dzięki czemu AI
poprawnie interpretuje słowa „dziś / jutro / w piątek". Problem: ta data była **niewidoczna
dla użytkownika** — nagłówek pokazywał tylko tytuł „Asystent AI", więc nie było wiadomo,
jaką datę przyjmuje asystent (istotne np. tuż po północy albo gdy aplikacja działa w tle).

**Rozwiązanie:** Dodano **trwałą, dyskretną prezentację bieżącej daty w nagłówku** sheetu —
podtytuł pod napisem „Asystent AI", w pełnym polskim formacie (np. „Piątek, 6 czerwca 2026").
Decyzje:
- **Format** przez `toLocaleDateString("pl-PL", { weekday, day, month, year })` z
  kapitalizacją pierwszej litery — spójny z resztą aplikacji (kalendarz, pogoda używają
  tego samego API `Intl`), bez dodatkowych zależności.
- **Liczenie po stronie klienta w `useEffect`** (stan `todayLabel`), a nie podczas renderu —
  `AICommandSheet` to komponent renderowany też na serwerze, więc liczenie daty inline
  groziłoby **niespójnością hydratacji** (różnica strefy/sekundy serwer↔klient). Efekt
  odświeża etykietę **przy każdym otwarciu** sheetu, więc data jest świeża nawet po północy.
- **Umiejscowienie w nagłówku** (a nie tylko w pustym ekranie powitalnym) — dzięki temu
  data jest widoczna przez cały czas trwania rozmowy, nie tylko na starcie.
- Style oparte na zmiennych CSS motywu (`var(--text-muted)`), bez hardkodowanych kolorów —
  działa ze wszystkimi skórkami.

**Zmienione pliki:**
- `src/components/home/AICommandSheet.tsx` — helper `formatToday()` (pełna polska data z
  kapitalizacją); stan `todayLabel` aktualizowany w `useEffect` przy otwarciu sheetu;
  podtytuł z datą w nagłówku (pod „Asystent AI"), warunkowo renderowany gdy etykieta gotowa.

---

## Podsumowanie

Zrealizowano **1 zgłoszenie** — niewielka, ukierunkowana zmiana UX w asystencie AI. Główny
obszar: warstwa prezentacji (`AICommandSheet`). Bieżąca data (to samo „dziś", które dostaje
agent) jest teraz pokazywana użytkownikowi w nagłówku magicznej ikony, co czyni kontekst
czasowy asystenta przejrzystym. Data liczona po stronie klienta (bez ryzyka hydration
mismatch) i odświeżana przy każdym otwarciu. Bez zmian schematu DB i bez nowych zależności;
`next build` przechodzi. Zmiany scalono do `develop` (auto-deploy środowiska testowego).
$omnia_ai_date$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
