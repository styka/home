# Plan techniczny: Asystent — pełny dostęp, „query-first", composer jak ChatGPT, wybór głosu

- **Spec:** ./spec.md (008-assistant-full-access-composer)
- **Status:** draft
- **Data:** 2026-07-17

> **Zasada planu:** to jest **JAK**. Feature to warstwa AI (agent/prompt/fast-path) + UI (composer,
> ustawienia głosu, mowa). **Bez zmian w schemacie Prisma, bez migracji, bez nowych `AIAction`, bez
> nowego uprawnienia RBAC.** Wzorzec do naśladowania: istniejący kod Asystenta
> (`AICommandSheet.tsx`, `agent/route.ts`, `fastPath.ts`, `tts.ts`, executory) — rozszerzamy go
> punktowo, zgodnie ze stylem otoczenia (C-53).

## 1. Podejście
Sześć niezależnych usprawnień w istniejącej ścieżce Asystenta, zero nowych bytów danych:
1. **Composer** — zawijamy dolny pasek w jedną „pigułkę" w stylu ChatGPT; `SmartTextarea` dostaje
   opcjonalny wariant `bare` (bez własnej ramki/tła/stopki), żeby wtopić się w pigułkę; wszystkie
   dotychczasowe kontrolki zostają.
2. **Mowa karty akcji** — skracamy komunikat głosowy w sterowniku pętli (`AICommandSheet.tsx`).
3. **Wybór głosu** — picker w panelu ustawień czatu; trwałość per-urządzenie (localStorage);
   `tts.ts` dostaje globalny „preferowany głos" używany w `speak()`.
4–6. **Zachowanie agenta** — twardsze rozpoznanie intencji odczytu/wyszukania w `fastPath.ts`
   (deterministyczny strażnik + strażnik pustego payloadu), wzmocnione reguły w `buildSystemPrompt`
   (query-first, szanuj nazwany kontener). Backend już rozwiązuje nazwany kontener
   (`resolveOrCreateList`/`resolveProjectIdForCreate` priorytetyzują `listName`/`projectName`) — poprawiamy
   stronę wejścia, żeby te parametry nie ginęły.

## 2. Model danych (Prisma)
**Bez zmian w schemacie. Brak migracji.** Wybór głosu i (istniejące już) preferencje trzymamy w
`localStorage` (per-urządzenie — patrz decyzja właściciela w spec §8; głosy Web Speech są specyficzne
dla urządzenia/przeglądarki). `npm run check:migrations` i `check:actions` pozostają zielone (nie
dodajemy migracji ani `AIAction`).

## 3. Warstwa serwera (Server Actions — C-20)
**Bez nowych Server Actions.** Zmiany w warstwie serwera dotyczą wyłącznie tras API Asystenta
(nie-mutujących danych użytkownika bezpośrednio — one nadal idą przez istniejące executory):

- `src/lib/ai/fastPath.ts` — twardsze rozpoznanie:
  - **Strażnik intencji odczytu (deterministyczny, bez LLM):** na wejściu `classifyIntent` dodaj
    regex rozpoznający prośby o ZNALEZIENIE/POKAZANIE/RADĘ (np. `podaj|pokaż|wyświetl|znajdź|wyszukaj|
    poszukaj|ile|jak(ie|i|a)|któr\w+|co (mam|mogę|powinienem)|masz|sprawdź|zaproponuj|doradź|przypomnij|
    kiedy|gdzie`). Trafienie → natychmiast `{ kind: "complex" }` (oddaj agentowi, który zrobi `query`
    + `answer`). To rozwiązuje przykład „podaj mi zadanie, jakie mógłbym zrobić" (AC-1/AC-2).
  - **Strażnik pustego payloadu:** po zbudowaniu prostej akcji odrzuć ją do `complex`, gdy brak
    kluczowej treści (np. `add_item.rawText` puste; `create_task.title` puste; `add_pantry_item.name`
    puste; `add_expense/add_income.amount` nie-liczba; `plan_meal.customTitle` puste). Zapobiega
    „dodaniu niczego do listy zakupów".
  - **Nazwany kontener → complex:** rozszerz istniejącą regułę (dziś tylko `create_task` z nazwanym
    projektem) na `shopping:add_item` — gdy w poleceniu pada wskazanie listy (np. „do listy …", „na
    listę …", „do <Nazwa>"), zwróć `complex`, żeby pełny agent wypełnił `listName` (który executor
    już respektuje). Realizuje AC-5 na szybkiej ścieżce.
  - Wzmocnij `SYSTEM_PROMPT` klasyfikatora: dopisz jawnie, że prośby o wyszukanie/pokazanie/„podaj
    mi …"/„zaproponuj …" to **zawsze** `complex`.
- `src/app/api/llm/home/agent/route.ts` — `buildSystemPrompt(modules)`: dodaj do sekcji ZASADY:
  - **QUERY-FIRST / WYSZUKIWANIE:** prośby „podaj/pokaż/znajdź/ile/jakie/zaproponuj mi …" realizuj
    **zawsze** przez `query` z parametrami narzędzia (`status`/`search`/`limit`/`priority`/…) i odpowiedz
    krokiem `answer` z konkretnym wynikiem; **nigdy** nie odpowiadaj na taką prośbę akcją tworzącą.
    Przykład: „podaj mi zadanie do zrobienia" → `list_tasks {status:"TODO", limit:…}` → wybierz 1 i
    odpowiedz. Filtruj **po stronie narzędzia** (nie pobieraj całości „na zapas") — to realizuje zakaz
    „mielenia" danych przez LLM (AC-3).
  - **SZANUJ NAZWANY KONTENER:** gdy użytkownik nazwie listę/projekt/talię/warsztat itp., **zawsze**
    wypełnij odpowiedni parametr (`listName`/`projectName`/`deckName`/`workshopName`/`elementName`/…);
    nie celuj w inny/domyślny kontener, gdy nazwa padła (AC-5).
  - Reguły „KOMPAN — DOMYŚLNIE ROZMAWIAJ" i „DOPYTUJ, NIE ZGADUJ" zostają (spójne z 006).
- **Pełny dostęp (AC-4):** potwierdzone w kodzie — `READ_TOOLS_PROMPT` wstrzykiwany **zawsze** (nie jest
  gejtowany routerem modułów), a read-toole (`READ_TOOL_NAMES` w `agentTools.ts`) pokrywają wszystkie 15
  modułów katalogu (`list_tasks/list_items/list_notes/list_pets/list_storage_items/list_habits/
  list_health_events/list_medications/list_wallet/list_recipes/list_meal_plan/list_pantry/list_vehicles/
  list_workshops/list_decks/list_news_topics/list_weather_locations/list_calendar` + `get_task/get_note`).
  **Nie dodajemy nowych read-tooli** (moduły spoza katalogu `AIActionModule` — kontakty/usługi/truck — są
  świadomie poza zakresem, spec §5). Dostęp respektuje własność (ownerId/zespół) — read-toole już to robią
  (C-21).

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Feature żyje w istniejącym Asystencie (`module.home`); żadnych nowych slugów, wpisów w
`permissions.ts`, `modules.tsx` ani `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32) — `src/components/home/AICommandSheet.tsx` + `SmartTextarea.tsx` + `tts.ts`

### 5a. Composer „pigułka" (AC-6, AC-7)
> **Rewizja (2026-07-17, po ponownym obejrzeniu zdjęcia referencyjnego):** wariant `bare` w
> `SmartTextarea` okazał się za ciężki (własny pasek mikrofon+różdżka + wysoki padding → pigułka
> była „gruba", niepodobna do referencji). Ostatecznie: **`SmartTextarea` wraca nietknięte**
> (używa go dalej pole „clarify" i inne moduły), a pigułka dostaje **własne, lekkie pole**
> (`<textarea>` auto-rosnące, bez ramki) + **nowy hook `src/hooks/useDictation.ts`**
> (mowa→tekst, ciągłe dyktowanie, lokalny rzut okna jak w `lib/speechRecognition.ts`) pod
> osobny, cienki przycisk mikrofonu w pigułce — dokładnie jak w ChatGPT. Prawy skraj: przy pustym
> polu **kółko rozmowy głosowej** (wypełnione, `AudioLines`); przy treści **Wyślij**; przy
> generowaniu **Stop**.
- Owinąć zawartość composera (dziś flex-row 4 osobnych „pudełek") w **jeden kontener-pigułkę**:
  `display:flex; align-items:flex-end; gap; padding:6px; border:1px solid var(--border);
  background:var(--bg-elevated); borderRadius:24px` (róg z `var(--radius-lg)` gdy sensowny; kolory
  wyłącznie ze zmiennych CSS — C-30). Układ wewnątrz: **`+`** (flush-left, bez własnej ramki, okrągły)
  · **pole (bare `SmartTextarea`, flex-1, min-w-0)** · **mikrofon dyktowania** (z `SmartTextarea`) ·
  **okrągłe kółko trybu rozmowy głosowej** (wypełnione `var(--accent-blue)`, ikona fali/mikrofonu; w
  trybie aktywnym — stan „stop") · **Wyślij/Stop** (pojawia się przy treści).
- `SmartTextarea` — dodać **opcjonalny prop `bare?: boolean`** (domyślnie `false` → zero zmian dla
  pozostałych konsumentów: tasks/notes/itd.). W trybie `bare`: brak zewnętrznej ramki/tła/box-shadow,
  brak dolnej podpowiedzi „Ctrl+Enter aby wysłać", tło transparentne, minimalny padding — pole „wtapia
  się" w pigułkę. Wbudowany mikrofon dyktowania + różdżka („voice_modify") pozostają — to jest
  „mikrofon (dyktowanie)" z referencji; w `bare` renderowane kompaktowo, płasko (bez pudełek).
- **Zero utraty funkcji:** `Wyślij`/`Stop` (`handleSend`/`stopGeneration`), popover `+`
  (Zdjęcie → `onPickImage`; Stałe preferencje → panel), dyktowanie do pola, włączanie/wyłączanie trybu
  rozmowy głosowej (`toggleVoice`) — wszystko zachowane (AC-7). Ikona kółka: użyć dostępnej ikony
  falowej z `lucide-react` (`AudioLines`; jeśli brak w wersji — `Mic`), w geście dotknięcia dalej
  woła `primeSpeech()` + `startListening()`.
- **Pasek stanu rozmowy głosowej** (nad pigułką, nie-zasłaniający) zostaje; lekko dostrojony do nowej
  estetyki (bez zmian logiki).
- **Mobile-first (C-31):** pigułka `w-full`, pole `flex-1 min-w-0` (szerokie, jak w referencji),
  przyciski `flex-shrink-0`, cele dotyku ≥ 40×40; nic nie wychodzi poza szerokość na iPhone. Sheet
  pozostaje `hidden`-agnostyczny (to overlay, nie sidebar).

### 5b. Ograniczenie mowy karty akcji (AC-8)
- W sterowniku pętli (`useEffect` na `[turns, busy, voiceState]`, gałąź `last.kind === "plan"`):
  zamień długi `voiceAnnounce("Przygotowałem N … Powiedz „zatwierdź", „odrzuć" …")` na **krótki**
  komunikat bez instrukcji obsługi, np. `Przygotowałem ${n} ${n===1?"akcję":"akcji"}.` (albo nic).
  Instrukcje/przyciski na **karcie zostają wizualnie** (`TurnView`/`ActionDrawer` bez zmian).
  Zostawiamy sensowną notkę bezpieczeństwa dla planów wyłącznie destrukcyjnych (obecne
  „Te akcje są nieodwracalne — potwierdź je na karcie." w `quickConfirmPlan`).

### 5c. Wybór głosu w ustawieniach czatu (AC-9, AC-10)
- **`src/lib/tts.ts`** (rozszerzenie API, publiczne `speak()` bez zmian sygnatury):
  - `getAvailableVoices(): SpeechSynthesisVoice[]` — `window.speechSynthesis.getVoices()` (po
    `warmVoices()`), bezpieczny gdy pusto.
  - `onVoicesChanged(cb): () => void` — subskrypcja `voiceschanged` (do odświeżenia listy w UI przy
    asynchronicznym ładowaniu na iOS/Safari); zwraca funkcję odpięcia.
  - `setPreferredVoiceURI(uri: string | null)` — zapis do zmiennej modułowej **oraz** `localStorage`
    (`omnia.aiVoice`).
  - `getPreferredVoiceURI(): string | null` — leniwy odczyt z `localStorage` przy pierwszym użyciu
    (żeby wybór działał także bez zamontowanego arkusza).
  - `speak()` — po zbudowaniu `utterance`: jeśli jest preferowany `voiceURI` i **istnieje** w
    `getVoices()`, ustaw `u.voice`; w przeciwnym razie **nie** ustawiaj (bezpieczny powrót do
    domyślnego — AC-10). `u.lang` zostaje jak dziś, gdy brak wybranego głosu.
- **`AICommandSheet.tsx`** — panel ustawień czatu (istniejący `showPrefs`, dziś „Stałe preferencje"):
  rozszerzyć o **selektor głosu** (`<select>` / lista) zasilany `getAvailableVoices()`, subskrybujący
  `onVoicesChanged`. Wybór → `setPreferredVoiceURI(voiceURI)`. Etykieta i opcje po polsku (C-32), np.
  „Głos lektora" + „(domyślny przeglądarki)" jako pozycja zerowa. Stylizacja zmiennymi CSS. (Panel
  można podpiąć pod ten sam wpis w popoverze „+", przemianowany np. na „Ustawienia asystenta", albo
  osobny wpis „Głos" — decyzja implementacyjna, byle po polsku i spójnie.)
- Podgląd/„Przetestuj głos": opcjonalny mały przycisk `speak("Testowy głos asystenta.", "pl")` —
  nice-to-have; nie jest wymagany przez AC.

## 6. AI / integracje (C-23, C-40)
- **Brak nowych `AIAction`** → `check:actions` zielone (C-23). Reużywamy istniejące typy i executory.
- **Routing modeli (C-40)** bez zmian — dalej `op:"dispatch"` (fast-path/router) i `op:"reasoning"`
  (pętla agenta). „Query-first" = zachowanie promptu, nie nowy provider.
- Kalendarz/powiadomienia/trash/auto-expense — nie dotyczy.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `src/lib/ai/fastPath.ts` | edycja | Strażnik intencji odczytu (regex→complex), strażnik pustego payloadu, nazwany-kontener→complex dla `add_item`, wzmocniony `SYSTEM_PROMPT` (pkt 3) — AC-1/2/5 |
| `src/app/api/llm/home/agent/route.ts` | edycja | `buildSystemPrompt`: reguły QUERY-FIRST i SZANUJ NAZWANY KONTENER (pkt 3) — AC-2/3/5 |
| `src/components/ui/SmartTextarea.tsx` | edycja | Nowy opcjonalny prop `bare` (bez ramki/tła/stopki) do wtopienia w pigułkę — AC-6/7 |
| `src/components/home/AICommandSheet.tsx` | edycja | Composer-pigułka (5a), skrócona mowa karty (5b), selektor głosu w ustawieniach (5c) — AC-6/7/8/9/10 |
| `src/lib/tts.ts` | edycja | `getAvailableVoices`/`onVoicesChanged`/`setPreferredVoiceURI`/`getPreferredVoiceURI` + użycie wybranego głosu w `speak()` — AC-9/10 |
| `doświadczenia.md` | dopisanie | Lekcje z wdrożenia (C-51) — jeśli po drodze naprawimy nieoczywisty błąd |

## 8. Bramki i weryfikacja (C-50)
- **Lokalnie (C-13):** nie odpalamy `npm run build` z prod `DATABASE_URL`; weryfikacja **do kroku
  `next build`**. Brak migracji → nie ruszamy bazy. Sekwencja:
  `npm run check:migrations` (zielone — 0 nowych migracji) → `npm run check:actions` (zielone — 0
  nowych `AIAction`) → `npx next lint --dir src` → `npx next build`.
- **Mapowanie AC → weryfikacja:**
  - AC-1/AC-2 — ręcznie: „podaj mi zadanie…", „ile mam zadań…", „pokaż moje notatki…" → `query`+`answer`,
    zero karty tworzącej. Wsparcie: strażnik regex w `fastPath` (unit-owalny czysto logicznie) +
    reguła promptu.
    (Weryfikacja live na `develop`, bo klasyfikacja zależy od LLM — patrz §9.)
  - AC-3 — inspekcja: read-toole wołane z parametrami (`status/search/limit`), nie „pełny dump"; prompt
    wymusza filtrowanie po stronie narzędzia.
  - AC-4 — inspekcja kodu: `READ_TOOLS_PROMPT` zawsze wstrzykiwany; lista `READ_TOOL_NAMES` pokrywa
    katalog modułów.
  - AC-5 — „dodaj mleko do listy Apteka" → pozycja na „Apteka" (fast-path oddaje do agenta, agent
    wypełnia `listName`, `resolveOrCreateList` trafia w listę). Test na `develop`.
  - AC-6/AC-7 — wizualnie (desktop + iPhone/responsywnie): pigułka, `+`, szerokie pole, mikrofon,
    kółko; działają Wyślij/Stop/„+"/dyktowanie/tryb głosowy.
  - AC-8 — tryb głosowy: po powstaniu karty brak recytowania instrukcji (najwyżej „przygotowałem N akcji").
  - AC-9/AC-10 — ustawienia: lista głosów (także gdy ładują się async), wybór zapamiętany po reloadzie,
    odczyt używa wybranego głosu; brakujący głos → domyślny bez błędu.
  - AC-11 — regresja pętli głosowej (Chrome + iOS/Safari): nasłuch→myślę→mowa→nasłuch bez zacięć;
    korekta głosem działa.

## 9. Ryzyka techniczne i plan wycofania
- **Klasyfikacja zależy od LLM** — deterministyczny strażnik regex w `fastPath` obniża ryzyko dla
  najczęstszych fraz odczytu; resztę łapie wzmocniony prompt. Pełna pewność tylko po teście na
  `develop` (test env). Rollback: rewert zmian w `fastPath.ts`/`agent/route.ts` (czysto tekstowe).
- **`bare` w `SmartTextarea` mogłoby zepsuć innych konsumentów** — dlatego prop **domyślnie `false`**;
  ścieżka bez `bare` = 1:1 dotychczasowa. Rollback: usunąć gałąź `bare`.
- **Głosy async na iOS/Safari** — UI subskrybuje `voiceschanged`; pusty start = tylko „(domyślny)”,
  lista dopełnia się po zdarzeniu; `speak()` z nieobecnym `voiceURI` → domyślny (bez wyjątku).
- **Regresja composera (utrata funkcji)** — AC-7/AC-11 pilnują; zmiana jest layoutowa, handlery bez
  zmian. Rollback: przywrócić poprzedni blok JSX composera.
- Brak zmian bazy → **brak ryzyka migracyjnego**; rollback = wyłącznie rewert kodu (por. runbook
  devops, ścieżka „code rollback").

## 10. Zgodność z konstytucją — checklista
- [x] **C-10..C-14 (migracje):** brak zmian schematu → brak migracji; `check:migrations` zielone.
- [x] **C-20:** brak nowych mutacji poza istniejącymi executorami (Server Actions nietknięte).
- [x] **C-21:** read-toole i executory respektują `ownerId`/`ownerTeamId` — bez zmian.
- [x] **C-22:** brak nowych slugów/uprawnień; feature w `module.home`.
- [x] **C-23:** zero nowych `AIAction` → `check:actions` zielone.
- [x] **C-30:** wyłącznie zmienne CSS (`var(--bg-elevated)`, `var(--accent-blue)`, `var(--on-accent)`),
      zero hardcodowanych hexów; kółko trybu głosowego = `var(--accent-blue)` + `var(--on-accent)`.
- [x] **C-31:** mobile-first (pigułka `w-full`, pole `flex-1`, cele ≥40px); overlay, nie sidebar.
- [x] **C-32:** wszystkie nowe teksty po polsku.
- [x] **C-40:** routing modeli DB-driven bez zmian (dispatch/reasoning).
- [x] **C-53 (minimalizm):** brak nowych zależności/abstrakcji; `bare` opt-in; reużycie istniejących
      read-tooli/executorów zamiast dodawania nowych.
