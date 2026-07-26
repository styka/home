# Zadania: Asystent AI — katalog syntezy mowy, cykl życia czatu i domknięcie usterek UX

- **Plan:** ./plan.md (032-asystent-tts-katalog-i-ux-czatu)
- **Status:** todo
- **Data:** 2026-07-26

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami** (migracja → akcje → UI → AI → bramki). Każde zadanie jest małe, samodzielne i
> **weryfikowalne**. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Drobne, samodzielne poprawki UI (bez zależności)

- [x] **T-1** `[P]` — Usuń z panelu ustawień asystenta akapit „Zapisywane na Twoim koncie — widoczne
  na każdym urządzeniu. Zmiany zapisują się automatycznie." (`AICommandSheet.tsx`, ~1486). Reszta
  panelu bez zmian.
  **Gotowe, gdy:** `grep -rn "Zapisywane na Twoim koncie" src/` nie ma trafień, a panel ustawień
  renderuje się bez luki w układzie. *(AC-18)*

- [x] **T-2** `[P]` — Napraw wychodzenie menu poziomu pracy poza ekran: w menu (`AICommandSheet.tsx`,
  ~1736) zamień `left: 0` na `right: 0` + `left: "auto"`. Zaudytuj pozostałe menu/rozwinięcia w
  kompozytorze tym samym kluczem (kotwica po tej stronie, po której jest przycisk).
  **Gotowe, gdy:** przy viewporcie 375 px całe menu (obie opcje + opisy) mieści się w obszarze ekranu,
  na desktopie bez regresji. *(AC-16, AC-17)*

- [x] **T-3** `[P]` — `ActionDrawer.tsx`: napraw przepełnienie wiersza parametru — `minWidth: 0` na
  kontenerze flex, `flexWrap: "wrap"` dla pary etykieta/wartość, `overflowWrap: "anywhere"` na
  wartościach. Przy okazji zamień hardcodowany `rgba(245,158,11,0.4)` na `var(--accent-amber)`
  (naruszenie C-30).
  **Gotowe, gdy:** parametr o wartości 200 znaków nie powoduje przewijania poziomego karty na
  viewporcie 375 px; `grep -n "rgba(245" src/components/home/ActionDrawer.tsx` bez trafień. *(AC-15)*

- [x] **T-4** — `ActionDrawer.tsx`: schowaj parametry pomocnicze. Blok „Szukana nazwa" renderowany
  **tylko** przy `isAdmin`, wewnątrz nowego, domyślnie **zwiniętego** pod-rozwinięcia „Szczegóły
  techniczne" w sekcji „Parametry". Dla nie-admina — brak w drzewie.
  **Gotowe, gdy:** render z `isAdmin={false}` nie zawiera frazy „Szukana nazwa"; z `isAdmin={true}`
  zawiera ją po rozwinięciu, a przed rozwinięciem nie. *(AC-13, AC-14)*

---

## Faza 1 — Fundament danych

- [x] **T-5** — Migracja `prisma/migrations/0210_ai_conversation_draft/migration.sql`:
  `ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "draft" TEXT;`
  **Gotowe, gdy:** `npm run check:migrations` przechodzi (numer 0210 bez kolizji) i
  `npx prisma migrate deploy` na lokalnym Postgresie kończy się sukcesem. *(baza dla AC-25..AC-27)*

- [x] **T-6** — `prisma/schema.prisma`: `draft String?` w `model AiConversation` (zgodnie z DDL z T-5).
  **Gotowe, gdy:** `npx prisma generate` czysto, `AiConversation.draft` widoczne w typach klienta.

---

## Faza 2 — Warstwa serwera

- [ ] **T-7** — `src/actions/aiConversations.ts`: nowa akcja `saveConversationDraft(id, draft)` —
  `requireAuth()`, `updateMany({ where: { id, userId: user.id } })`, przycięcie do 4000 znaków,
  `revalidatePath("/")`. Rozszerz DTO `getAiConversation` o `draft: string | null`.
  **Gotowe, gdy:** próba zapisu brudnopisu do cudzej rozmowy nie zmienia żadnego wiersza i nie
  ujawnia jej istnienia; `getAiConversation` zwraca `draft`. *(C-20, C-21; AC-25..AC-27)*

- [ ] **T-8** — `src/lib/ai/action-coverage.json`: wpis dla `saveConversationDraft`
  (`access: "self"`, klasyfikacja `excluded` + powód: brudnopis pola wiadomości to stan UI czatu, nie
  dane do zarządzania przez asystenta).
  **Gotowe, gdy:** `npm run check:ai-coverage` przechodzi. *(bramka C-50)*

- [ ] **T-9** `[P]` — `src/lib/llm/resolver.ts`: rozszerz union `ProviderKind` o
  `"elevenlabs" | "google_tts" | "azure_tts"`; w `resolveLlmChain` **pomiń** dostawców tylko-TTS dla
  operacji `op !== "speech"` (pierwsza z dwóch barier chroniących `chatComplete`).
  **Gotowe, gdy:** `resolveLlmChain("reasoning")` nie zwraca dostawcy o `kind` tylko-TTS, nawet gdy
  administrator go tam przypisał; `tsc --noEmit` czysto.

---

## Faza 3 — Czat asystenta: klawiatura i cykl życia rozmowy

- [ ] **T-10** — `AICommandSheet.tsx`: obsługa klawiatury mobilnej. Przyciski dolnego wiersza
  kompozytora (aparat, galeria, poziom pracy, mikrofon) dostają
  `onPointerDown={(e) => e.preventDefault()}` — fokus zostaje w polu, klawiatura nie zwija się, akcja
  odpala się przy pierwszym dotknięciu. Przycisk wysyłania: to samo + jawne `composerRef.current?.blur()`
  po wysłaniu.
  **Gotowe, gdy:** z fokusem w polu jedno dotknięcie mikrofonu/aparatu uruchamia akcję i nie zwija
  klawiatury; jedno dotknięcie wysyłania wysyła **i** zwija klawiaturę; na desktopie kliknięcia
  działają bez zmian. *(AC-19, AC-20)*

- [ ] **T-11** — `AICommandSheet.tsx`: wspólna `collapseSections()` (`showPrefs`, `showReport`,
  `reportDone`, `showLevelMenu`) wołana w `resetConversation()`, `loadConversation()` i `handleClose()`.
  **Gotowe, gdy:** rozwinięte ustawienia / formularz zgłoszenia zwijają się przy „Nowej rozmowie",
  przełączeniu na rozmowę z historii i zamknięciu asystenta. *(AC-21)*

- [ ] **T-12** — `AICommandSheet.tsx`: cykl życia rozmowy. Nowy stan `lastConversationId`;
  `handleClose()` → `saveDraftNow()` → `collapseSections()` → gdy `turns.length > 0`:
  `setLastConversationId(conversationId)` + `resetConversation()`. Rozmowa bez tur zostaje
  (nie tworzymy pustych wpisów — `AiConversation` i tak powstaje dopiero przy pierwszej wiadomości).
  **Gotowe, gdy:** rozmowa z wiadomością → zamknij/otwórz → pusty wątek, a poprzednia jest w historii;
  rozmowa pusta → zamknij/otwórz → brak nowego wpisu w historii. *(AC-22, AC-23)*

- [ ] **T-13** — `AICommandSheet.tsx`: jednoprzyciskowy powrót do ostatniej rozmowy w nagłówku
  arkusza (ikona `CornerUpLeft` + skrócony tytuł, ~18 znaków, pełny w `title`/`aria-label`), widoczny
  tylko gdy `lastConversationId` istnieje i bieżący wątek jest pusty. Klik → `loadConversation(...)`.
  Cel dotyku ≥ 38 px, jeden wiersz nagłówka (bez nowej sekcji).
  **Gotowe, gdy:** po otwarciu asystenta widać jeden przycisk z tytułem ostatniej rozmowy i jedno
  dotknięcie ją wczytuje; przy braku historii przycisku nie ma. *(AC-24, C-31)*

- [ ] **T-14** — `AICommandSheet.tsx`: brudnopis. `saveDraftNow()` (zapis tylko gdy jest
  `conversationId` i treść ≠ `lastSavedDraftRef`) wołane w `handleClose()`, przed przełączeniem wątku
  oraz z `useEffect` z debounce 2 s na `inputText`. `loadConversation()` ustawia
  `setInputText(convo.draft ?? "")`. `handleSend()` po udanym wysłaniu zeruje brudnopis.
  **Gotowe, gdy:** wpisany i niewysłany tekst wraca po powrocie do rozmowy — także w drugiej
  przeglądarce na tym samym koncie; po wysłaniu pole jest puste. *(AC-25, AC-26, AC-27)*

---

## Faza 4 — Synteza mowy: katalog, adaptery, panel admina

- [ ] **T-15** — `src/lib/tts/catalog.ts` (nowy): `TTS_CATALOG: TtsProviderSpec[]` z pozycjami
  OpenAI, Groq PlayAI, ElevenLabs, Google Cloud TTS, Azure Speech — każda z `id`, `label`, `kind`,
  `baseUrl`, `models[]`, `voices[]`, `paid`, `costHint`, `requiresKey`, `polishHint`, `setupHint`
  (teksty po polsku, C-32). Helpery: `findTtsProvider`, `voicesForKind`, `isVoiceOfKind`,
  `defaultVoiceForKind`. Groq PlayAI ma w `polishHint` jawnie zapisane, że głosy są angielskie.
  **Gotowe, gdy:** katalog kompiluje się, każda pozycja ma ≥1 model i ≥1 głos, a `tsc --noEmit` czysto.
  *(AC-1, AC-2)*

- [ ] **T-16** — `src/lib/tts/adapters.ts` (nowy): `buildSpeechRequest(kind, cfg, { text, voiceId })`
  → `{ url, init, contentTypeFallback }` oraz `parseSpeechResponse(kind, res)` — jeden `switch` na
  `kind`: `openai_compat` (`/audio/speech`, Bearer), `elevenlabs` (`/text-to-speech/{voiceId}`,
  `xi-api-key`), `google_tts` (`/text:synthesize?key=`, odpowiedź JSON+base64), `azure_tts`
  (`/cognitiveservices/v1`, `Ocp-Apim-Subscription-Key`, SSML z **escapowanym** tekstem).
  **Gotowe, gdy:** testy jednostkowe w `src/lib/ai/__tests__/` (albo obok, zgodnie z układem repo)
  potwierdzają dla każdego z pięciu rodzajów: URL, nagłówki, kształt body/SSML oraz escapowanie
  `& < > "` w SSML. *(AC-5 — dowód kontraktowy dla dostawców bez konta)*

- [ ] **T-17** — `src/lib/tts/serverTts.ts` + `serverVoices.ts`: `synthesizeSpeech` przechodzi na
  `buildSpeechRequest`/`parseSpeechResponse`; `voiceId` walidowany przeciw głosom **skonfigurowanego**
  dostawcy z fallbackiem na jego domyślny. Zachowane: `SPEECH_MAX_CHARS`, `null` przy braku
  przypisania, brak przecieku treści błędu dostawcy (C-41). `serverVoices.ts` zostaje jako głosy
  rodziny OpenAI-compat + niezmienione helpery `SERVER_VOICE_PREFIX`/`toServerVoiceValue`/
  `parseServerVoiceValue`.
  **Gotowe, gdy:** brak przypisania `speech` → `/api/tts` nadal zwraca 501 i klient wraca do głosów
  przeglądarki (bez regresji wobec 031); z kluczem OpenAI odczyt na głos działa. *(AC-5, AC-6)*

- [ ] **T-18** — `src/actions/llmConfig.ts`: `getSpeechConfig()` (katalog + aktualne przypisanie +
  domyślny głos + per pozycja `hasKey`, nigdy klucz — C-41), `applySpeechProvider({ catalogId,
  apiKey?, model, voiceId? })` wzorowane na `applyAnthropicProfile` (upsert `LlmProvider` z danymi
  **z katalogu**, `encryptSecret` tylko gdy klucz podany, upsert `LlmAssignment` dla `"speech"`, zapis
  `speech_default_voice` w `Config`, `logAudit("config", "llm_speech.set", …)`, `revalidatePath`).
  Dodatkowo: `normalizeProviderKind()` używany w `createProvider`/`updateProvider` (dziś zjadałby nowe
  rodzaje) i **guard w `setAssignment`** — dostawca tylko-TTS przypisany do operacji ≠ `speech` → błąd
  (druga bariera do T-9). Wpisy w `action-coverage.json` (`access: "admin"`, `excluded`).
  **Gotowe, gdy:** `npm run check:ai-coverage` i `npm run check:actions` przechodzą; `applySpeechProvider`
  z głosem obcym dostawcy zapisuje głos **domyślny** tego dostawcy, nie obcy. *(AC-3, AC-7, C-25, C-41)*

- [ ] **T-19** — `src/components/admin/SpeechAssignmentRow.tsx` (nowy) + wpięcie w
  `LlmConfigPanel.tsx` (dla `operationType === "speech"`; `KIND_LABELS` o nowe rodzaje). Trzy
  `<select>` (dostawca / model / głos), karta informacyjna (darmowy-płatny + koszt, czy potrzebny
  klucz, jakość polskiego, skąd wziąć klucz), pole klucza **inline** tylko gdy dostawca go nie ma,
  przycisk „Próbka" (`POST /api/tts` z wybranym głosem; 501 → „dostawca nieskonfigurowany", inne →
  „nie udało się odtworzyć próbki"). Kolory wyłącznie ze zmiennych CSS; układ jednokolumnowy na wąskim
  ekranie.
  **Gotowe, gdy:** wiersz „Synteza mowy" nie ma już pola tekstowego na model; zmiana dostawcy
  przełącza listy modeli i głosów; brak klucza → widoczne pole klucza; `grep` po hexach w nowym pliku
  bez trafień. *(AC-1, AC-2, AC-3, AC-4, AC-7, C-30, C-31, C-32)*

- [ ] **T-20** — `src/actions/assistantPrefs.ts`: `getSpeechOptions()` zwraca głosy
  **skonfigurowanego** dostawcy (nie stałą listę OpenAI); walidacja `voiceId` przy zapisie preferencji
  przechodzi na `isVoiceOfConfiguredProvider` — głos nierozpoznany zapisuje `voiceKind: "server"` bez
  `voiceId` (domyślny głos dostawcy), nigdy błąd dla użytkownika.
  **Gotowe, gdy:** po przełączeniu dostawcy w panelu admina lista głosów w ustawieniach asystenta
  pokazuje głosy nowego dostawcy, a stary wybór nie zostaje zapisany po cichu. *(AC-7)*

---

## Faza 5 — Pętla agenta: rozwiązywanie nazw, ucięcie, uczciwe wyjście

- [ ] **T-21** — `src/lib/ai/agentTools.ts`: generyczny `resolveRef(ref, lookup, list, entity)` —
  kolejność: (1) jako identyfikator, (2) nazwa dokładna (case-insensitive), (3) nazwa częściowa: jedno
  trafienie → użyj, **wiele** → `throw` z listą trafień, (4) brak → `throw` z listą dostępnych nazw.
  `resolveProjectRef` przepisany na `resolveRef` **bez zmiany treści błędu** (brak regresji).
  **Gotowe, gdy:** testy jednostkowe pokrywają wszystkie pięć ścieżek; `list_tasks` z
  `projectId: "Omnia"` zachowuje się dokładnie jak dziś. *(AC-8 — regresja)*

- [ ] **T-22** — `src/lib/ai/agentTools.ts`: audyt **każdego** read-toola przyjmującego argument
  kończący się na `Id` (oraz `warehouse`) i wpięcie `resolveRef` tam, gdzie nazwa daje dziś cichą
  pustkę — co najmniej `list_items` (`listId`), `get_note` (`noteId`), `get_recipe` (`recipeId`),
  `list_care_agenda`/`list_care_history` (`petId`), `list_meal_plan`, `list_pantry`,
  `list_storage_items` (`warehouse`).
  **Gotowe, gdy:** `list_items` z `listId: "moje"` zwraca pozycje listy „moje" (nie pustkę); nazwa
  nieistniejąca zwraca błąd z listą dostępnych nazw, a niejednoznaczna — z listą trafień; lista
  objętych tooli zapisana w komentarzu przy helperze. *(AC-8, AC-9)*

- [ ] **T-23** — `src/lib/llm/chat.ts`: `ChatResult` (wariant `ok: true`) zyskuje `truncated?: boolean`
  ustawiane z `choices[0].finish_reason === "length"` (OpenAI-compatible) i
  `stop_reason === "max_tokens"` (Anthropic).
  **Gotowe, gdy:** `tsc --noEmit` czysto, a testy jednostkowe potwierdzają `truncated: true` dla obu
  formatów odpowiedzi i `false`/brak dla normalnego zakończenia. *(baza dla AC-28)*

- [ ] **T-24** — `src/app/api/llm/home/agent/route.ts`: `callAgent` zwraca
  `{ content, truncated }` zamiast samego `string` (wszystkie ścieżki: pętla, streaming, fallback
  baseline). W `runAgentLoopRaw`: przy `truncated` komunikat korekcyjny mówi o **ucięciu** („odpowiedź
  była zbyt długa — skróć treść"), nie o złym JSON-ie; dozwolona **jedna** taka próba
  (`truncationRetries <= 1`), przy drugim ucięciu → wyjście przez `salvageAnswerText` z dopiskiem o
  zbyt długiej odpowiedzi.
  **Gotowe, gdy:** test z odpowiedzią `finish_reason: "length"` pokazuje komunikat o ucięciu, a drugie
  ucięcie oddaje treść częściową bez pętli. *(AC-28)*

- [ ] **T-25** — `src/app/api/llm/home/agent/route.ts`: licznik `unproductiveIterations` — rośnie, gdy
  iteracja `query` nie wniosła żadnego nowego wyniku (wszystko z `toolCache` albo błędy). Po **2**
  takich iteracjach przerwij pętlę i wejdź w wyjście częściowe (T-26).
  **Gotowe, gdy:** test na atrapie modelu zwracającej stale to samo `query` kończy przebieg po ≤ 3
  wywołaniach LLM, czyli poniżej `MAX_ITERATIONS`. *(AC-10)*

- [ ] **T-26** — `src/app/api/llm/home/agent/route.ts`: zamiast suchego „Nie udało się dokończyć w
  limicie kroków" — **jedno** dodatkowe wywołanie modelu z instrukcją podsumowania (co ustalono / co
  zablokowało / jak dopytać), `maxTokens` jednorazowo `REPORT_MAX_TOKENS`. Gdy i to zawiedzie —
  komunikat składany po stronie serwera z `log` (nazwy narzędzi przez `humanizeAssistantText`,
  przyczyna: ucięcie / brak dopasowania / błąd narzędzia + podpowiedź). Nigdy samo zdanie o limicie
  kroków, nigdy identyfikatory ani surowe wartości.
  **Gotowe, gdy:** test potwierdza, że wyjście przy niedokończeniu zawiera ustalenia + przyczynę +
  podpowiedź i **nie** zawiera frazy o „limicie kroków"; `AGENT_MAX_TOKENS` (1200) niezmienione.
  *(AC-11, AC-12)*

---

## Faza 6 — Bramki i domknięcie

- [ ] **T-27** — Bramki lokalnie (lokalny Postgres, C-13 — **nigdy** prod `DATABASE_URL`):
  `npm run check:migrations` · `npm run check:actions` · `npm run check:ai-coverage` ·
  `npx tsc --noEmit` · `next lint` · `next build`.
  **Gotowe, gdy:** wszystkie zielone, build przechodzi do kroku `next build` włącznie (bez
  `scripts/migrate.js`). *(C-50)*

- [ ] **T-28** — Aktualizacja dokumentacji projektu: `CLAUDE.md` — katalog TTS + nowe rodzaje
  dostawców (`elevenlabs`/`google_tts`/`azure_tts`) + `AiConversation.draft` w opisie schematu +
  wzmianka o brudnopisie i cyklu życia rozmowy w opisie asystenta.
  **Gotowe, gdy:** opis w `CLAUDE.md` zgadza się z wdrożonym kodem (tabela modułów, schemat, sekcja
  asystenta, `/admin/llm`).

- [ ] **T-29** — Mapowanie AC-1..AC-28 na wynik (tabela: AC → zadanie → dowód) jako wejście do
  `/verify`; zapisz w notatce przy `tasks.md` albo bezpośrednio jako szkielet `verify.md`.
  **Gotowe, gdy:** każde AC ma przypisane zadanie i sposób potwierdzenia; żadne nie zostaje bez
  pokrycia.

- [ ] **T-30** — Wpisy do `doświadczenia.md` (C-51, po polsku, format `## YYYY-MM-DD — tytuł` /
  `**Problem:**` / `**Rozwiązanie:**` / `**Lekcja:**`): (a) ucięcie odpowiedzi LLM czytane jako „zły
  format" → pętla naprawcza wyczerpująca limit kroków i pieniądze; (b) `onPointerDown` +
  `preventDefault` jako sposób na „pierwsze dotknięcie tylko zwija klawiaturę" na mobile; (c) argument
  `*Id` w read-toolu przyjmujący nazwę → cicha pustka zamiast błędu. Plus wszystko, co wyjdzie po
  drodze.
  **Gotowe, gdy:** wpisy dopisane i zacommitowane razem z fixami.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) | Dowód |
|----|------------|-------|
| AC-1 | T-15, T-19 | dropdowny dostawca/model/głos zamiast pola tekstowego |
| AC-2 | T-15, T-19 | karta informacyjna: koszt, klucz, jakość PL |
| AC-3 | T-18, T-19 | pole klucza inline + `applySpeechProvider` bez zmiany ekranu |
| AC-4 | T-19 | „Próbka" → audio albo czytelny komunikat (bez treści dostawcy) |
| AC-5 | T-16, T-17 | testy kontraktu żądania dla 5 rodzajów + odczyt na żywo na OpenAI |
| AC-6 | T-17 | brak przypisania → 501 → głosy przeglądarki (bez regresji 031) |
| AC-7 | T-18, T-19, T-20 | lista głosów podąża za dostawcą; obcy głos nie zapisuje się po cichu |
| AC-8 | T-21, T-22 | regresja `list_tasks` + `list_items` z nazwą zwraca dane |
| AC-9 | T-22 | błąd z listą trafień (wiele) / dostępnych nazw (brak) |
| AC-10 | T-25 | przebieg kończy się poniżej limitu iteracji |
| AC-11 | T-26 | wyjście z ustaleniami + przyczyną + podpowiedzią |
| AC-12 | T-21..T-26 | scenariusz Z-2 odtworzony na `develop` daje odpowiedź merytoryczną |
| AC-13 | T-4 | brak „Szukanej nazwy" przy `isAdmin={false}` |
| AC-14 | T-4 | obecna, domyślnie zwinięta przy `isAdmin={true}` |
| AC-15 | T-3 | brak przewijania poziomego przy długiej wartości |
| AC-16 | T-2 | menu w obszarze ekranu na 375 px |
| AC-17 | T-2 | to samo na desktopie |
| AC-18 | T-1 | `grep` bez trafień |
| AC-19 | T-10 | pierwsze dotknięcie odpala akcję, klawiatura zostaje |
| AC-20 | T-10 | jedno dotknięcie wysyła i zwija klawiaturę |
| AC-21 | T-11 | sekcje zwijają się przy zmianie/zamknięciu rozmowy |
| AC-22 | T-12 | zamknij/otwórz → nowa rozmowa, stara w historii |
| AC-23 | T-12 | pusta rozmowa reużyta, brak śmieci w historii |
| AC-24 | T-13 | jedno dotknięcie wraca do ostatniej rozmowy |
| AC-25 | T-7, T-14 | brudnopis wraca po powrocie do rozmowy |
| AC-26 | T-7, T-14 | brudnopis wraca na innym urządzeniu |
| AC-27 | T-14 | po wysłaniu pole puste |
| AC-28 | T-23, T-24 | ucięcie rozpoznane jako ucięcie, jedna próba, potem treść częściowa |

---

## Notatki / blokady

- **T-16 / AC-5:** dostawców wymagających płatnego konta (ElevenLabs, Google, Azure) nie da się
  sprawdzić realnym nagraniem w tym środowisku — dowodem jest test kontraktu żądania, a fakt
  niesprawdzenia „na żywo" musi trafić do `verify.md` (ryzyko odnotowane w specu §9 i planie §9).
- **T-10 / AC-19:** zachowanie klawiatury różni się między Safari/iOS a Chrome; przy regresji na
  desktopie zawężamy `preventDefault` do `e.pointerType !== "mouse"` (wariant zapisany w planie §9).
- **T-14:** tekst wpisany, gdy rozmowa jeszcze nie istnieje (pierwsza wiadomość nigdy nie wysłana),
  nie ma do czego się przypiąć — świadome ograniczenie zgodne z AC-23, odnotowane w planie §5.3.
