# Plan techniczny: Asystent AI — katalog syntezy mowy, cykl życia czatu i domknięcie usterek UX

- **Spec:** ./spec.md (032-asystent-tts-katalog-i-ux-czatu)
- **Status:** draft
- **Data:** 2026-07-26

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

## 1. Podejście

Sześć zgłoszeń rozkłada się na **cztery niezależne obszary**, które można robić i weryfikować osobno:
(A) **synteza mowy** — katalog dostawców + adaptery + panel admina (`/admin/llm`), (B) **pętla agenta**
— rozpoznanie ucięcia odpowiedzi, rozwiązywanie nazw w odczytach, uczciwy komunikat o niedokończeniu,
(C) **panel akcji** — ukrycie parametrów pomocniczych i zawijanie wartości, (D) **czat asystenta** —
listy rozwijane, klawiatura mobilna, cykl życia rozmowy, brudnopis.

Wzorce do naśladowania (C-53): dla (A) — `applyAnthropicProfile` w `src/actions/llmConfig.ts` (istniejący
„jednoklikowy profil": upsert dostawcy + przypisanie modelu) oraz statyczny katalog
`src/lib/warsztat/catalog.ts` (dane w kodzie, nie w bazie) i istniejący `src/lib/tts/serverVoices.ts`;
dla (B) — istniejący `resolveProjectRef` w `src/lib/ai/agentTools.ts` (błąd z listą dostępnych nazw
zamiast cichej pustki) i istniejąca deduplikacja `toolCache` w pętli agenta; dla (C) — istniejący
kontrakt akcji `src/lib/ai/actionContract.ts` z kontrolką `"hidden"`; dla (D) — istniejące, zapisywane
na koncie preferencje asystenta (`src/actions/assistantPrefs.ts` + `AssistantPref`).

Jedyna zmiana schematu to **jedna kolumna** (`AiConversation.draft`). Wszystko inne mieści się w
istniejących modelach (`LlmProvider`/`LlmAssignment`) i w `Config` (klucz-wartość).

---

## 2. Model danych (Prisma)

- **Nowe/zmienione modele i kolumny:**
  - `AiConversation` — **nowa kolumna** `draft String?` — niewysłany tekst pola wiadomości dla tej
    rozmowy (D-4: brudnopis „na koncie", wraca na każdym urządzeniu, AC-25..AC-27). `null`/`""` = brak
    brudnopisu. Bez indeksu (czytamy zawsze po `id` rozmowy).
- **Bez nowych modeli.** Dostawcy syntezy mowy używają istniejącego `LlmProvider`
  (`kind`/`baseUrl`/`apiKey`), przypisanie — istniejącego `LlmAssignment` (`operationType = "speech"`).
- **`LlmProvider.kind` zyskuje nowe wartości** (C-12: nadal `String` + union TS, **żadnego enuma**):
  `"openai_compat" | "anthropic" | "elevenlabs" | "google_tts" | "azure_tts"`. Union żyje w
  `src/lib/llm/resolver.ts` (`ProviderKind`, już istnieje) i rozszerzamy go tam. **Bez migracji** —
  kolumna już jest `String`, dokładamy tylko dopuszczalne wartości w warstwie aplikacji.
- **Domyślny głos syntezy mowy** (wybór administratora, AC-4/AC-7) trzymamy w istniejącym `Config`
  pod kluczem `speech_default_voice` — jak `ai_cost_alert_threshold`/`usd_pln_rate` (C-53: bez nowej
  kolumny w `LlmAssignment`). Klucz jawny (nie sekret), więc bez szyfrowania.
- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: **`0210`**
  - Katalog: `prisma/migrations/0210_ai_conversation_draft/migration.sql`
  - DDL (idempotentnie):
    ```sql
    ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "draft" TEXT;
    ```
  - `schema.prisma`: dopisanie `draft String?` w `model AiConversation` (sama edycja schematu nie
    tworzy kolumny na produkcji — C-10; plik migracji powyżej jest obowiązkowy).

---

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 `src/actions/aiConversations.ts` (edycja)
- `saveConversationDraft(id: string, draft: string): Promise<void>` — **nowa**. `requireAuth()`, zapis
  tylko gdy `AiConversation.userId === user.id` (`updateMany` z `where: { id, userId }` — brak dostępu
  = 0 zmienionych wierszy, bez wycieku istnienia rozmowy). Przycięcie do **4000 znaków**. Kończy
  `revalidatePath("/")` (C-20).
- `getAiConversation(id)` — **rozszerzenie DTO** o `draft: string | null` (dokładamy `draft: true` do
  `select`, zwracamy w obiekcie). Guard bez zmian (`where: { id, userId: user.id }`).
- `createAiConversation(firstUserText)` — bez zmian.
- **Dostęp (C-21):** rozmowy asystenta są **wyłącznie per użytkownik** (brak `ownerTeamId` — tak jest
  dziś i tak zostaje); guard = `userId` z sesji, nigdy z argumentu.
- **Manifest pokrycia akcji:** wpis dla `saveConversationDraft` w `src/lib/ai/action-coverage.json`
  — `access: "self"`, klasyfikacja AI: `excluded` z powodem „brudnopis pola wiadomości — stan UI
  czatu, nie dane użytkownika do zarządzania przez asystenta". Bez tego `npm run check:ai-coverage`
  wywali build.

### 3.2 `src/actions/llmConfig.ts` (edycja)
- `getSpeechConfig(): Promise<SpeechConfigDTO>` — **nowa**, `requireAdmin()`. Zwraca: katalog
  dostawców syntezy mowy (z `src/lib/tts/catalog.ts`), aktualne przypisanie `speech` (dostawca+model),
  wybrany domyślny głos, oraz per pozycja katalogu — czy istnieje już dostawca z tym `kind`+`baseUrl`
  i **czy ma klucz** (`hasKey`, nigdy sam klucz — C-41).
- `applySpeechProvider(data: { catalogId: string; apiKey?: string; model: string; voiceId?: string })`
  — **nowa**, `requireAdmin()`. Wzorzec 1:1 z `applyAnthropicProfile`: znajdź albo utwórz
  `LlmProvider` (label/kind/baseUrl **z katalogu**, nie z wejścia klienta), zapisz klucz
  `encryptSecret` tylko gdy podany (pusty = nie nadpisuj), upsert `LlmAssignment` dla `"speech"`,
  zapis `speech_default_voice` w `Config`. Walidacja: `catalogId` musi istnieć w katalogu, `model`
  musi być z listy modeli tej pozycji, `voiceId` z listy głosów tej pozycji (inaczej → domyślny
  głos dostawcy; **nigdy cichy zapis nieistniejącego głosu** — AC-7). `logAudit("config",
  "llm_speech.set", …)` (C-25) + `revalidatePath("/admin/llm")`.
- `setAssignment(...)` — **twardy guard**: jeśli wybrany dostawca ma `kind` z rodziny **tylko-TTS**
  (`elevenlabs|google_tts|azure_tts`), a `operationType !== "speech"` → `throw new Error("Ten dostawca
  obsługuje wyłącznie syntezę mowy…")`. Chroni `chatComplete`, które rozgałęzia się tylko na
  `anthropic` vs reszta i inaczej wysłałoby czat do endpointu TTS.
- `createProvider` / `updateProvider` — normalizacja `kind` przez wspólny `normalizeProviderKind()`
  (dziś: „wszystko co nie `anthropic` → `openai_compat`", co zjadałoby nowe rodzaje).
- **Manifest:** wpisy dla `getSpeechConfig` (`access: "admin"`, `excluded` — konfiguracja systemowa)
  i `applySpeechProvider` (`access: "admin"`, `excluded`).

### 3.3 `src/actions/assistantPrefs.ts` (edycja)
- `getSpeechOptions()` — dziś zwraca **stałą** listę głosów OpenAI. Zmiana: zwraca głosy
  **skonfigurowanego dostawcy** (z katalogu, po `kind`+`model` z przypisania `speech`) — inaczej
  użytkownik wybiera głos, którego dostawca nie zna (AC-7).
- Walidacja `voiceId` przy zapisie preferencji przechodzi z `isServerVoiceId` (lista stała) na
  `isVoiceOfConfiguredProvider` (lista dostawcy). Głos nierozpoznany → zapis `voiceKind: "server"`
  **bez** `voiceId` (czyli domyślny głos dostawcy), nigdy błąd dla użytkownika.
- Guard i `revalidatePath` bez zmian (`access: "self"`, wpisy w manifeście już istnieją).

---

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowych slugów uprawnień i bez nowych modułów** — nie dokładamy tras w nawigacji, więc
  `permissions.ts`, `modules.tsx` i `ModuleSidebar` **pozostają bez zmian**. Migracja seedująca
  uprawnienie nie jest potrzebna.
- Konfiguracja syntezy mowy siedzi na istniejącej trasie `/admin/llm` → `module.admin`
  (`requireAdmin()` w każdej nowej akcji).
- **Nowe rozróżnienie w UI:** panel akcji pokazuje parametry pomocnicze tylko administratorowi.
  Korzystamy z **istniejącego** propsa `isAdmin` w `ActionDrawer` (dodany w 031, przekazywany z
  `AICommandSheet`) — zero nowego mechanizmu uprawnień (C-53). To decyzja **prezentacyjna**:
  parametr i tak jedzie do backendu, więc nie jest to granica bezpieczeństwa (bezpieczeństwo pilnuje
  walidacja w `/api/llm/home/execute`, wdrożona w 031).

---

## 5. UI (C-30, C-31, C-32)

### 5.1 `/admin/llm` — sekcja syntezy mowy (Z-4, AC-1..AC-7)
- `src/components/admin/LlmConfigPanel.tsx`: dla wiersza przypisania `operationType === "speech"`
  renderujemy **osobny komponent** `SpeechAssignmentRow` (nowy plik
  `src/components/admin/SpeechAssignmentRow.tsx`, żeby nie puchł panel):
  - `<select>` **dostawca** — pozycje z katalogu, etykieta zawiera nazwę + znacznik kosztu
    (np. „ElevenLabs — płatny, od $5/mies."), pozycje wymagające klucza oznaczone.
  - `<select>` **model/wariant głosu** — modele wybranego dostawcy (przełącza się wraz z dostawcą).
  - `<select>` **głos** — głosy wybranego dostawcy (AC-7). Zmiana dostawcy resetuje wybór na
    domyślny głos tego dostawcy.
  - **Karta informacyjna** pod polami: darmowy/płatny + orientacyjny koszt, czy trzeba klucz, jakość
    polskiego, jednozdaniowa instrukcja „skąd wziąć klucz" (AC-2). Teksty **po polsku** (C-32).
  - **Pole klucza inline** — pokazywane tylko, gdy wybrany dostawca nie ma jeszcze klucza (AC-3);
    stan „ma klucz" pokazujemy maską z `getSpeechConfig` (C-41), nigdy wartością.
  - **Przycisk „Próbka"** — `POST /api/tts` z krótkim polskim zdaniem i wybranym `voiceId`; sukces →
    odtworzenie audio, `501` → „dostawca nie jest jeszcze skonfigurowany", inne → „nie udało się
    odtworzyć próbki" (AC-4; bez treści błędu dostawcy — C-41).
  - Kolory wyłącznie ze zmiennych CSS (`var(--accent-amber)` dla „płatny", `var(--accent-green)` dla
    „darmowy", `var(--on-accent)` na przyciskach) — **żadnych hexów** (C-30).
  - Układ: `display:grid` z `gridTemplateColumns: "1fr"` na wąskim ekranie i wielokolumnowo od `md`
    (panel admina jest desktopowy, ale nie może się rozjeżdżać na telefonie — C-31).

### 5.2 Panel akcji (Z-5, AC-13..AC-15)
`src/components/home/ActionDrawer.tsx`:
- Blok „Szukana nazwa" (dziś linia ~470) renderowany **tylko gdy `isAdmin`**, wewnątrz istniejącego
  rozwinięcia „Parametry", pod dodatkowym, domyślnie **zwiniętym** pod-rozwinięciem „Szczegóły
  techniczne" (AC-14). Dla nie-admina — nie renderowany wcale (AC-13).
- Naprawa wychodzenia poza obszar (AC-15): wiersz parametru dostaje `minWidth: 0` na kontenerze flex i
  `flexWrap: "wrap"` dla par etykieta/wartość; wartości tekstowe — `overflowWrap: "anywhere"`.
  Stała szerokość etykiety (`width: 110`) zostaje na desktopie, ale ustępuje `flexBasis` przy
  zawinięciu.
- **Naruszenie C-30 do naprawy przy okazji tego samego bloku:** obecny `border: "1px solid
  rgba(245,158,11,0.4)"` → `1px solid var(--accent-amber)` (hardcodowany hex łamie skinowalność).

### 5.3 Czat asystenta (Z-1, Z-3, Z-6)
`src/components/home/AICommandSheet.tsx`:
- **Z-1 / AC-16, AC-17** — menu poziomu pracy (dziś `position:absolute; bottom:calc(100% + 6px);
  left: 0`) siedzi w **prawej** grupie akcji kompozytora, więc rozwija się w prawo, za krawędź
  ekranu. Zmiana: `right: 0` (rozwija się w lewo, w stronę środka), `left: "auto"`,
  `maxWidth: "min(300px, calc(100vw - 32px))"` zostaje. Dwa pozostałe menu w kompozytorze — audyt tym
  samym kluczem.
- **Z-3 / AC-18** — usunięcie akapitu „Zapisywane na Twoim koncie — widoczne na każdym urządzeniu.
  Zmiany zapisują się automatycznie." (linia ~1486). Reszta panelu ustawień bez zmian.
- **Z-6a / AC-19, AC-20** — przyciski w dolnym wierszu kompozytora (aparat, galeria, poziom pracy,
  mikrofon) dostają `onPointerDown={(e) => e.preventDefault()}`: kliknięcie **nie** odbiera fokusu
  polu tekstowemu, więc klawiatura mobilna zostaje otwarta i akcja odpala się przy **pierwszym**
  dotknięciu. Przycisk **wysyłania** też dostaje `onPointerDown` z `preventDefault` (żeby dotknięcie
  nie przepadło przy zwijaniu klawiatury), a w handlerze po wysłaniu jawne `composerRef.current?.blur()`
  → jedno dotknięcie = wysłanie + zamknięcie klawiatury (AC-20).
- **Z-6b / AC-21** — wspólna funkcja `collapseSections()` (`setShowPrefs(false)`, `setShowReport(false)`,
  `setReportDone(null)`, `setShowLevelMenu(false)`) wołana w `resetConversation()`, `loadConversation()`
  i `handleClose()`.
- **Z-6c / AC-22, AC-23** — `handleClose()` zapamiętuje `lastConversationId` (stan komponentu, żywy
  między otwarciami — komponent nie jest odmontowywany, siedzi w `AppShell`) i **czyści bieżącą
  rozmowę**, ale tylko gdy rozmowa ma co najmniej jedną turę; rozmowa bez tur zostaje (AC-23 — brak
  pustych wpisów w historii). Praktycznie: `handleClose()` → `saveDraftNow()` → `collapseSections()` →
  jeśli `turns.length > 0` `{ setLastConversationId(conversationId); resetConversation(); }`.
  Zauważ: pusta rozmowa i tak nie istnieje w bazie — `AiConversation` powstaje dopiero przy pierwszej
  wiadomości (`createAiConversation`), więc „reużycie pustej" jest naturalne, nie wymaga sprzątania.
- **Z-6e / AC-24** — w nagłówku arkusza, obok „Nowa rozmowa", **jednoprzyciskowy powrót**: przycisk
  z ikoną `CornerUpLeft` + skróconym tytułem ostatniej rozmowy, widoczny **tylko** gdy
  `lastConversationId` istnieje i bieżący wątek jest pusty. Klik → `loadConversation(lastConversationId)`.
  Tytuł skrócony do ~18 znaków z `title`/`aria-label` pełnym — zajmuje jeden wiersz nagłówka, nie
  dodaje sekcji (wymóg „oszczędne przestrzennie"). Cel dotyku ≥ 38 px (C-31).
- **Z-6d / AC-25..AC-27** — brudnopis:
  - zapis **rzadki i zbiorczy**, nie na każdy znak (ryzyko z p. 9 speca): `saveDraftNow()` wołane w
    `handleClose()`, przy `loadConversation()`/`resetConversation()` (przed zmianą wątku) oraz z
    `useEffect` z debounce **2 s** na `inputText`. Zapis tylko gdy istnieje `conversationId` (brudnopis
    należy do rozmowy) i gdy treść **zmieniła się** względem ostatnio zapisanej (`lastSavedDraftRef`).
  - odczyt: `loadConversation()` ustawia `setInputText(convo.draft ?? "")`.
  - czyszczenie: `handleSend()` po udanym wysłaniu ustawia brudnopis na `""` (AC-27).
  - **Świadome ograniczenie:** tekst wpisany, gdy rozmowa jeszcze nie istnieje (pierwsza wiadomość
    nigdy nie wysłana), nie ma do czego się przypiąć — zostaje w polu do czasu przeładowania strony.
    To jest zgodne z AC-23 (nie tworzymy pustych rozmów) i odnotowane jako założenie.

---

## 6. AI / integracje (C-23, C-40)

- **Nowe `AIAction`: brak.** Nie dokładamy akcji mutujących, więc `npm run check:actions` przechodzi
  bez nowych egzekutorów. Zmieniamy tylko *prezentację* parametrów (kontrakt akcji zostaje źródłem
  prawdy o tym, co jest pomocnicze).
- **Read-toole (`src/lib/ai/agentTools.ts`) — rozwiązywanie nazw (AC-8, AC-9):**
  - Nowy generyczny helper obok istniejącego `resolveProjectRef`:
    ```ts
    async function resolveRef(
      ref: string,
      lookup: (ref: string) => Promise<{ id: string } | null>,
      list: () => Promise<string[]>,
      entity: string,           // np. "listy zakupów"
    ): Promise<{ id: string } | never>
    ```
    Kolejność: (1) traktuj jako identyfikator, (2) dopasowanie **dokładne** po nazwie
    (case-insensitive), (3) dopasowanie **częściowe** — jeśli jedno trafienie, użyj go; jeśli **wiele**
    → `throw` z listą trafień („Dopasowano N …: A, B. Doprecyzuj."), (4) brak → `throw` z listą
    dostępnych nazw. Błąd wraca do modelu jako `error` narzędzia (istniejąca ścieżka), więc agent
    **dopytuje**, a nie powtarza (AC-9).
  - `resolveProjectRef` przepisany na `resolveRef` (zachowanie i treść błędu bez regresji — AC-8 dla
    zadań to dziś działający przypadek).
  - Objęte toole — **wynik audytu wykonanego w implementacji** (argumenty kończące się na `Id`):
    `list_tasks` (`projectId`, już przez `resolveProjectRef`), `get_task` (`taskId`), `list_items`
    (`listId`), `get_note` (`noteId`), `get_recipe` (`recipeId`). **Korekta wobec pierwotnego
    założenia (C-54):** `list_care_agenda`/`list_care_history`, `list_meal_plan` i `list_pantry`
    **nie przyjmują** argumentu `petId` ani innego identyfikatora (agenda liczy się dla wszystkich
    zwierząt), a `list_storage_items` przyjmuje `warehouse` jako **nazwę** dopasowywaną przez
    `contains` — te cztery nie wymagają zmiany. Podobnie `args.petName`/`args.deckName` są już
    nazwami.
  - Czysta logika dopasowania wydzielona do `src/lib/ai/refResolve.ts` (wzorzec
    `conversationLimits.ts`), żeby dała się przetestować bez bazy — `agentTools.ts` importuje
    `matchNamedRef`/`unresolvedRefMessage`.
- **Pętla agenta (`src/app/api/llm/home/agent/route.ts`) — ucięcie i limit kroków:**
  - **Rozpoznanie ucięcia (AC-28)** wymaga informacji z warstwy niżej: `src/lib/llm/chat.ts` →
    `ChatResult` (wariant `ok: true`) zyskuje `truncated?: boolean`, ustawiane z
    `choices[0].finish_reason === "length"` (OpenAI-compatible) i `stop_reason === "max_tokens"`
    (Anthropic). `callAgent` przekazuje flagę wyżej (dziś zwraca sam `string` → zwraca
    `{ content, truncated }`).
  - W `runAgentLoopRaw`: gdy `truncated`, komunikat korekcyjny **nie brzmi** „to nie był poprawny
    JSON", ale „odpowiedź została **ucięta**, bo była zbyt długa — zmieść się w limicie: skróć treść,
    zrezygnuj z rozbudowanych opisów". Jedna taka próba (`truncationRetries <= 1`); przy drugim
    ucięciu → wyjście przez `salvageAnswerText(lastContent)` z dopiskiem, że odpowiedź była zbyt długa
    (istniejąca ścieżka „degradacji formatu", tylko z uczciwą przyczyną).
  - **Wykrywanie braku postępu (AC-10):** `toolCache` już blokuje **identyczne** wywołanie w obrębie
    przebiegu; dokładamy licznik `unproductiveIterations` — inkrementowany, gdy iteracja `query` nie
    wniosła **żadnego** nowego wyniku (wszystkie wywołania trafiły w cache albo zwróciły błąd). Po
    **2** takich iteracjach przerywamy pętlę i wchodzimy w wyjście częściowe (niżej), zamiast dobijać
    do `MAX_ITERATIONS`. Efekt mierzalny: łączna liczba wywołań LLM < limit iteracji.
  - **Uczciwe wyjście przy niedokończeniu (AC-11, AC-12):** dziś linia ~753 oddaje suchy komunikat
    „Nie udało się dokończyć w limicie kroków". Zamiast tego **jedno dodatkowe wywołanie modelu** z
    instrukcją „podsumuj w 3–5 zdaniach: co ustaliłeś na podstawie zebranych danych, czego nie udało
    się dokończyć i dlaczego, oraz jak użytkownik może dopytać" (krok `answer`, `maxTokens` jak dziś).
    Gdy i to zawiedzie → komunikat składany **z `log`** po stronie serwera: co pobrano (nazwy
    narzędzi przetłumaczone na język ludzki przez istniejący `humanizeAssistantText`), co zablokowało
    (ucięcie / brak dopasowania / błąd narzędzia) i konkretna podpowiedź. **Nigdy** samo zdanie o
    limicie kroków. Bez identyfikatorów i surowych wartości (dorobek 031).
  - **Budżet tokenów:** `AGENT_MAX_TOKENS` (1200) **zostaje**; podnosimy tylko *jednorazowo* dla
    kroku podsumowania przy niedokończeniu (do `REPORT_MAX_TOKENS`), bo to ostatnie wywołanie w
    przebiegu, nie pętla. Zgodne z zakresem speca („nie kupujemy więcej kroków").
- **C-40:** ani katalog, ani adaptery nie hardcodują dostawcy w kodzie wołającym — `synthesizeSpeech`
  dalej pyta `resolveLlmChain("speech")`, a katalog jest tylko **słownikiem podpowiedzi dla
  administratora** (label/baseUrl/modele/głosy/koszt). Wybór zostaje w bazie.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

### 6.1 Adaptery syntezy mowy (D-1 — decyzja właściciela)
Nowe pliki, celowo **cienkie** (zastrzeżenie z p. 8 speca — ograniczamy koszt utrzymania):
- `src/lib/tts/catalog.ts` — **jedno** źródło prawdy: `TTS_CATALOG: TtsProviderSpec[]` z polami
  `id`, `label`, `kind`, `baseUrl`, `models: {id,label}[]`, `voices: ServerVoice[]`, `paid: boolean`,
  `costHint: string`, `requiresKey: boolean`, `polishHint: string`, `setupHint: string`. Pozycje:
  **OpenAI** (`openai_compat`, `tts-1`/`tts-1-hd`/`gpt-4o-mini-tts`, głosy jak dziś w
  `serverVoices.ts` — wielojęzyczne, dobre po polsku, płatny, wymaga klucza), **Groq PlayAI**
  (`openai_compat`, `playai-tts` — tani, ale **głosy angielskie**: `polishHint` mówi to wprost),
  **ElevenLabs** (`elevenlabs`, `eleven_multilingual_v2`/`eleven_turbo_v2_5`/`eleven_flash_v2_5`,
  głosy wielojęzyczne — najlepszy polski, płatny), **Google Cloud TTS** (`google_tts`, warianty
  `standard`/`wavenet`/`neural2`, polskie głosy `pl-PL-*`, darmowy limit miesięczny), **Azure Speech**
  (`azure_tts`, jeden wariant `neural`, polskie głosy `pl-PL-ZofiaNeural`/`MarekNeural`/`AgnieszkaNeural`,
  darmowy limit miesięczny). Helpery: `findTtsProvider(kind, baseUrl)`, `voicesForKind(kind)`,
  `isVoiceOfKind(kind, voiceId)`, `defaultVoiceForKind(kind)`.
- `src/lib/tts/adapters.ts` — **jedna** funkcja `buildSpeechRequest(kind, cfg, { text, voiceId })`
  zwracająca `{ url, init }` + `contentTypeFallback`, oraz `parseSpeechResponse(kind, res)`. Cała
  różnica między dostawcami mieści się w jednym `switch` na `kind` (C-53 — zero klas i fabryk):
  - `openai_compat` → `POST {base}/audio/speech`, `Bearer`, body `{model, voice, input,
    response_format:"mp3"}` (dzisiejsza ścieżka, przenoszona 1:1);
  - `elevenlabs` → `POST {base}/text-to-speech/{voiceId}`, nagłówek `xi-api-key`, body
    `{text, model_id}`;
  - `google_tts` → `POST {base}/text:synthesize?key={apiKey}`, body
    `{input:{text}, voice:{languageCode:"pl-PL", name:voiceId}, audioConfig:{audioEncoding:"MP3"}}`,
    odpowiedź to **JSON z base64** → dekodowanie w `parseSpeechResponse`;
  - `azure_tts` → `POST {base}/cognitiveservices/v1`, nagłówki `Ocp-Apim-Subscription-Key` +
    `X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3`, body **SSML** (`<speak>` z
    `xml:lang="pl-PL"` i `<voice name=…>`; tekst **escapowany** — `&`, `<`, `>`, `"`).
- `src/lib/tts/serverTts.ts` — `synthesizeSpeech` przestaje samo budować żądanie: bierze `cfg` z
  resolvera, woła `buildSpeechRequest` + `parseSpeechResponse`. Zachowane: limit `SPEECH_MAX_CHARS`,
  `null` przy braku przypisania (funkcja wyłączona, AC-6), brak przecieku treści błędu dostawcy
  (C-41), `voiceId` walidowany przeciw głosom **tego** dostawcy z fallbackiem na jego domyślny.
- `src/lib/tts/serverVoices.ts` — zostaje jako **głosy rodziny OpenAI-compatible** (reeksportowane
  przez katalog), plus dotychczasowe helpery `SERVER_VOICE_PREFIX`/`toServerVoiceValue`/
  `parseServerVoiceValue` (używane przez UI ustawień) bez zmian sygnatur.

---

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | `AiConversation.draft String?` |
| `prisma/migrations/0210_ai_conversation_draft/migration.sql` | nowy | `ALTER TABLE … ADD COLUMN IF NOT EXISTS "draft" TEXT` (C-10) |
| `src/lib/tts/catalog.ts` | nowy | katalog dostawców/modeli/głosów + koszt, klucz, jakość PL (AC-1, AC-2) |
| `src/lib/tts/adapters.ts` | nowy | budowa żądania + parsowanie odpowiedzi per `kind` (D-1) |
| `src/lib/tts/serverTts.ts` | edycja | przejście na adaptery; walidacja głosu wg dostawcy (AC-5, AC-6) |
| `src/lib/tts/serverVoices.ts` | edycja | głosy jako rodzina OpenAI-compat; helpery bez zmian |
| `src/lib/llm/resolver.ts` | edycja | `ProviderKind` + nowe rodzaje; pomiń dostawcę tylko-TTS dla operacji nie-`speech` |
| `src/lib/llm/chat.ts` | edycja | `truncated` w wyniku (finish_reason/stop_reason) — AC-28 |
| `src/actions/llmConfig.ts` | edycja | `getSpeechConfig`, `applySpeechProvider`, guard `setAssignment`, `normalizeProviderKind` |
| `src/components/admin/SpeechAssignmentRow.tsx` | nowy | dropdowny dostawca/model/głos + koszt + klucz inline + próbka (AC-1..AC-4, AC-7) |
| `src/components/admin/LlmConfigPanel.tsx` | edycja | wpięcie `SpeechAssignmentRow` dla `speech`; `KIND_LABELS` o nowe rodzaje |
| `src/actions/assistantPrefs.ts` | edycja | `getSpeechOptions` + walidacja głosu wg skonfigurowanego dostawcy (AC-7) |
| `src/lib/ai/agentTools.ts` | edycja | `resolveRef` + wpięcie w toole przyjmujące `*Id` (AC-8, AC-9) |
| `src/app/api/llm/home/agent/route.ts` | edycja | ucięcie, brak postępu, uczciwe wyjście (AC-10..AC-12, AC-28) |
| `src/components/home/ActionDrawer.tsx` | edycja | parametry pomocnicze za `isAdmin` + zwinięcie + zawijanie + `var(--accent-amber)` (AC-13..AC-15) |
| `src/components/home/AICommandSheet.tsx` | edycja | menu poziomu `right:0`, usunięty akapit, `onPointerDown`, zwijanie sekcji, cykl życia rozmowy, powrót do ostatniej, brudnopis (AC-16..AC-27) |
| `src/actions/aiConversations.ts` | edycja | `saveConversationDraft`, `draft` w DTO (AC-25..AC-27) |
| `src/lib/ai/action-coverage.json` | edycja | wpisy dla nowych akcji (`check:ai-coverage`) |
| `doświadczenia.md` | edycja | lekcje: ucięcie odpowiedzi ≠ zły format; `onPointerDown` a klawiatura mobilna (C-51) |
| `CLAUDE.md` | edycja | katalog TTS + nowe rodzaje dostawców + `AiConversation.draft` w opisie schematu |

---

## 8. Bramki i weryfikacja (C-50)

**Środowisko lokalne (C-13 — nigdy prod DB):** `pg_ctlcluster 16 main start`, rola+baza
`omnia/omnia_dev`, `.env.local` z `DATABASE_URL`/`DIRECT_URL` na `127.0.0.1:5432`,
`npx prisma migrate deploy`. Weryfikujemy **do kroku `next build`** — `scripts/migrate.js` (ostatni
krok `npm run build`) rusza bazę i nie odpalamy go przeciw produkcji.

Bramki: `npm run check:migrations` · `npm run check:actions` · `npm run check:ai-coverage` ·
`next lint` · `npx tsc --noEmit` · `next build`.

**Mapowanie AC → sposób weryfikacji:**

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1, AC-2 | `/admin/llm` na lokalnym buildzie: wiersz „Synteza mowy" ma trzy `<select>` i kartę z kosztem/kluczem/PL; brak pola tekstowego na model |
| AC-3 | wybór dostawcy bez klucza → widoczne pole klucza inline + zapis przez `applySpeechProvider` bez opuszczania ekranu |
| AC-4 | „Próbka" z kluczem OpenAI → audio; bez klucza → komunikat, nie wyjątek; brak treści błędu dostawcy w odpowiedzi (`grep` po ścieżce błędu) |
| AC-5 | test manualny na dostawcy z dostępnym kluczem (OpenAI) + **test jednostkowy** `buildSpeechRequest` dla wszystkich pięciu rodzajów (URL, nagłówki, kształt body/SSML) — dostawcy bez konta weryfikowani tą drogą (ryzyko z p. 9 speca) |
| AC-6 | brak przypisania `speech` → `/api/tts` zwraca 501, klient używa głosów przeglądarki (bez regresji wobec 031) |
| AC-7 | zmiana dostawcy w panelu przełącza listę głosów; `applySpeechProvider` z głosem obcym dostawcy → zapisany domyślny głos dostawcy (test jednostkowy walidacji) |
| AC-8, AC-9 | testy jednostkowe `resolveRef`: id · nazwa dokładna · nazwa częściowa jednoznaczna · wiele dopasowań (błąd z listą) · brak (błąd z listą dostępnych); dodatkowo `list_items` z `listId="moje"` zwraca pozycje listy „moje", nie pustkę |
| AC-10 | test pętli na atrapie modelu zwracającej stale to samo `query`: przebieg kończy się po ≤ 3 wywołaniach LLM (< `MAX_ITERATIONS`) |
| AC-11, AC-12 | test pętli: wyjście przy niedokończeniu zawiera ustalenia + przyczynę + podpowiedź i **nie** zawiera frazy o „limicie kroków”; scenariusz Z-2 odtworzony manualnie na `develop` |
| AC-28 | test: odpowiedź z `finish_reason: "length"` → komunikat korekcyjny o **ucięciu** (nie o JSON-ie), drugie ucięcie → treść częściowa z informacją o zbyt długiej odpowiedzi |
| AC-13, AC-14 | `ActionDrawer` z `isAdmin={false}` — brak „Szukanej nazwy" w drzewie; z `isAdmin` — obecna, zwinięta (test komponentowy albo przegląd na `develop` na dwóch kontach) |
| AC-15 | parametr o wartości 200 znaków — brak przewijania poziomego karty (przegląd na wąskim viewporcie 375 px) |
| AC-16, AC-17 | viewport 375 px: menu poziomu pracy w całości w obszarze ekranu; to samo na desktopie |
| AC-18 | `grep -n "Zapisywane na Twoim koncie" src/` → brak trafień |
| AC-19, AC-20 | urządzenie/emulacja dotyku: fokus w polu → dotknięcie mikrofonu/aparatu odpala akcję i **nie** zwija klawiatury; dotknięcie wysyłania wysyła i zwija (Safari/iOS + Chrome — ryzyko z p. 9 speca) |
| AC-21 | rozwinięte ustawienia → „Nowa rozmowa"/przełączenie/zamknięcie → sekcje zwinięte |
| AC-22, AC-23 | rozmowa z wiadomością → zamknij/otwórz → pusty wątek, poprzednia w historii; rozmowa pusta → zamknij/otwórz → brak nowego wpisu w historii |
| AC-24 | po otwarciu widoczny jeden przycisk z tytułem ostatniej rozmowy; jedno dotknięcie ją wczytuje |
| AC-25, AC-26, AC-27 | wpisz bez wysłania → zamknij → wróć: tekst wraca; ta sama rozmowa w drugiej przeglądarce (inna sesja tego samego konta): tekst wraca; po wysłaniu — pole puste |

---

## 9. Ryzyka techniczne i plan wycofania

- **Nowy `LlmProvider.kind` trafia do operacji czatowej** i `chatComplete` wysyła prompt do endpointu
  TTS → guard w `setAssignment` **oraz** pominięcie dostawców tylko-TTS w `resolveLlmChain` dla
  operacji ≠ `speech` (dwie niezależne bariery).
- **Adapterów Google/Azure/ElevenLabs nie sprawdzimy na żywo** (brak kont). Mitygacja: testy
  jednostkowe kształtu żądania + jawne oznaczenie w katalogu; w `verify.md` zapisujemy wprost, co
  zostało sprawdzone realnym nagraniem, a co tylko kontraktem żądania.
- **`onPointerDown` + `preventDefault` może zablokować kliknięcie** w części przeglądarek
  (desktopowe menu kontekstowe, starsze Safari). Mitygacja: `preventDefault` tylko dla
  `e.pointerType !== "mouse"` albo — prościej i bezpieczniej — `preventDefault` bez warunku, ale
  akcja pozostaje w `onClick` (który i tak się odpali); regres sprawdzany na desktopie w AC-17/AC-19.
- **Zmiana `callAgent` z `string` na obiekt** dotyka kilku ścieżek (streaming, fallback baseline).
  Mitygacja: zmiana wewnątrz jednego pliku trasy, typ zwracany wymuszony przez `tsc`.
- **Debounce brudnopisu może gubić ostatnie znaki** przy szybkim zamknięciu. Mitygacja: `saveDraftNow()`
  wołane synchronicznie w `handleClose()`/przełączeniu wątku, niezależnie od timera.
- **Rozwiązywanie nazw może zmienić zachowanie działających promptów** (tool, który dziś dostaje
  prawdziwe id, po zmianie przechodzi ścieżką „to nie nazwa"). Mitygacja: kolejność w `resolveRef` —
  **najpierw** próba jako identyfikator, dopiero potem nazwa.
- **Rollback:** kod — `git revert` commitów feature'a (bez odwracania migracji). Migracja `0210` jest
  **addytywna i nullable**, więc stary kod działa z nową kolumną; wycofanie kodu nie wymaga wycofania
  migracji (zgodnie z `docs/devops/runbook-deploy-rollback.md`: granica kod↔migracja). Gdyby trzeba
  było usunąć kolumnę — osobna migracja `DROP COLUMN`, nigdy rename/edycja `0210` (C-11).

---

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczny plik migracji `0210` (numer z `npm run next:migration`), `String` bez
  enumów dla `kind`, brak builda/migracji przeciw prod DB, seedowania SQL nie potrzebujemy
  (`Config` upsertowany w akcji).
- [x] **C-20..C-25** — nowe mutacje jako Server Actions z `revalidatePath`; guard po `userId` z sesji
  (rozmowy) i `requireAdmin()` (konfiguracja); `logAudit("config", …)` dla zmiany syntezy mowy
  (C-25); brak nowych `AIAction`, więc `check:actions` bez nowych egzekutorów (C-23); trash nie
  dotyczy (C-24).
- [x] **C-30..C-32** — zero nowych hexów, a jeden istniejący (`rgba(245,158,11,0.4)`) usunięty na rzecz
  `var(--accent-amber)`; poprawki mobilne (menu w obszarze ekranu, klawiatura, cele dotyku ≥ 38 px);
  wszystkie teksty po polsku.
- [x] **C-40, C-41** — dobór dostawcy i modelu zostaje w bazie (katalog to tylko podpowiedzi); klucze
  szyfrowane, maskowane, nigdy zwracane ani logowane; treść błędu dostawcy nie wychodzi do klienta.
- [x] **C-50, C-51** — bramki wypisane w p. 8; wpisy do `doświadczenia.md` zaplanowane jako część
  implementacji.
- [x] **C-53 (minimalizm — świadomie sprawdzone)** — **zero nowych zależności** (wszystkie adaptery na
  `fetch`); jedna kolumna w bazie zamiast nowego modelu; `Config` zamiast kolumny w `LlmAssignment`;
  różnice między pięcioma dostawcami TTS w **jednym** `switch`, nie w hierarchii klas; wykorzystanie
  istniejących mechanizmów (`isAdmin` w `ActionDrawer`, `toolCache`, `resolveProjectRef`,
  `applyAnthropicProfile` jako wzorzec). Świadome odstępstwo od minimalizmu: **pięć** adapterów TTS —
  to decyzja właściciela D-1, z zastrzeżeniem odnotowanym w specu.
- [x] **C-54** — `spec.md` **poprawiony na tym etapie**: skorygowana przyczyna Z-2 (ucięcie odpowiedzi,
  nie nierozwiązana nazwa) + nowe **AC-28**; AC-8/AC-9 przedefiniowane jako regresja + rozszerzenie na
  pozostałe odczyty. Plan zbudowany pod poprawiony spec.
- [x] **C-55** — bez pytań do właściciela na tym etapie; wszystkie wybory rozstrzygnięte wzorcem
  sąsiedniego kodu i minimalizmem, odnotowane wyżej.
