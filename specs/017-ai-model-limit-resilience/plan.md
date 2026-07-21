# Plan techniczny: Odporność asystenta AI na wyczerpanie limitu modelu

- **Spec:** ./spec.md (017-ai-model-limit-resilience)
- **Status:** draft
- **Data:** 2026-07-21

> **Zasada planu:** to jest **JAK**. Wzorzec do naśladowania: istniejący **łańcuch fallbacku modeli**
> (Z-133) w `resolveLlmChain` + iteracja po łańcuchu w `chatComplete` — dokładamy do niego jedno ogniwo
> (lżejszy model) i klasyfikację treści komunikatu limitu.

## 1. Podejście (2–4 zdania)
Wykorzystujemy **istniejący** mechanizm łańcucha modeli: `resolveLlmChain(op)` zwraca listę konfiguracji
prób, a `chatComplete` przechodzi po niej i przy błędzie przejściowym (429/5xx) próbuje kolejnej. Dziś dla
`reasoning` łańcuch ma zwykle **jedno** ogniwo (Groq 70b), więc 429 kończy sprawę. **Dokładamy ostatnie
ogniwo — lżejszy model Groqa (`llama-3.1-8b-instant`)** — więc gdy 70b wyczerpie limit (dzienny lub
minutowy), agent **degraduje** na 8b i zwykle i tak odpowiada. Osobno **klasyfikujemy treść błędu 429**
(dzienny „per day/TPD" vs minutowy „per minute/TPM") i budujemy z tego **uczciwy, polski** komunikat, gdy
naprawdę żaden model nie zadziała. **Bez zmian w schemacie bazy, bez nowej `AIAction`, bez RBAC/UI-nawigacji.**

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Brak nowych modeli/kolumn i migracji (C-10/C-11/C-12 nie dotyczą).

## 3. Warstwa serwera (Server Actions — C-20)
**Bez zmian w Server Actions.** Zmiana dotyczy wyłącznie warstwy LLM (`src/lib/llm/*`) i trasy agenta
(`/api/llm/home/agent`). Nie ruszamy mutacji danych ani `revalidatePath`.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Asystent na `/` (`module.home`); brak nowego slugu/wpięć.

## 5. UI (C-30, C-31, C-32)
**Bez zmian w UI/nawigacji.** Jedyna zmiana widoczna dla użytkownika to **treść komunikatu błędu** w
czacie (po polsku, C-32) — renderowana istniejącą ścieżką błędu (`setError`/bąbelek), bez nowych
komponentów ani kolorów.

## 6. AI / integracje — rdzeń zmiany (C-40)
**a) `src/lib/llm/resolver.ts` — dołóż lżejsze ogniwo fallbacku dla `reasoning`.**
- Po dodaniu ogniwa admina i legacy-Groq (70b) dla `op === "reasoning"` **dopisz** ogniwo:
  Groq (`GROQ_BASE_URL`, klucz z `Config.groq_api_key`) z modelem **`OPERATION_TYPE_META.dispatch.defaultModel`**
  (`llama-3.1-8b-instant`) — model o **osobnym budżecie**, który w logach działał, gdy 70b był wyczerpany.
- Dedup (`kind|baseUrl|model`) jest już w `add()` — jeśli admin ustawił 8b jako główny, nie zdublujemy.
- Ogniwo dokładamy **tylko** gdy istnieje klucz Groqa (jak legacy-fallback). Dla `vision`/`generation`/
  `dispatch` — bez zmian (spec: zakres = reasoning). Odnotowane jako świadome zawężenie (C-53).
- **C-40:** to rozszerzenie **istniejącego** DB-driven łańcucha (fallback-default w resolverze, nie
  hardcode w kodzie funkcji-cechy) — spójne z obecnym legacy-fallbackiem.

**b) `src/lib/llm/chat.ts` — klasyfikacja rodzaju limitu (czysta funkcja, testowalna).**
- Dodaj i wyeksportuj `classifyRateLimitKind(message: string): "daily" | "minute" | "generic"`:
  - `daily` gdy treść zawiera `per day` / `TPD` / `tokens per day` (bez rozróżniania wielkości liter),
  - `minute` gdy `per minute` / `TPM` / `tokens per minute`,
  - inaczej `generic`.
- Podnieś obcięcie treści błędu z `slice(0, 200)` na `slice(0, 300)` w `openAiComplete`/`anthropicComplete`
  (margines, by sygnał „(TPD)/(TPM)" na pewno przetrwał; pomaga też diagnostyce `/admin/ai-calls`). To
  **nie** jest pokazywane użytkownikowi (patrz c) — służy klasyfikacji i logowi.
- Dodaj `rateLimitUserMessage(kind): string` (albo trzymaj mapę w route) zwracającą polski komunikat:
  - `daily` → „Wyczerpano **dzienny** limit darmowego modelu AI. Spróbuj po północy (UTC) albo ustaw
    płatny model w panelu **Admin → LLM**."
  - `minute`/`generic` → „Asystent jest teraz przeciążony (chwilowy limit zapytań do modelu). Spróbuj
    ponownie za chwilę." (zachowanie jak dziś — bezpieczny domyślny, spec §9 ryzyko).

**c) `src/app/api/llm/home/agent/route.ts` — użyj klasyfikacji w komunikacie 429.**
- W `runAgentLoop` (blok `catch` wokół `callAgent`, obecnie stała treść dla `status === 429`): zamiast
  jednej stałej, sklasyfikuj `e.message` (treść dostawcy przeniesiona z `result.message`) przez
  `classifyRateLimitKind` i zwróć odpowiedni **polski** komunikat (`rateLimitUserMessage`). **Nigdy** nie
  zwracaj surowego `e.message` (C-41). Dla statusów ≠ 429 — bez zmian.
- Degradacja (pkt a) dzieje się „niżej" (w `chatComplete`), więc `runAgentLoop` dostaje 429 dopiero, gdy
  **wszystkie** modele w łańcuchu (70b → 8b) zawiodły — wtedy komunikat jest właściwy (zwykle dzienny).

**Bez nowej `AIAction`** → `check:actions` nie dotyczy. Diagnostyka z 016 (`AiCall` per rozmowa) loguje
każdą próbę łańcucha (w tym degradację i porażki) bez zmian.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `src/lib/llm/resolver.ts` | edycja | Dołożyć lżejsze ogniwo fallbacku (Groq 8b) dla `reasoning` |
| `src/lib/llm/chat.ts` | edycja | `classifyRateLimitKind` + `rateLimitUserMessage` (eksport, czyste funkcje); slice 200→300 |
| `src/app/api/llm/home/agent/route.ts` | edycja | W `catch` 429 użyć klasyfikacji zamiast stałej treści |
| `src/lib/llm/__tests__/rateLimitMessage.test.ts` | nowy | Testy `classifyRateLimitKind` (TPD→daily, TPM→minute, inne→generic) + `rateLimitUserMessage` |
| `doświadczenia.md` | edycja | Wpis o limicie dziennym vs minutowym + degradacji (C-51) |

## 8. Bramki i weryfikacja (C-50)
- Lokalnie: `next lint` + `next build` (lokalny Postgres, C-13, bez `migrate.js`); `npm run test:unit`.
- **Mapowanie AC → weryfikacja:**
  - **AC-1** (degradacja odpowiada): łańcuch `reasoning` ma teraz 2 ogniwa (70b→8b); test/inspekcja
    `resolveLlmChain("reasoning")` zwraca 8b jako ostatnie ogniwo, gdy jest klucz Groqa. Manualnie na
    prod/develop: przy wyczerpanym 70b polecenie kończy się odpowiedzią (log `/admin/ai-calls`: 70b FAIL
    → 8b OK).
  - **AC-2/AC-3/AC-4** (komunikaty): test jednostkowy `classifyRateLimitKind` na realnych treściach z
    logów (TPD/TPM) + `rateLimitUserMessage`; inspekcja, że route zwraca polski komunikat, nigdy surowy.
  - **AC-5** (płatny Anthropic bez regresji): resolver dla admin-Anthropic nadal stawia je jako 1. ogniwo;
    8b-fallback dokładany tylko przy kluczu Groqa i po Anthropic (last resort) — nie zmienia ścieżki płatnej.
  - **AC-6** (brak regresji): pacing/retry/diagnostyka nietknięte; `chatComplete` iteruje łańcuch jak dotąd.

## 9. Ryzyka techniczne i plan wycofania
- **8b nie udźwignie reasoning (gorsza jakość/niepoprawny JSON)** → agent ma już 2 próby parsowania JSON
  na iterację; w najgorszym razie degradacja daje słabszą, ale odpowiedź (świadoma decyzja właściciela).
- **Treść błędu dostawcy inna niż w logach (brak „TPD/TPM")** → `generic` → komunikat „spróbuj za chwilę"
  (bezpieczny domyślny). Zgodne ze spec §9.
- **Zbędne retry na martwym (dziennie) 70b wydłużają czas** → poza zakresem (spec: brak trwałego licznika
  wyczerpania); degradacja i tak dochodzi do 8b. Ewentualna przyszła optymalizacja.
- **Rollback:** czysto kodowy (brak migracji) — rewert 3 plików przywraca stan sprzed zmiany.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak zmian schematu)
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — bez nowych akcji/slugów; C-23 (brak nowej AIAction) OK
- [x] C-30..C-32 (UX) — brak zmian UI poza treścią komunikatu; teksty PL
- [x] C-40 (routing modeli DB-driven) — rozszerzamy istniejący łańcuch w resolverze, nie hardcode w cesze
- [x] C-41 — nigdy surowy tekst/klucz dostawcy; komunikat po polsku
- [x] C-53 (minimalizm) — 3 pliki, reuse łańcucha fallbacku; zero nowych zależności/abstrakcji
- [x] C-54 — plan zgodny ze specem (limit bywa dzienny; degradacja + uczciwy komunikat)
