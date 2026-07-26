# Recenzja: Asystent AI — katalog syntezy mowy, cykl życia czatu i domknięcie usterek UX

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-07-26
- **Diff:** `origin/develop...HEAD` — 31 plików, ~+3400 / −140 (z czego ~1500 to artefakty pipeline'u)

---

# Tura 1 — ZMIANY WYMAGANE (naprawione)

Recenzja świeżym okiem trafiła w błąd, którego weryfikacja nie mogła złapać: testowała lektora na
`azure_tts`, czyli rodzaju, którego w bazie nie ma nikt inny, więc kolizja `openai_compat` nigdy się
nie ujawniła.

## R-1 — `applySpeechProvider` przestawiał CUDZEGO dostawcę i wyłączał cały asystent

- **Plik:** `worldofmag/src/actions/llmConfig.ts:282-290` (stan przed naprawą)
- **Kategoria:** correctness (**krytyczne**)
- **Opis:** Dostawca był wyszukiwany po **samym `kind`**, a następnie nadpisywany był jego `baseUrl`.
  `kind` **nie identyfikuje** pozycji katalogu: `openai_compat` mają zarówno OpenAI, jak i Groq PlayAI.
- **Scenariusz awarii:** (1) standardowa instalacja z dostawcą „Groq (domyślny)" przypisanym do
  `dispatch`/`reasoning`/`vision`/`generation`; (2) administrator wybiera w panelu lektora **OpenAI**
  i zapisuje; (3) wiersz Groqa dostaje `baseUrl = api.openai.com`, zachowując klucz Groqa;
  (4) **każde** wywołanie asystenta zwraca `401` — cały asystent przestaje działać, bez widocznego
  związku z włączeniem lektora.
- **Status:** ✅ **naprawione (T-32).** Wspólny `providerMatchesSpec` dopasowuje po `kind` **+**
  `baseUrl`; brak trafienia → **nowy** wiersz zamiast przestawienia cudzego. Dowód: test
  `providerMatchesSpec: zapis lektora OpenAI NIE MOŻE trafić w wiersz Groqa (R-1)`.

## R-2 — `getSpeechConfig` pokazywał stan klucza CUDZEGO dostawcy

- **Plik:** `worldofmag/src/actions/llmConfig.ts:~228`
- **Kategoria:** correctness (wysokie) — to ono czyniło R-1 **cichym**
- **Scenariusz awarii:** pozycja OpenAI raportowała `hasKey` z wiersza Groqa, więc pole klucza się nie
  renderowało — nie było jak podać klucza OpenAI, a zapis niszczył konfigurację czatu.
- **Status:** ✅ **naprawione (T-32)** — odczyt i zapis używają **tej samej** funkcji dopasowania, więc
  panel nie może pokazać czegoś innego, niż zrobi przycisk.

## R-3 — głosy wybierane po `kind`, więc Groq PlayAI dostawał głosy OpenAI

- **Pliki:** `worldofmag/src/lib/tts/catalog.ts`, `serverTts.ts`, `actions/assistantPrefs.ts`
- **Kategoria:** correctness (średnie)
- **Scenariusz awarii:** przy lektorze na Groq PlayAI użytkownik dostawał listę głosów OpenAI
  (`nova`…), wybierał `nova`, a żądanie szło do Groqa → błąd dostawcy i cisza zamiast lektora.
- **Status:** ✅ **naprawione (T-32)** — `voicesFor`/`isVoiceOf`/`defaultVoiceFor` kluczują po pozycji
  katalogu. Dowód **na żywej bazie**: lektor na Groqu → `Fritz-PlayAI, Arista-PlayAI, Atlas-PlayAI`;
  po przełączeniu na OpenAI → `nova, shimmer, coral, sage`.

## R-4 · R-5 · R-6 · R-7 · R-8 — drobne

| Ust. | Opis | Status |
|---|---|---|
| **R-4** | martwe eksporty po refaktorze (`isServerSpeechConfigured`, `DEFAULT_SERVER_VOICE`, `isServerVoiceId`) — C-53 | ✅ usunięte (T-34) |
| **R-5** | osierocony JSDoc z 025 opisujący inną funkcję | ✅ wrócił nad `resolveProjectRef` (T-34) |
| **R-6** | zmarnowane, płatne wywołanie podsumowania przed fallbackiem `dispatch→reasoning` | ✅ `isFinalRun` (T-33) |
| **R-7** | `get_recipe` wołało `getRecipe` dwa razy; `list_items` liczyło dostęp dwa razy | ✅ (T-35) |
| **R-8** | nieaktualna flaga ucięcia mogła źle nazwać przyczynę niedokończenia | ✅ zerowana po sparsowaniu (T-36) |

## R-9 — znaleziona przy naprawie: walidacja głosu po stronie klienta blokowała lektora

- **Plik:** `worldofmag/src/lib/tts/serverVoices.ts:37-41` (stan przed naprawą)
- **Kategoria:** correctness (wysokie) — **trzecia odsłona tej samej przyczyny**
- **Opis:** `parseServerVoiceValue` sprawdzał przynależność głosu do **stałej listy OpenAI**.
- **Scenariusz awarii:** administrator ustawia lektora na Azure, użytkownik wybiera „Zofia" —
  `parseServerVoiceValue` zwraca `null`, UI traktuje wybór jako **głos przeglądarki** i zapisuje
  `voiceKind: "browser"`. Lektor serwerowy **nigdy** się nie włącza dla dostawcy spoza rodziny OpenAI.
- **Status:** ✅ **naprawione (T-32)** — funkcja tylko zdejmuje prefiks; walidacja należy do serwera
  (`updateAssistantPrefs`, `synthesizeSpeech`), bo dopuszczalna lista zależy od konfiguracji.

---

# Tura 2 — recenzja naprawy (T-32…T-36)

Przejrzany diff `f8265fc..HEAD` (8 plików, +217 / −80). Sprawdzone celowo:

- **Poprawność dopasowania.** `providerMatchesSpec` zwraca `false` przy różnym rodzaju, `true` przy
  zgodnym adresie (z normalizacją ukośnika), a fallback po rodzaju **wyłącznie** gdy rodzaj jest
  unikalny. Przypadek Azure ze zmienionym regionem nadal aktualizuje wiersz w miejscu (nie mnoży
  dostawców), przypadek OpenAI vs Groq nigdy się nie myli — jedno i drugie pokryte testem.
- **Zapis klucza.** `applySpeechProvider` nadal nie nadpisuje klucza pustą wartością, a przy zakładaniu
  nowego dostawcy wymaga klucza, gdy pozycja go wymaga. Klucz nigdy nie wraca w DTO (tylko `hasKey`).
- **`isFinalRun`.** Wartość domyślna `true` — każde istniejące wywołanie zachowuje dotychczasowe
  zachowanie; `false` przekazywane wyłącznie tam, gdzie wołający ma w zapasie ponowienie, a wynik
  pierwszego przebiegu jest odrzucany. Wypełniacz nigdy nie dociera do użytkownika.
- **`lastTruncated`.** Zerowane po udanym sparsowaniu, więc opisuje wyłącznie ostatnią **nieudaną**
  odpowiedź — zgodnie z tym, do czego służy.
- **Brak nowych naruszeń konwencji:** zero enumów Prisma, zero hexów, teksty po polsku, importy przez
  alias, praca wyłącznie w `worldofmag/`.

**Poprawka naniesiona w recenzji (drobna, bezpieczna):** nieaktualna nazwa funkcji w komentarzu
`llmConfig.ts` (`matchesSpec` → `providerMatchesSpec`).

**Ustalenia otwarte:** brak blokujących. Pozostaje jedna **świadoma** decyzja, odnotowana w
`verify.md` §8: dostawca zgodny z OpenAI pod adresem **spoza katalogu** (proxy/self-host) nie ma
znanych głosów, więc lektor jest wyłączony (klient wraca do głosów przeglądarki) zamiast zgadywać
nazwy głosów. To celowe — zgadywanie było przyczyną R-3, a ścieżka z panelu zawsze podaje adres
katalogowy.

---

## Co jest dobre (żeby nie zgubić przy dalszych zmianach)

- **Jedna funkcja dopasowania dla odczytu i zapisu** — konstrukcyjnie uniemożliwia rozjazd „panel
  pokazuje co innego, niż zrobi przycisk". To jest właściwa naprawa R-1/R-2, nie łatka na objaw.
- **Podwójna bariera** przed przypisaniem dostawcy tylko-TTS do operacji czatowej (`setAssignment` +
  `resolveLlmChain`), obie sprawdzone uruchomieniem.
- **Rozdzielenie „nie ma" od „pasuje kilka"** w `refResolve` — sedno naprawy Z-2 po stronie odczytów,
  z pokryciem testowym i naprawioną zastaną luką (pusta referencja dopasowująca się do wszystkiego).
- **Kontrola dostępu brudnopisu** przez `updateMany` z `userId` — milczenie zamiast potwierdzania
  istnienia cudzej rozmowy (C-21), sprawdzone uruchomieniem.
- **Adaptery TTS** w jednym `switch`, bez nowych zależności, z escapowaniem SSML pokrytym testem i
  trzema torami przepuszczonymi end-to-end przez lokalną atrapę.
- Przy okazji usunięte **zastane** problemy: hardcodowany hex w `ActionDrawer` (C-30) i martwy cleanup
  w komponencie, który nigdy się nie odmontowuje.

## Werdykt

**APPROVE Z UWAGAMI.**

Wszystkie ustalenia blokujące (R-1, R-2, R-3, R-9) naprawione i potwierdzone — dwa z nich dowodem
uruchomionym na żywej bazie, nie samą lekturą kodu. Bramki zielone: `check:migrations`,
`check:actions`, `check:ai-coverage`, `tsc --noEmit`, `next lint` (0 błędów, 16 zastanych ostrzeżeń),
`next build`, `test:unit` **521/521**.

**Uwagi (nie-blokujące), świadomie zaakceptowane:**
1. Dostawca OpenAI-compat pod adresem spoza katalogu wyłącza lektora zamiast zgadywać głosy.
2. Ucięcie, które mimo wszystko sparsowało się, idzie dalej normalnie (mamy użyteczny krok).
3. Do sprawdzenia klikiem na środowisku testowym: scenariusz Z-2 (AC-12), klawiatura mobilna na iOS
   (AC-19/AC-20), zamknięcie asystenta w trakcie generowania, panel lektora z prawdziwym kluczem
   dostawcy (AC-4/AC-5 na żywym API).

Merge do `develop` i promocja `develop → master` zgodnie z C-52.
