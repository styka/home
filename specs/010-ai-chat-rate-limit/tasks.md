# Zadania: Odporność asystenta AI na limity szybkości (rate limit / 429)

- **Plan:** ./plan.md (010-ai-chat-rate-limit)
- **Status:** todo
- **Data:** 2026-07-19

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie małe, samodzielne i weryfikowalne. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego

## Faza 0 — Fundament danych
- **Bez zmian schematu i migracji** (plan §2). Nic do zrobienia — `npm run check:migrations` i tak
  przejdzie (brak nowych katalogów migracji).

## Faza 1 — Warstwa integracji LLM (retry + backoff)
- [x] **T-1** — W `worldofmag/src/lib/llm/chat.ts` dodaj nieeksportowany helper `fetchWithRetry(url,
  init)` + stałe `LLM_MAX_RETRIES=2`, `LLM_RETRY_CAP_MS=8000`. Logika (plan §3a): ponawia **tylko** dla
  błędów przejściowych (`isRetryableLlmStatus`: 429/≥500) oraz przy rzuconym `fetch` (sieć); odczytuje
  `Retry-After` (sekundy albo data HTTP), waliduje na rozsądny dodatni zakres (NaN/ujemne/olbrzymie →
  traktuj jak brak), capuje pojedyncze oczekiwanie do `LLM_RETRY_CAP_MS`; gdy `Retry-After` > cap —
  przerwij ponawianie tego modelu; brak nagłówka → backoff wykładniczy z jitterem (~600ms→~1500ms,
  capowany); przed ponowieniem zwolnij ciało odrzuconej odpowiedzi (`res.body?.cancel()`); zwróć
  ostatnią odpowiedź (ok albo nie-ok).
  - *Gotowe, gdy:* helper istnieje, typuje się czysto, nie zmienia jeszcze zachowania (jeszcze niewpięty).
- [x] **T-2** — Wepnij `fetchWithRetry` w miejsce surowego `fetch(...)` w czterech funkcjach dostawcy w
  `chat.ts`: `openAiComplete`, `anthropicComplete`, `openAiStream`, `anthropicStream`. Zachowaj
  dotychczasową obsługę `!res.ok`/`!res.body` (czytanie `.text()`, zwrot `{ok:false,status,message}`),
  żeby łańcuch fallbacku Z-133 działał bez zmian.
  - *Gotowe, gdy:* wszystkie 4 ścieżki używają owijacza; łańcuch `chatComplete`/`chatStream`
    iteruje po `chain` jak wcześniej (retry zagnieżdżony w pojedynczym wywołaniu). Pokrywa **AC-1,
    AC-2, AC-5, AC-6**.

## Faza 2 — UI
- **Bez zmian UI** (plan §5). Klient `AICommandSheet` wyświetla `body.error` z serwera bez modyfikacji.

## Faza 3 — Komunikat dla użytkownika (asystent)
- [x] **T-3** — W `worldofmag/src/app/api/llm/home/agent/route.ts`, w `runAgentLoop` (blok `catch`
  wokół `callAgent`), gdy `status === 429` podmień `error` na stałą, polską treść (np. „Asystent jest
  teraz przeciążony (chwilowy limit zapytań do modelu). Spróbuj ponownie za chwilę."). Nie przepisuj
  surowej treści dostawcy (C-41). Inne statusy bez zmian.
  - *Gotowe, gdy:* dla 429 `body.error` = nasz polski tekst; działa w obu trybach (zwykły i SSE, bo oba
    idą przez `runAgentLoop`). Pokrywa **AC-3, AC-4**.

## Faza 4 — Bramki i domknięcie
- [x] **T-4** — `cd worldofmag && npx next lint` + kompilacja (`next build` do kroku bundla; **bez**
  `migrate.js`/prod DB — C-13). Zielone typy i lint dla zmienionych plików.
- [x] **T-5** — Mapowanie każdego AC (AC-1..AC-6) ze speca na wynik implementacji — input do `/verify`.
- [x] **T-6** — Wpis do `doświadczenia.md` (C-51): obsługa limitu 429/TPM (retry z `Retry-After` +
  backoff, cap, łagodny komunikat), zacommitowany razem z fixem.

## Mapowanie AC → zadania
| AC | Zadanie(a) |
|----|-----------|
| AC-1 (auto-retry → sukces) | T-1, T-2 |
| AC-2 (respekt `Retry-After`, ograniczone próby) | T-1, T-2 |
| AC-3 (łagodny komunikat, brak surowego tekstu) | T-3 |
| AC-4 (spójność SSE) | T-3 |
| AC-5 (brak ponawiania 4xx≠429) | T-1, T-2 |
| AC-6 (fallback bez regresji) | T-2 |

## Ścieżka krytyczna
T-1 → T-2 (retry wpięty) i T-3 (komunikat) są niezależne od siebie [P], oba przed T-4 (bramki) →
T-5 (mapowanie AC) → T-6 (lekcja).

## Notatki / blokady
- Brak. Zmiana czysto kodowa, 2 pliki + log; brak migracji, RBAC, AIAction, UI.
