# Weryfikacja: Asystent AI — katalog syntezy mowy, cykl życia czatu i domknięcie usterek UX

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-07-26
- **Środowisko:** lokalny PostgreSQL 16 (`omnia_dev` na `127.0.0.1:5432`) — **nigdy** prod DB (C-13)

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ `Numeracja migracji OK (następny wolny numer: 0211)` |
| `npm run check:actions` | ✅ `160 akcji w katalogu, wszystkie obsługiwane przez executor i opisane w kontrakcie` |
| `npm run check:ai-coverage` | ✅ `500 akcji z zadeklarowanym zakresem i guardem`; `MUTACJE 159 ai/0 pending/190 excluded · ODCZYTY 64 ai/0 pending/87 excluded` |
| `npx tsc --noEmit` | ✅ bez błędów |
| `npx next lint --dir src` | ✅ **0 błędów**, 16 ostrzeżeń — wszystkie zastane (`exhaustive-deps`, `no-img-element`), **żadne w plikach tej paczki** |
| `npx next build` | ✅ `Compiled successfully`, `Generating static pages (131/131)` |
| `npx prisma migrate deploy` | ✅ `0210_ai_conversation_draft` zaaplikowana |
| `npm run test:unit` | ✅ **512/512** (w tym 32 nowe: 12 adaptery/katalog TTS, 10 `refResolve`, 10 `agentPartialRun`+`truncation`) |

`scripts/migrate.js` (ostatni krok `npm run build`) **nie był uruchamiany** — rusza bazę; weryfikowano do
kroku `next build` włącznie (C-13, C-50).

## 2. Kryteria akceptacji

### Synteza mowy (Z-4)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** dropdowny zamiast pola tekstowego | ✅ | `SpeechAssignmentRow.tsx` — trzy `<select>` (dostawca/model/głos); `LlmConfigPanel.tsx:~560` kieruje `operationType === "speech"` do tego wiersza, więc pole tekstowe na model dla lektora **nie jest już renderowane** |
| **AC-2** koszt / klucz / jakość polskiego | ✅ | Uruchomione: katalog ma **5 dostawców**, każdy z `costHint`/`requiresKey`/`polishHint` (test `katalog: każda pozycja ma…`); uczciwość sprawdzona osobno — Groq PlayAI ma w `polishHint` „**SŁABY** do polskiego… głosy są angielskie" |
| **AC-3** uzupełnienie klucza na tym samym ekranie | ✅ | `SpeechAssignmentRow.tsx` — pole klucza renderowane przy `needsKey`, zapis przez `applySpeechProvider`; walidacja odrzuca model spoza listy dostawcy i nieznaną pozycję katalogu (uruchomione, oba ✅). Nowy dostawca wymagający klucza bez klucza → jawny błąd |
| **AC-4** próbka głosu | ✅ | `playSample()` → `POST /api/tts`; `501` → „Lektor nie jest jeszcze skonfigurowany", inne → „Nie udało się odtworzyć próbki". Treść błędu dostawcy nie wychodzi do klienta (`serverTts.ts` rzuca własnym komunikatem ze samym statusem) |
| **AC-5** każdy obsługiwany dostawca faktycznie czyta | ✅ (z zastrzeżeniem, p. 5) | **End-to-end przez lokalny serwer-atrapę**: dla wszystkich czterech rodzajów adapterów `synthesizeSpeech` trafia we właściwy adres, przekazuje klucz właściwym kanałem i odczytuje audio: `openai_compat → /v1/audio/speech`, `elevenlabs → /v1/text-to-speech/<voice>`, `google_tts → /v1/text:synthesize?key=…` (dekodowanie base64), `azure_tts → /cognitiveservices/v1` (SSML). Escapowanie potwierdzone na żywym żądaniu: `Dzień dobry &amp; &lt;test&gt;` |
| **AC-6** brak przypisania = głosy przeglądarki | ✅ | Uruchomione: `isServerSpeechConfigured() === false`, `synthesizeSpeech() === null`, `configuredSpeechVoices() === null`; `/api/tts` oddaje wtedy `501` (bez zmian wobec 031) |
| **AC-7** lista głosów podąża za dostawcą | ✅ | Uruchomione: przy dostawcy `azure_tts` `configuredSpeechVoices()` zwraca `pl-PL-ZofiaNeural, pl-PL-AgnieszkaNeural, pl-PL-MarekNeural` i **nie** zwraca `nova`. Obcy głos na wejściu → dostawca dostaje `pl-PL-ZofiaNeural` (potwierdzone treścią żądania), nie błąd |

### Pętla agenta (Z-2)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-8** odwołanie po nazwie zwraca dane | ✅ | Uruchomione na bazie: `list_items {listId:"moje"}` → pozycja „łosoś" (wcześniej `[]`); `get_task {taskId:"Zadanie testowe"}` → zadanie; `get_note {noteId:"Notatka o kluczach"}` → notatka; dopasowanie częściowe `listId:"kocoń"` → pozycje listy „Katowice -> Kocoń". **Regresje**: prawdziwe id nadal działa dla `list_items`/`get_note`, a `list_tasks {projectId:"Omnia"}` zachowuje się jak przed zmianą |
| **AC-9** brak / wiele dopasowań → jednoznaczna informacja | ✅ | Uruchomione: `listId:"Rower"` → „Nie znaleziono **listy zakupów** o nazwie „Rower". Dostępne: moje, Katowice, Katowice -> Kocoń."; `listId:"kato"` → „Nazwa „kato" **pasuje do kilku pozycji**: Katowice, Katowice -> Kocoń."; `projectId:"NieMa"` → komunikat dla projektów bez zmian |
| **AC-10** przerwanie bezowocnej pętli | ✅ | Przegląd kodu: `route.ts:738` `gainedSomething` (wywołanie wykonane i bez błędu), `:753` przerwanie przy `unproductiveIterations >= 2` z logiem ostrzegawczym. Liczbowo dla przebiegu z Z-2 (jeden przebieg, bez fallbacku — patrz niżej): ≤ 3 wywołania + 1 podsumowanie zamiast 6 wywołań bez wyniku. Zastrzeżenie efektywnościowe w p. 3 |
| **AC-11** użyteczny komunikat przy niedokończeniu | ✅ | Testy `agentPartialRun`: komunikat zawiera liczbę udanych odczytów, przyczynę (ucięcie → ostatni błąd narzędzia → brak postępu → brak kroków) i podpowiedź „jedną rzecz naraz"; test wprost sprawdza, że **nie** zawiera frazy o „limicie kroków". Ścieżka główna to podsumowanie modelem (`summarizePartialRun`, `route.ts:831`) |
| **AC-12** scenariusz Z-2 kończy się odpowiedzią | ⚠️ nie do sprawdzenia lokalnie | Wymaga żywego modelu i danych właściciela. Wszystkie **trzy** przyczyny z przebiegu Z-2 są usunięte (rozpoznanie ucięcia, przerwanie pętli, sensowne zamknięcie), ale samego przebiegu nie odtworzyłem — do potwierdzenia na `develop` |
| **AC-28** ucięcie rozpoznane jako ucięcie | ✅ | Testy `truncation`: `finish_reason:"length"` i `stop_reason:"max_tokens"` → `true`; `stop`/`end_turn`/`null` → `false`. Przegląd ścieżki: `route.ts:641` jedna próba (`truncationRetries > 1` → wyjście), komunikat korekcyjny mówi o **ucięciu**, nie o JSON-ie (`:646`); wyjście dokleja adnotację „Odpowiedź była zbyt długa…" (`:672`) |

### Panel akcji (Z-5)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-13** parametry pomocnicze ukryte przed nie-adminem | ✅ | `ActionDrawer.tsx:488,498` — oba bloki („Szczegóły techniczne" i sam wiersz) za `isAdmin &&`, więc dla zwykłego użytkownika nie ma ich w drzewie |
| **AC-14** admin: dostępne, domyślnie zwinięte | ✅ | `techExpanded` startuje jako pusty `Set` (`:149`), wiersz renderowany dopiero przy `techExpanded.has(action.id)` (`:498`) |
| **AC-15** długa wartość nie wychodzi poza obszar | ✅ | `:415` i `:499` — `flexWrap:"wrap"` + `minWidth:0` na wierszu, `overflowWrap:"anywhere"` na etykiecie, `minWidth:0` na polu (bez tego input trzymał naturalną szerokość i rozpychał kartę). `grep "rgba(245"` → **0 trafień** (hex → `var(--accent-amber)`) |

### Listy rozwijane i ustawienia (Z-1, Z-3)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-16 / AC-17** menu w obszarze ekranu | ✅ | `AICommandSheet.tsx:1854` — `right: 0, left: "auto"` (przycisk siedzi w prawej grupie kompozytora, więc menu rozwija się w stronę środka) + zachowane `maxWidth: min(300px, calc(100vw - 40px))`. Audyt: drugi popover w pliku był już kotwiczony `right: 0` |
| **AC-18** usunięta podpowiedź | ✅ | `grep -rn "Zapisywane na Twoim koncie" src/` → **0 trafień** |

### Klawiatura i cykl życia rozmowy (Z-6)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-19** pierwsze dotknięcie odpala akcję | ✅ kod / ⚠️ bez testu na urządzeniu | `keepKeyboardOpen` (`preventDefault` na `pointerdown`) na 5 przyciskach: aparat, galeria, poziom pracy, mikrofon dyktowania, wysyłka. Zachowania na realnym Safari/iOS nie dało się sprawdzić w tym środowisku |
| **AC-20** jedno dotknięcie wysyła i zwija klawiaturę | ✅ kod / ⚠️ jak wyżej | `:1908` — `onPointerDown={keepKeyboardOpen}` + `onClick={() => { dictation.stop(); handleSend(); composerRef.current?.blur(); }}` |
| **AC-21** sekcje zwijają się przy zmianie rozmowy | ✅ | `collapseSections()` (`:874`) wołane w `resetConversation` (`:883`), `handleClose` (`:906`) i `loadConversation` (`:1400`) |
| **AC-22** zamknij/otwórz → nowa rozmowa | ✅ | `handleClose` (`:904`) czyści wątek gdy `turnsRef.current.length > 0` i zapamiętuje poprzednią rozmowę |
| **AC-23** pusta rozmowa reużyta | ✅ | Ten sam warunek — brak tur = brak czyszczenia; dodatkowo `AiConversation` powstaje dopiero przy pierwszej wiadomości (`createAiConversation` w `handleSend`), więc pusta rozmowa fizycznie nie trafia do historii |
| **AC-24** jedno dotknięcie wraca do poprzedniej | ✅ | `:1524` — przycisk widoczny przy `lastConversationId && turns.length === 0`, etykieta z pierwszej wypowiedzi (`conversationLabelFrom`), `minHeight: 38` (C-31), pełny tytuł w `title`/`aria-label` |
| **AC-25** brudnopis wraca do pola | ✅ | Zapis: debounce 2 s (`:807`) + jawnie w `resetConversation`/`handleClose`/`loadConversation`. Odczyt: `:1441` `setInputText(convo.draft ?? "")` |
| **AC-26** brudnopis wraca na innym urządzeniu | ✅ | Uruchomione na bazie: zapis do `AiConversation.draft` i odczyt tej samej wartości przez zapytanie z `userId` (czyli przez to samo konto, niezależnie od przeglądarki) |
| **AC-27** po wysłaniu pole puste | ✅ | `handleSend` `:1207` i `:1212` — `saveDraftNow("")` z **jawną** wartością, bo `inputTextRef` nie zdążyłby się odświeżyć po `setInputText("")` |

**Podsumowanie:** 26 × ✅, 2 × ⚠️ (AC-12 wymaga żywego modelu; AC-19/AC-20 kodowo spełnione, bez testu
na realnym iOS), 0 × ❌.

## 3. Ustalenia (nie-blokujące, do rozstrzygnięcia w recenzji)

- **U-1 — zmarnowane wywołanie podsumowania przy fallbacku `dispatch→reasoning`.**
  `summarizePartialRun` wykonuje **jedno dodatkowe wywołanie modelu** na końcu każdego niedokończonego
  przebiegu. Dla *prostej tury odczytowej* (`isSimpleRead`) istniejący od 030 fallback ponawia przebieg
  na `reasoning` (`route.ts:1067-1072`), więc podsumowanie pierwszego przebiegu **jest odrzucane** —
  płacimy za nie bez korzyści. Skala: dotyczy wyłącznie prostych tur odczytowych, które się nie domknęły.
  Bilans i tak jest lepszy niż przed zmianą (≈3+1+3+1 = 8 wywołań wobec ≈6+6 = 12), więc **nie jest to
  regresja** — ale w feature'rze o koszcie warto to domknąć (np. podsumowanie tylko gdy przebieg jest
  ostateczny). Nie dotyczy scenariusza Z-2: fraza „dlaczego" trafia w `SIMPLE_READ_ANALYTIC_RE`, więc
  `isSimpleRead` jest fałszywe i fallbacku nie ma.
- **U-2 — ucięcie, które mimo wszystko sparsowało się.** Gdy odpowiedź została ucięta, ale
  `extractJsonLoose` zdołał wyłuskać obiekt protokołu, idziemy dalej normalnie z (możliwie niepełną)
  treścią. Świadome: mamy użyteczny krok, więc lepiej go oddać niż wymuszać powtórkę.

## 4. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01, C-02 | ✅ zmiany wyłącznie w `worldofmag/`; importy przez `@/*` |
| C-10, C-11 | ✅ ręczny plik `0210_ai_conversation_draft/migration.sql`, numer z `next:migration`, `check:migrations` zielone, nazwa nietknięta po zaaplikowaniu |
| C-12 | ✅ `LlmProvider.kind` pozostaje `String` + union TS (`PROVIDER_KINDS`) — **żadnego enuma Prisma** |
| C-13 | ✅ wszystko przeciw lokalnemu Postgresowi; `migrate.js` nie uruchamiany |
| C-20 | ✅ `saveConversationDraft` i `applySpeechProvider` to Server Actions z `revalidatePath` |
| C-21 | ✅ uruchomiony test guardu: zapis brudnopisu do **cudzej** rozmowy zmienia **0 wierszy** (`updateMany` z `userId` z sesji), bez potwierdzania istnienia rozmowy |
| C-22 | ✅ bez nowych slugów; różnicowanie panelu akcji na istniejącym `isAdmin`; konfiguracja lektora za `requireAdmin()` |
| C-23 | ✅ zero nowych `AIAction`; `check:actions` zielone |
| C-25 | ✅ `logAudit("config", "llm_speech.set", …)` przy zmianie lektora |
| C-30 | ✅ usunięty jedyny hardcodowany hex w dotkniętym obszarze (`rgba(245,158,11,0.4)` → `var(--accent-amber)`); nowy komponent bez hexów |
| C-31 | ✅ menu mieści się w viewporcie, cel dotyku przycisku powrotu 38 px, panel lektora jednokolumnowy na wąskim ekranie |
| C-32 | ✅ wszystkie nowe teksty po polsku (katalog, komunikaty błędów, panel) |
| C-40 | ✅ katalog to **słownik podpowiedzi**, nie konfiguracja — dobór dostawcy/modelu nadal z bazy przez `resolveLlmChain` |
| C-41 | ✅ klucze szyfrowane (`encryptSecret`), w DTO tylko `hasKey`; treść błędu dostawcy nie wychodzi do klienta; klucz Google w query stringu nie jest logowany |
| C-50 | ✅ patrz p. 1 |
| C-51 | ✅ trzy wpisy w `doświadczenia.md` (ucięcie ≠ zły format, `*Id` przyjmujący nazwę, `pointerdown` a klawiatura) |
| C-53 | ✅ zero nowych zależności; różnice pięciu dostawców w jednym `switch`; jedna kolumna w bazie; `Config` zamiast kolumny w `LlmAssignment` |
| C-54 | ✅ trzy korekty artefaktów w górę łańcucha (przyczyna Z-2 + AC-28 w specu; zakres audytu tooli i sposób weryfikacji AC-10/12/28 w planie) |

## 5. Ograniczenia weryfikacji (uczciwie)

- **Realnych dostawców syntezy mowy nie sprawdzono na żywo** — brak płatnych kont dla OpenAI,
  ElevenLabs, Google i Azure w tym środowisku. Sprawdzono: (a) 12 testów kontraktu żądania,
  (b) **end-to-end przez lokalny serwer-atrapę** dla wszystkich czterech adapterów (adres, kanał
  klucza, kształt treści, dekodowanie odpowiedzi, escapowanie SSML). Niesprawdzone pozostaje jedynie,
  czy **prawdziwe** API każdego dostawcy zaakceptuje nasz payload — to ryzyko odnotowane już w specu §9.
- **AC-12** (pełny scenariusz Z-2) wymaga żywego modelu i danych właściciela → do potwierdzenia na
  środowisku testowym po merge.
- **AC-19/AC-20** (klawiatura mobilna) weryfikowane kodowo; realnego Safari/iOS nie ma w środowisku.

## 6. Regresje

Sprawdzone celowo:
- ✅ **Migracja addytywna** — `draft` jest nullowalna, starszy kod działa z nową kolumną.
- ✅ **Rozwiązywanie nazw nie psuje id** — prawdziwe identyfikatory nadal działają (uruchomione dla
  `list_items`, `get_note`, `list_tasks`); kolejność w `matchNamedRef` stawia id na pierwszym miejscu.
- ✅ **Naprawiona luka zastana** — pusta referencja przechodziła przez `includes("")` i przy jednym
  kandydacie rozwiązywała się „na oślep"; test `pusta referencja nie dopasowuje się do wszystkiego`.
- ✅ **Dostawca tylko-TTS nie trafia do czatu** — `resolveLlmChain("reasoning")` go pomija (uruchomione,
  łańcuch pusty + ostrzeżenie w logu), a `setAssignment` odrzuca takie przypisanie.
- ✅ **`getSpeechOptions`** — brak przypisania nadal daje `serverAvailable: false` i pustą listę.
- ❌ **`handleClose` nie przerywa trwającego generowania** — patrz niżej.

### Braki do poprawy

- **B-1 (blokujące) — zamknięcie asystenta w trakcie generowania zostawia „sierotę".**
  `handleClose` (`AICommandSheet.tsx:904`) czyści wątek i `conversationId`, ale **nie przerywa**
  trwającego żądania: `abortRef.current?.abort()` jest tylko w `stopGeneration` i w efekcie odmontowania
  (`:687`), a komponent siedzi w `AppShell` i nigdy się nie odmontowuje. Skutek po zmianie T-12:
  użytkownik zamyka asystenta podczas „myślę", odpowiedź przychodzi po chwili i zostaje dopisana do
  **świeżo wyczyszczonego** wątku — a `convoIdRef` jest już `null`, więc `persist()` jej nie zapisze.
  Po ponownym otwarciu widać osieroconą wypowiedź asystenta w rzekomo nowej rozmowie, której nie ma
  w historii. Przed T-12 było to nieszkodliwe (wątek zostawał, tura trafiała tam, gdzie należy, i była
  zapisywana), więc jest to **regresja wprowadzona w tej paczce**.
  *Naprawa:* w `handleClose` przerwać żądanie przed czyszczeniem wątku (`abortRef.current?.abort()`,
  `abortRef.current = null`, `setBusy(false)`) — analogicznie do `stopGeneration`, ale bez powrotu do
  nasłuchu głosowego, bo asystent się zamyka.

## 7. Werdykt końcowy

**DO POPRAWY** — jedno konkretne, blokujące ustalenie: **B-1** (regresja wprowadzona przez T-12).
Wszystkie 28 kryteriów akceptacji jest spełnionych lub potwierdzonych kodowo, bramki są zielone, a
zgodność z konstytucją bez naruszeń — ale nie wypuszczamy zmiany, która potrafi zostawić w czacie
niezapisaną, osieroconą odpowiedź.

Ustalenia **U-1** i **U-2** są nie-blokujące i przechodzą do recenzji.
