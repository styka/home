# Recenzja: Asystent AI — katalog syntezy mowy, cykl życia czatu i domknięcie usterek UX

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-07-26
- **Diff:** `origin/develop...HEAD` — 31 plików, +3187 / −99 (z czego ~1270 to artefakty pipeline'u)

Recenzja świeżym okiem, z naciskiem na to, czego `/verify` nie mogło złapać: weryfikacja testowała
lektora na dostawcy `azure_tts` (rodzaj, którego w bazie nie ma nikt inny), więc **nie wyszedł
najpoważniejszy przypadek — kolizja dwóch dostawców o tym samym `kind`**.

---

## R-1 — `applySpeechProvider` przestawia CUDZEGO dostawcę i wyłącza cały asystent

- **Plik:** `worldofmag/src/actions/llmConfig.ts:282-290`
- **Kategoria:** correctness (**krytyczne**)
- **Opis:** Dostawca jest wyszukiwany po **samym `kind`** (`findFirst({ where: { kind: spec.kind } })`,
  `orderBy: createdAt asc`), a następnie **nadpisywany jest jego `baseUrl`**. Tymczasem `kind`
  **nie identyfikuje** pozycji katalogu: `openai_compat` mają zarówno **OpenAI**, jak i **Groq
  PlayAI** — a w każdej instalacji Omnii istnieje domyślny wiersz Groqa obsługujący czat.

**Scenariusz awarii (konkretnie):**
1. Standardowa instalacja: dostawca „Groq (domyślny)", `kind=openai_compat`,
   `baseUrl=https://api.groq.com/openai/v1`, klucz `gsk_…`, przypisany do `dispatch`, `reasoning`,
   `vision`, `generation`.
2. Administrator wchodzi w `/admin/llm` → „Synteza mowy" → wybiera **OpenAI**, model
   `gpt-4o-mini-tts` → „Zapisz lektora". Pole klucza **nie jest nawet pokazane** (patrz R-2).
3. `applySpeechProvider` trafia na **wiersz Groqa** i ustawia mu
   `baseUrl = https://api.openai.com/v1`, zachowując klucz Groqa.
4. Od tej chwili **każde** wywołanie asystenta (`dispatch`/`reasoning`/`vision`/`generation`) leci na
   `api.openai.com` z kluczem Groqa → `401` → użytkownik widzi „Asystent chwilowo nie może połączyć
   się z modelem AI". **Cały asystent przestaje działać**, a administrator nie ma powodu łączyć tego
   z włączeniem lektora.

- **Poprawka:** szukać i zakładać dostawcę po **`kind` + znormalizowanym `baseUrl`**; przy braku
  dokładnego trafienia **utworzyć nowy wiersz**, a **nigdy** nie przestawiać `baseUrl` istniejącego
  dostawcy na inny host. (Dla Azure, gdzie region jest w adresie, dopuszczalne jest dopasowanie po
  `kind` + wyborze administratora — ale tam `kind` jest już unikalny w katalogu.)

## R-2 — `getSpeechConfig` pokazuje stan klucza CUDZEGO dostawcy

- **Plik:** `worldofmag/src/actions/llmConfig.ts:~218` (`providers.find((p) => p.kind === spec.kind)`)
- **Kategoria:** correctness (wysokie) — to ono czyni R-1 **cichym**
- **Opis:** `providerExists`/`hasKey` liczone są po samym `kind`, więc pozycja **OpenAI** raportuje
  stan klucza **Groqa** (i odwrotnie).
- **Scenariusz awarii:** administrator widzi przy OpenAI zieloną adnotację „klucz zapisany", więc
  `needsKey` jest fałszywe i **pole klucza się nie renderuje** — nie ma jak podać klucza OpenAI, a
  zapis (R-1) niszczy konfigurację czatu. Nawet bez R-1 lektor byłby wołany z niewłaściwym kluczem.
- **Poprawka:** dopasowanie po `kind` + `baseUrl` (jak w `findTtsProvider`).

## R-3 — głosy wybierane po `kind`, więc Groq PlayAI dostaje głosy OpenAI

- **Pliki:** `worldofmag/src/lib/tts/catalog.ts:~178` (`voicesForKind`, `isVoiceOfKind`,
  `defaultVoiceForKind`), używane w `serverTts.ts:41,74` i `actions/assistantPrefs.ts:112`
- **Kategoria:** correctness (średnie)
- **Opis:** Te trzy helpery szukają pozycji katalogu **po samym `kind`**, więc dla
  `openai_compat` **zawsze** trafiają w wpis OpenAI — nawet gdy skonfigurowano **Groq PlayAI**
  (którego głosy to `Fritz-PlayAI`, `Arista-PlayAI`, `Atlas-PlayAI`).
- **Scenariusz awarii:** administrator ustawia lektora na Groq PlayAI. Użytkownik w ustawieniach
  asystenta dostaje listę głosów **OpenAI** (`nova`, `shimmer`, …), wybiera `nova`, a `synthesizeSpeech`
  wysyła `voice: "nova"` do Groqa → dostawca odpowiada błędem → `502` i cisza zamiast lektora. Ten sam
  mechanizm wybiera zły głos domyślny, więc funkcja nie działa **nawet bez** wyboru użytkownika.
- **Poprawka:** kluczować po pozycji katalogu (`findTtsProvider(kind, baseUrl)`), a nie po `kind`;
  helpery przyjmują `kind + baseUrl` (z zachowaniem dotychczasowego fallbacku na `kind`, żeby zmiana
  regionu Azure nadal działała).

## R-4 — martwy kod po refaktorze (C-53)

- **Pliki:** `worldofmag/src/lib/tts/serverTts.ts:68` (`isServerSpeechConfigured`),
  `worldofmag/src/lib/tts/serverVoices.ts` (`DEFAULT_SERVER_VOICE`, `isServerVoiceId`)
- **Kategoria:** simplification
- **Opis:** Po przejściu `assistantPrefs` na `configuredSpeechVoices` żaden z tych trzech eksportów
  nie ma już ani jednego użycia poza własnym plikiem (sprawdzone `grep` po `src/`).
- **Skutek:** martwy kod myli następnego czytającego — `isServerSpeechConfigured()` sugeruje, że
  „skonfigurowany" wystarcza, choć `synthesizeSpeech` może i tak zwrócić `null` (brak znanych głosów).
- **Poprawka:** usunąć trzy nieużywane eksporty.

## R-5 — osierocony komentarz opisuje inną funkcję

- **Plik:** `worldofmag/src/lib/ai/agentTools.ts:248-258`
- **Kategoria:** convention
- **Opis:** Blok JSDoc z paczki 025 (opisujący kontrakt `resolveProjectRef`, w tym nieaktualne
  `{ unresolved, available }`) został po refaktorze **nad `resolveRefOrThrow`**, więc dwa bloki JSDoc
  stoją jeden na drugim, a pierwszy opisuje inną funkcję.
- **Poprawka:** przenieść blok 025 z powrotem nad `resolveProjectRef`.

## R-6 — zmarnowane wywołanie modelu przy fallbacku `dispatch → reasoning`

- **Plik:** `worldofmag/src/app/api/llm/home/agent/route.ts:814` (wywołanie `summarizePartialRun`)
  vs `:1067-1072` (`runLoop`)
- **Kategoria:** efficiency (podniesione z `verify.md` U-1)
- **Opis:** `runAgentLoopRaw` **zawsze** dokłada jedno wywołanie modelu na podsumowanie przed
  zwróceniem `limitReached: true`, a `runLoop` dla prostej tury odczytowej **ponawia cały przebieg**
  na `reasoning` — więc podsumowanie pierwszego przebiegu jest **odrzucane**.
- **Skutek:** płatne wywołanie bez żadnej korzyści, w feature'rze, którego sensem jest ukrócenie
  spalania budżetu. **Nie jest to regresja** (bilans ≈8 wywołań wobec ≈12 przed zmianą), ale zostawia
  pieniądze na stole. Nie dotyczy scenariusza Z-2 (fraza „dlaczego" → `isSimpleRead` fałszywe).
- **Poprawka:** podsumowanie tylko dla przebiegu **ostatecznego** — np. parametr
  `summarizeOnPartial` przekazywany przez `runLoop` (fałsz dla pierwszego przebiegu, gdy istnieje
  `baselineMessages`).

## R-7 — dwa zbędne zapytania na typowej ścieżce

- **Pliki:** `worldofmag/src/lib/ai/agentTools.ts:998-1006` (`get_recipe`), `:513-521` (`list_items`)
- **Kategoria:** efficiency (drobne)
- **Opis:** (a) `get_recipe` woła `getRecipe(ref)` w `findById`, a potem **ponownie** `getRecipe(key)`
  na końcu — dwa razy to samo dla poprawnego id/sluga. (b) `list_items` liczy
  `accessibleListWhere(userId)` (czyli `getUserTeamIds`) dwukrotnie: raz w resolverze, raz w głównym
  zapytaniu.
- **Skutek:** wyłącznie narzut, bez błędu.
- **Poprawka:** przekazać wynik pierwszego `getRecipe` dalej; wyciągnąć `accessibleListWhere` do
  zmiennej przed oboma użyciami.

## R-8 — nieaktualna flaga ucięcia może źle nazwać przyczynę

- **Plik:** `worldofmag/src/app/api/llm/home/agent/route.ts:633` (`lastTruncated = truncated`)
- **Kategoria:** correctness (drobne)
- **Opis:** `lastTruncated` nie jest zerowane po udanym sparsowaniu. Jeśli ucięcie zdarzy się w
  iteracji 1 i zostanie odratowane, a przebieg skończy się później z innego powodu, podsumowanie
  awaryjne poda przyczynę „odpowiedź nie zmieściła się w dopuszczalnej długości" — nieprawdziwą.
- **Skutek:** mylący (ale wciąż użyteczny) komunikat w rzadkim przypadku; ścieżka główna
  (podsumowanie modelem) nie jest tym dotknięta.
- **Poprawka:** ustawiać `lastTruncated` tylko na wyjściu z pętli prób (albo zerować po sparsowaniu).

---

## Co jest dobre (żeby nie zgubić w naprawie)

- **Podwójna bariera** przed przypisaniem dostawcy tylko-TTS do operacji czatowej (`setAssignment` +
  `resolveLlmChain`) — właściwa reakcja na realne ryzyko, obie sprawdzone uruchomieniem.
- **Rozdzielenie „nie ma" od „pasuje kilka"** w `refResolve` — to jest sedno naprawy Z-2 po stronie
  odczytów, z pokryciem testowym i naprawioną zastaną luką (pusta referencja).
- **Kontrola dostępu brudnopisu** przez `updateMany` z `userId` — milczenie zamiast potwierdzania
  istnienia cudzej rozmowy (C-21), sprawdzone uruchomieniem.
- **Adaptery TTS** w jednym `switch`, bez nowych zależności, z escapowaniem SSML pokrytym testem.
- Zero enumów Prisma, zero hardcodowanych kolorów (a nawet **usunięty** zastany hex), teksty po polsku.

## Werdykt

**ZMIANY WYMAGANE.**

Blokujące: **R-1**, **R-2**, **R-3** — wszystkie mają jedną wspólną przyczynę: **`kind` został użyty
jako klucz pozycji katalogu, a nie jest unikalny** (OpenAI i Groq PlayAI dzielą `openai_compat`).
Najgorszy skutek — konfiguracja lektora przestawia adres dostawcy używanego przez czat i **wyłącza
cały asystent AI** — jest dokładnie tym rodzajem awarii, której ten feature miał zapobiegać, a nie
tworzyć.

Do naprawy razem z nimi (tanie, w tym samym obszarze): **R-4**, **R-5**, **R-6**, **R-7**, **R-8**.

Nie merguję do `develop`. Zawracam do `/implement` z zadaniami **T-32…T-36**.
