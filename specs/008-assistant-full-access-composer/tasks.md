# Zadania: Asystent — pełny dostęp, „query-first", composer jak ChatGPT, wybór głosu

- **Plan:** ./plan.md (008-assistant-full-access-composer)
- **Status:** todo
- **Data:** 2026-07-17

> Kolejność: od najłatwiejszego do najtrudniejszego, zgodnie z zależnościami. **Bez fazy danych**
> (brak migracji/schematu/RBAC — plan §2,§4). Fazy: warstwa AI (agent) → biblioteki/UI → bramki.
> `[P]` = niezależne pliki, można równolegle. Odhaczamy w `/implement`.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane

## Faza 0 — Fundament (biblioteki, bez UI)
- [x] **T-1** `[P]` — **`src/lib/tts.ts`: API wyboru głosu.** Dodaj `getAvailableVoices()`,
  `onVoicesChanged(cb)→unsub`, `setPreferredVoiceURI(uri|null)` (zapis do zmiennej modułowej +
  `localStorage["omnia.aiVoice"]`), `getPreferredVoiceURI()` (leniwy odczyt z `localStorage`). W
  `speak()`: gdy jest preferowany `voiceURI` i istnieje w `getVoices()` → ustaw `u.voice`; inaczej nie
  ustawiaj (domyślny). Sygnatura `speak()` bez zmian. *Gotowe, gdy:* helpery eksportowane, `speak()`
  używa wybranego głosu z bezpiecznym fallbackiem; `next lint` czysto. (AC-10, część AC-9)
- [x] **T-2** `[P]` — **`src/components/ui/SmartTextarea.tsx`: prop `bare?: boolean`** (domyślnie
  `false`). W trybie `bare`: brak zewnętrznej ramki/tła/box-shadow, brak stopki „Ctrl+Enter aby
  wysłać", tło transparentne, minimalny padding; wbudowany mikrofon dyktowania + różdżka pozostają,
  renderowane płasko. Ścieżka bez `bare` = 1:1 jak dziś (zero regresji dla tasks/notes/…). *Gotowe,
  gdy:* `bare` wtapia pole (bez ramki/stopki), pozostali konsumenci niezmienieni. (fundament AC-6/AC-7)

## Faza 1 — Zachowanie agenta (AI)
- [x] **T-3** — **`src/lib/ai/fastPath.ts`: strażniki klasyfikacji.**
  (a) deterministyczny **strażnik intencji odczytu** na wejściu `classifyIntent` — regex
  `podaj|pokaż|wyświetl|znajdź|wyszukaj|poszukaj|ile|jak(ie|i|a)|któr\w+|co (mam|mogę|powinienem)|masz|
  sprawdź|zaproponuj|doradź|przypomnij|kiedy|gdzie` → `{kind:"complex"}` (bez wołania LLM);
  (b) **strażnik pustego payloadu** — odrzuć prostą akcję do `complex`, gdy brak kluczowej treści
  (`add_item.rawText`/`create_task.title`/`add_pantry_item.name`/`plan_meal.customTitle` puste,
  `add_expense/add_income.amount` nie-liczba);
  (c) **nazwany kontener → complex** dla `shopping:add_item` (gdy pada „do listy …/na listę …/do
  <Nazwa>") — analogicznie do istniejącej reguły `create_task`;
  (d) wzmocnij `SYSTEM_PROMPT`: prośby o wyszukanie/„podaj mi …"/„zaproponuj …" to **zawsze**
  `complex`. *Gotowe, gdy:* strażniki działają logicznie (fraza „podaj mi zadanie…" → `complex`),
  puste payloady i nazwany-kontener nie idą fast-path'em; `next lint` czysto. (AC-1, AC-2, AC-5)
- [x] **T-4** — **`src/app/api/llm/home/agent/route.ts`: reguły promptu** w `buildSystemPrompt`
  (sekcja ZASADY): dodaj **QUERY-FIRST/WYSZUKIWANIE** (prośby „podaj/pokaż/znajdź/ile/jakie/zaproponuj
  mi …" → `query` z parametrami `status/search/limit/priority` → `answer` z konkretnym wynikiem; nigdy
  akcja tworząca; filtruj po stronie narzędzia, nie „mieli" całości) i **SZANUJ NAZWANY KONTENER**
  (zawsze wypełnij `listName/projectName/deckName/workshopName/elementName…`, gdy nazwa padła). Reguły
  „KOMPAN" i „DOPYTUJ, NIE ZGADUJ" zostają. *Gotowe, gdy:* prompt zawiera obie reguły z przykładem
  „podaj mi zadanie do zrobienia" → `list_tasks`. (AC-2, AC-3, AC-5; AC-4 potwierdzone inspekcją —
  `READ_TOOLS_PROMPT` zawsze wstrzykiwany, brak zmian potrzebnych)

## Faza 2 — UI Asystenta
- [ ] **T-5** — **Composer „pigułka"** w `src/components/home/AICommandSheet.tsx`: owiń zawartość w
  jeden kontener (`var(--bg-elevated)`, `1px var(--border)`, `borderRadius` ~24, flex, `items-end`,
  padding). Układ: `+` flush-left (okrągły, bez ramki) · **bare `SmartTextarea`** (`flex-1 min-w-0`) ·
  **mikrofon dyktowania** (z SmartTextarea) · **okrągłe kółko trybu głosowego** (wypełnione
  `var(--accent-blue)`, ikona fali — `AudioLines` z lucide, fallback `Mic`; tekst `var(--on-accent)`) ·
  **Wyślij/Stop** (przy treści). Zachowaj wszystkie handlery: `toggleVoice` (dalej `primeSpeech()` +
  `startListening()` w geście), `handleSend`, `stopGeneration`, popover `+` (Zdjęcie/Stałe
  preferencje), dyktowanie, tryb głosowy. Zero hardcodowanych hexów (C-30), mobile-first (pole szerokie,
  cele ≥40px, brak poziomego przewijania na iPhone). *Gotowe, gdy:* widok = spójna pigułka jak w
  referencji, wszystkie funkcje działają. (AC-6, AC-7)
- [ ] **T-6** `[P]` — **Skrócenie mowy karty akcji** (`AICommandSheet.tsx`, sterownik pętli, gałąź
  `last.kind === "plan"`): zamień długi `voiceAnnounce("Przygotowałem N … Powiedz „zatwierdź"…")` na
  krótkie `Przygotowałem ${n} ${n===1?"akcję":"akcji"}.` (bez instrukcji obsługi). Wizualne
  przyciski/instrukcje na karcie zostają. *Gotowe, gdy:* w trybie głosowym po utworzeniu karty lektor
  nie recytuje obsługi. (AC-8)
- [ ] **T-7** — **Selektor głosu w ustawieniach czatu** (`AICommandSheet.tsx`, panel `showPrefs`):
  dodaj `<select>` „Głos lektora" (pozycja zerowa „(domyślny przeglądarki)") zasilany
  `getAvailableVoices()`, subskrybujący `onVoicesChanged` (odświeżenie przy async ładowaniu iOS). Wybór
  → `setPreferredVoiceURI(voiceURI)`. Teksty PL (C-32), stylizacja zmiennymi CSS. (opcjonalnie mały
  „Przetestuj głos" → `speak("Testowy głos asystenta.","pl")`). *Gotowe, gdy:* można wybrać głos, lista
  dopełnia się async, wybór trwały po reloadzie i użyty przy odczycie. (AC-9, AC-10)

## Faza 3 — Bramki i domknięcie
- [ ] **T-8** — **Bramki (C-50, C-13):** `npm run check:migrations` (0 nowych — zielone) →
  `npm run check:actions` (0 nowych `AIAction` — zielone) → `npx next lint --dir src` →
  `npx next build` (lokalny Postgres; nigdy prod DB). *Gotowe, gdy:* wszystkie zielone.
- [ ] **T-9** — **Mapowanie AC → wynik** (input do `/verify`): przejdź AC-1…AC-11, zaznacz, które
  zweryfikowane statycznie (kod/lint/build), a które wymagają testu live na `develop` (AC-1/2/5 —
  klasyfikacja LLM; AC-11 — pętla głosowa Chrome/iOS).
- [ ] **T-10** — **`doświadczenia.md`** (C-51): dopisz lekcję, jeśli po drodze wystąpił nieoczywisty
  problem (np. iOS async voices, kolizja `bare`/SmartTextarea). Jeśli nic — pomiń.

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadanie(a) |
|----|-----------|
| AC-1 (klasyfikacja odczytu) | T-3, T-4 |
| AC-2 (intencje find/show) | T-3, T-4 |
| AC-3 (query-first, bez „mielenia") | T-4 |
| AC-4 (pełny dostęp) | T-4 (inspekcja — bez zmian kodu) |
| AC-5 (nazwany kontener) | T-3, T-4 |
| AC-6 (composer wygląd) | T-2, T-5 |
| AC-7 (composer kompletność funkcji) | T-2, T-5 |
| AC-8 (mniej gadania) | T-6 |
| AC-9 (wybór głosu — ustawienia) | T-1, T-7 |
| AC-10 (wybór głosu — trwałość/użycie) | T-1, T-7 |
| AC-11 (brak regresji trybu głosowego) | T-5, T-6, T-8 (build) + test live |

## Ścieżka krytyczna / zależności
- **T-1 → T-7** (picker potrzebuje API głosu z tts).
- **T-2 → T-5** (pigułka potrzebuje `bare` w SmartTextarea).
- **T-3, T-4** niezależne od UI (można równolegle do T-1/T-2/T-5).
- **T-6** niezależne (`[P]`).
- **T-8** (bramki) po T-1…T-7. **T-9/T-10** na końcu.

## Notatki / blokady
- AC-1/AC-2/AC-5/AC-11 zależą od LLM/przeglądarki → ostateczne potwierdzenie na test env (`develop`),
  nie tylko `next build`.
