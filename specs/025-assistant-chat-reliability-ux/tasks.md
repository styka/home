# Zadania: Niezawodność i UX czatu asystenta AI

- **Plan:** ./plan.md (025-assistant-chat-reliability-ux)
- **Status:** done
- **Data:** 2026-07-23

> Kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami. Brak migracji/schematu i
> brak nowych Server Actions (feature czysto kodowy — plan §2/§3), więc Faza 0 i „nowa akcja" odpadają.
> Każde zadanie ≈ jeden spójny commit.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego (inny plik), można robić równolegle

## Faza 0 — Fundament danych
- [x] **T-0** — Brak: feature nie rusza schematu ani migracji (plan §2). Nic do zrobienia — świadomie pominięte.

## Faza 1 — UI (Problem B, niezależne od reszty)
- [x] **T-1** `[P]` — **Przycisk „Wyślij" w dymku `clarify`** (`src/components/home/AICommandSheet.tsx`,
  blok `turn.kind === "clarify"`). Pod `SmartTextarea` dodać widoczny `<button type="button">` z ikoną
  wysyłki (Lucide) i tekstem „Wyślij", wywołujący `onClarifySubmit(turn, clarifyInput)`; `disabled` gdy
  `clarifyInput.trim()` puste; tło `var(--accent-blue)`, tekst `var(--on-accent)`, cel dotyku ≥ `py-3`.
  Chipy opcji i zatwierdzanie Enterem (`SmartTextarea onSubmit`) działają nadal.
  **Gotowe, gdy:** w dymku `clarify` jest klikalny przycisk zatwierdzający wpisaną odpowiedź bez
  klawiatury; istniejące ścieżki (chip/Enter) nietknięte. (AC-3)

## Faza 2 — AI: rozwiązywanie projektu po nazwie (Problem C)
- [x] **T-2** — **Helper `resolveProjectRef`** w `src/lib/ai/agentTools.ts`: przyjmuje `(userId, ref)`,
  zwraca `{ id }` (gdy `ref` = dostępne id **albo** jednoznaczne dopasowanie nazwy: dokładne →
  jednoznaczne częściowe, `mode:"insensitive"`) lub `{ unresolved, available: string[] }` (brak/wiele).
  Liczone tylko wśród `accessibleProjectIds(userId)` (C-21).
  **Gotowe, gdy:** helper kompiluje się i zwraca poprawnie dla: realnego id, nazwy „LZ", nieistniejącej
  nazwy, nazwy wieloznacznej.
- [x] **T-3** — **Wpięcie w `list_tasks`** (`agentTools.ts`): parametr projektu (`projectId`)
  interpretować jako id-lub-nazwę przez `resolveProjectRef`; rozwiązany → filtr po realnym id; nierozwiązany
  → `throw new Error("Nie znaleziono projektu o nazwie »…«. Dostępne projekty: …. Doprecyzuj albo użyj
  list_projects.")` (łapane przez `runReadTool` → `{ error }` w wynikach → agent robi `clarify`). Uwaga (C-54): `get_task` nie ma parametru projektu — resolucja dotyczy tylko `list_tasks`.
  **Gotowe, gdy:** zapytanie o projekt nazwą zwraca zadania (AC-1); nieistniejący/wieloznaczny → sygnał
  błędu zamiast pustej listy (AC-2); prawdziwe id działa jak dotąd (AC-2, kompatybilność).
- [x] **T-4** `[P]` — **Prompt** (`READ_TOOLS_PROMPT`, wiersz `list_tasks`): dopisać „`projectId` może być
  identyfikatorem **albo nazwą** projektu (bez rozróżniania wielkości liter)". Bez wstrzykiwania listy
  projektów do kontekstu (rozwiązanie serwerowe — koszt tokenów = 0).
  **Gotowe, gdy:** opis narzędzia informuje agenta, że można podać nazwę. (wspiera AC-1)

## Faza 3 — AI: limity i rozmiar zapytania (Problem A)
- [x] **T-5** — **Limity TPM per-model** w `src/lib/llm/tpmLimiter.ts`: mapa modeli
  (`llama-3.3-70b-versatile → 12000`, `llama-3.1-8b-instant → 6000`, inne → `DEFAULT_TPM`) + eksport
  `modelTpmLimit(model)`; `reserveTpm` capuje wg limitu **danego modelu** (parametr `limit` domyślnie
  z `modelTpmLimit(key)`).
  **Gotowe, gdy:** rezerwacja dla 8b liczy się wobec 6000, dla 70b wobec 12000. (fundament AC-5)
- [x] **T-6** — **Pomijanie modelu, w którym zapytanie się nie zmieści** w `src/lib/llm/chat.ts`
  (`chatComplete`, gałąź Groq/`openai_compat`): przed wysłaniem policzyć szacunek tokenów
  (`estimateTokens(prompt)` + zarezerwowany `maxTokens`); jeśli > użytecznego capu `modelTpmLimit(model)`
  → pomiń model (nie wysyłaj), przejdź do kolejnego ogniwa, **zachowaj poprzednią realną porażkę** jako
  `last`; gdy pominięto wszystkie → zwróć czytelny błąd PL „Zapytanie było zbyt duże dla dostępnych
  modeli…" (bez surowej treści dostawcy, C-41).
  **Gotowe, gdy:** 7,5k-tokenowy request nie trafia na 8b (6000 TPM); użytkownik dostaje uczciwą porażkę
  z 70b zamiast „Request too large". (AC-5, wspiera AC-4)
- [x] **T-7** `[P]` — **Klasyfikacja 413** (`chat.ts` i/lub `agent/route.ts` blok `catch` w
  `runAgentLoop`): status 413 / treść „request too large"/„too large" → komunikat PL „Zapytanie było
  zbyt duże — spróbuj krócej/prościej.", obok istniejącego rozpoznania 429 (dzienny/minutowy).
  **Gotowe, gdy:** przy 413 użytkownik widzi zrozumiały komunikat PL, nigdy surową treść dostawcy. (AC-4)
- [x] **T-8** — **Przycięcie promptu** w `src/app/api/llm/home/agent/route.ts`: w `pushTrimmedHistory()`
  dołożyć **budżet znakowy** wstrzykiwanej historii (~2500 znaków) obok limitu liczby wiadomości; obniżyć
  `MAX_HISTORY_MESSAGES` 12 → 8. Nie ruszać zawężania katalogu akcji/read-tooli (router już to robi), by
  nie stracić poprawności odczytu (AC-1).
  **Gotowe, gdy:** wstrzykiwana historia jest zauważalnie mniejsza; typowe „wybierz 3 zadania…" mieści się
  w limicie. (AC-6)

## Faza 4 — Bramki i domknięcie
- [x] **T-9** — **Bramki:** `npm run check:actions` (brak nowej `AIAction` → zielone),
  `npm run check:migrations` (brak nowej migracji → zielone), `next lint`, `next build` (do kroku
  `next build`; C-13 — nie odpalać `migrate.js` z prod DB; w razie potrzeby lokalny Postgres).
  **Gotowe, gdy:** build przechodzi do `next build` bez błędów.
- [x] **T-10** — **Mapowanie AC → wynik** (input do `/verify`): AC-1/AC-2 (T-2,T-3,T-4), AC-3 (T-1),
  AC-4 (T-6,T-7 + istniejąca infra `retryLast`/`lastPayloadRef`), AC-5 (T-5,T-6), AC-6 (T-8). Potwierdzić,
  że wiadomość użytkownika zostaje w wątku i „Ponów" działa (kod obecny to gwarantuje).
- [x] **T-11** — **Wpis do `doświadczenia.md`** (C-51): lekcja o (a) mapowaniu nazwy projektu na id w
  read-toolach, (b) limitach TPM per-model i pomijaniu modelu za małego dla zapytania.

## Mapowanie kryteriów akceptacji
| AC | Zadania |
|----|---------|
| AC-1 (projekt nazwą → zadania) | T-2, T-3, T-4 |
| AC-2 (brak/niejednoznaczność → clarify; id nadal działa) | T-2, T-3 |
| AC-3 (przycisk clarify na mobile) | T-1 |
| AC-4 (uczciwy komunikat + tura zachowana/ponów) | T-6, T-7 (+ istniejąca infra klienta) |
| AC-5 (fallback uwzględnia rozmiar zapytania) | T-5, T-6 |
| AC-6 (mniejszy prompt) | T-8 |

## Ścieżka krytyczna / zależności
- **T-2 → T-3** (helper przed wpięciem); **T-4** równolegle do T-2/T-3 (prompt).
- **T-5 → T-6** (limity per-model przed logiką pomijania); **T-7** równolegle.
- **T-1** i **T-8** niezależne (inne pliki) — `[P]`.
- **T-9 → T-10 → T-11** na końcu (bramki po całości).

## Notatki / blokady
- Brak. Feature bez migracji i bez nowych akcji — bramki `check:migrations`/`check:actions` są przechodnie z założenia.
