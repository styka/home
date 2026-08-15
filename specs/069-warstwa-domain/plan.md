# Plan techniczny: Warstwa `domain/` — reguły biznesowe dają się sprawdzić bez bazy

- **Spec:** ./spec.md (069-warstwa-domain)
- **Status:** draft
- **Data:** 2026-08-14

## 1. Podejście

Trzy ruchy, w tej kolejności: **(1)** rozstrzygnąć klasyfikacyjnie wszystkie 55 pomocników
z plików akcji, **(2)** wyprowadzić te, które są regułą, do `src/modules/<x>/domain/` (oraz — dla
akcji przekrojowych spoza modułów — do odpowiedniej zdolności w `src/platform/`) i dopisać każdej
test bez bazy, **(3)** domknąć pozycję bramką `check:domain` z manifestem nad wszystkimi 21
modułami plus **zapadką** na liczbie reguł pozostających w plikach akcji.

Wzorcem jest **przebieg 064** (pomiar wywrócił zakres: „19 modułów" okazało się sześcioma, a pozycję
zamknął manifest z uzasadnieniem per moduł) i **068** (zapadka jako sposób zatrzymania wzrostu długu
bez udawania, że go spłacono). Wzorcem kodu warstwy są istniejące czyste pliki modułowe —
`src/modules/shopping/lib/parseQuantity.ts` z testem w `lib/__tests__/parseQuantity.test.ts`:
funkcja bez zależności, test tabelką przypadków. Naśladujemy dokładnie ten styl.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Zero nowych modeli, kolumn i migracji — to przeniesienie kodu, nie zmiana
danych. `npm run check:schema-drift` i `check:migrations` muszą zostać zielone bez żadnego nowego
pliku migracji; ich zielony wynik jest wręcz **dowodem**, że przebieg nie ruszył bazy.

## 3. Warstwa serwera (Server Actions — C-20)

Akcje **nie zmieniają sygnatur, guardów ani `revalidatePath`**. Jedyna zmiana w pliku akcji to:
usunięcie ciała pomocnika i dopisanie importu z `./domain/<plik>` (ścieżka względna — C-02/C-36,
własne wnętrze modułu importujemy względnie).

**Krytyczne dla C-21:** żaden guard dostępu nie wychodzi z akcji. Wszystkie pomocniki dostępowe
(`assertScheduleAccess`, `accessiblePetIds`, `ownershipFilter`, `accessibleProjectIds`, `uniqueSlug`)
są **asynchroniczne i dotykają bazy**, więc z definicji nie kwalifikują się do warstwy reguł — nie ma
ryzyka przypadkowego wyniesienia decyzji o dostępie. Bramka dodatkowo tego pilnuje: kod domeny nie
może importować Prismy ani sesji.

### 3.1. Klasyfikacja 55 pomocników (AC-1)

Kryterium ze speca §8: **reguła** odpowiada na pytanie z dziedziny użytkownika (ile / kiedy / czy
wolno / jak to nazwać) i jej wynik dałoby się zakwestionować w rozmowie z właścicielem.
**Adapter** tłumaczy kształty, woła infrastrukturę albo broni się przed złym typem wejścia.

**REGUŁY — 21 pozycji do wyprowadzenia:**

| # | Pomocnik | Plik dziś | Dlaczego reguła |
|---|----------|-----------|-----------------|
| 1–3 | `normalizeDays`, `normalizeGoal`, `normalizeReminder` | `habits/actions/habits.ts` | „pełny tydzień = codziennie → zapisz `null`", cel tygodniowy ograniczony do 1–7, godzina przycięta do 23:59 — to decyzje dziedzinowe, nie obrona typu |
| 4–6 | `normTimes`, `normDays`, `normFreq` | `health/actions/medications.ts` | kształt harmonogramu leku: unikalne posortowane godziny, dni 0–6, nieznana częstotliwość → `DAILY`. Pomyłka = lek o złej porze |
| 7 | `dayKeyUTC` | `kitchen/actions/mealPlans.ts` | **południe UTC** jako klucz dnia planu — wybór podyktowany tym, że `setUTCHours(0)` przesuwa dzień w PL. Ma komentarz z uzasadnieniem i zero testu |
| 8 | `slugify` | `kitchen/actions/recipes.ts` | tożsamość przepisu w adresie; transliteracja PL, limit 80, wartość awaryjna `"przepis"` |
| 9 | `nextDueFrom` | `pets/actions/petCare.ts` | następny termin opieki + **ucięcie po `endDate`** — reguła nawrotu, nie adapter |
| 10 | `signedBalance` | `portfel/actions/portfel.ts` | znak salda wg rodzaju elementu (dług na minus). Pomyłka = błędny majątek netto, cicha |
| 11–12 | `startOfMonth`, `monthRange` | `portfel/actions/portfelBudgets.ts`, `portfelReports.ts` | granice okresu rozliczeniowego (z przesunięciem miesięcy) — klasyczny przypadek brzegowy przełomu roku |
| 13 | `normCurrency` | `portfel/actions/portfelCurrency.ts` | kod waluty: wielkie litery, limit 8 znaków |
| 14 | `normalizeSlug` | `qa/actions/qa.ts` | jak #8, dla scenariuszy QA (**inna implementacja niż #8** — patrz obserwacja w §9) |
| 15–16 | `clamp` + blok granic profilu | `truck/actions/truck.ts` | dopuszczalne wymiary pojazdu (masa 1–120 t, wysokość 1–6 m, …) — reguła dziedzinowa transportu |
| 17 | `nearestVertexDist2` | `truck/actions/truck.ts` | geometria korytarza: czy roboty leżą przy trasie |
| 18–19 | `resolveWhen`, `roundedBrief` | `weather/actions/weather.ts` | wybór dnia i pory z zapasowym zachowaniem, oraz **polityka zaokrągleń odcisku warunków** (038) — jej pomyłka po cichu unieważnia zapamiętaną treść AI |
| 20 | `deriveTitle` | `src/actions/aiConversations.ts` | tytuł rozmowy: 7 słów, ucięcie na 60 znaków, wartość awaryjna |
| 21 | `sanitizeColor` + `sanitizeIcon` | `src/actions/favoriteViews.ts` | egzekwowanie C-30 (do bazy nie ma prawa trafić hex) i limit 2 znaków ikony |

**ADAPTERY — 34 pozycje, zostają na miejscu.** Zbiorczo, z powodem:

- **Tłumaczenie kształtów (13):** `toDTO` ×3 (contacts, favoriteViews, userFacts), `toItemDTO`
  (news), `toItem` (shopping), `toProject`/`toTask` (tasks), `toView` (skins), `parseTags`
  (contacts), `parseProjectIds` (tasks), `parseArr` (dashboardPrefs), `choiceKey`
  (assistantPrefs), `feedUrl` (calendar — dokleja `AUTH_URL`, czyli infrastruktura).
- **Obrona przed złym typem, bez decyzji dziedzinowej (9):** `safeDate` ×2 (health, medications),
  `toDate` ×2 (magazynowanie, warsztaty), `asDate` (trash), `parseLevel`/`parseVoiceKind`
  (assistantPrefs), `normalizeProviderKind` (llmConfig), `scheme` (skins).
- **Wywołanie infrastruktury (3):** `revalidatePet` ×2 (pets), `revalidateMed` (health).
- **Tekst promptu / prezentacja (8):** `lengthInstruction` (news), `dailyDigest`, `hourlyDigest`,
  `digestHours`, `weatherBrief`, `weekday` (weather), `monthLabel` (portfel), `csvTxnSourceId`
  (portfel). **Świadome uzasadnienie:** to są literały i sklejanie napisów; test sprawdzałby, że
  napis brzmi tak, jak brzmi — a wtedy każda korekta stylu prompta wywala test, nie wykrywając
  żadnego błędu. Testy, które trzeba poprawiać przy każdej zmianie tekstu, uczą je wyłączać.
- **Granica: `startOfToday` (health)** — liczy północ dnia bieżącego z zegara **serwera**, mimo że
  Omnia ma `lib/userTime.ts` do granic doby w strefie użytkownika. To jest **potencjalny błąd, nie
  brak testu**, więc naprawa nie należy do tego przebiegu (C-53) → obserwacja w dzienniku i wpis
  w manifeście.

### 3.2. Zmiany kształtu wymuszone testowalnością (AC-8)

Trzy reguły czytają dziś zegar samodzielnie. Żeby dały się sprawdzić, **przyjmują „teraz"
parametrem z wartością domyślną `new Date()`** — wywołanie w akcji zostaje bez zmian, więc
zachowanie dla użytkownika jest identyczne, a test podaje datę jawnie:

| Reguła | Było | Jest | Test dowodzi |
|--------|------|------|--------------|
| `startOfMonth` | `d = new Date()` w sygnaturze | bez zmian (już parametryzowana) | przełom roku |
| `monthRange(offset)` | `const now = new Date()` w ciele | `monthRange(offset, teraz = new Date())` | `offset` cofający przez styczeń → grudzień roku poprzedniego |
| `resolveWhen` | `new Date().toISOString()` jako wartość awaryjna | `resolveWhen(f, opts, teraz = new Date())` | pusta prognoza → data z „teraz", nie awaria |

**Sprostowanie po przeczytaniu kodu (C-54):** plan zakładał, że `nextDueFrom` też czyta zegar.
Nie czyta — `new Date(rule.endDate)` **parsuje datę końca reguły**, a nie pobiera „teraz". Funkcja
jest już czysta wobec czasu i **nie wymaga zmiany kształtu**. Zmiany z AC-8 dotyczą więc dwóch
reguł (`monthRange`, `resolveWhen`), nie trzech; `startOfMonth` był parametryzowany od początku.

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Zero nowych slugów, zero wpięć w `permissions.ts` / `modules.tsx` / `ModuleSidebar`.
Warstwa reguł nie zna sesji — to niezmiennik pilnowany bramką, a nie deklaracja.

## 5. UI (C-30, C-31, C-32)

**Bez zmian w UI.** Zero nowych tras i komponentów. AC-10 wymaga, żeby użytkownik nie zauważył
niczego. Komunikaty nowej bramki — po polsku (C-32).

## 6. AI / integracje (C-23, C-40)

**Nie dotyczy.** Zero nowych `AIAction`, zero nowych narzędzi odczytu. Manifesty pokrycia
(`action-coverage.json`, `ai-coverage`) pozostają nietknięte; AC-9 pilnuje, żeby ich liczniki nie
spadły. Wyprowadzenie `roundedBrief` dotyka pamięci treści AI (038) — dlatego jego test celuje
w **stabilność odcisku** przy drobnej korekcie temperatury, czyli we własność, dla której powstał.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/modules/habits/domain/harmonogram.ts` | nowy | #1–3 |
| `src/modules/habits/domain/__tests__/harmonogram.test.ts` | nowy | test bez bazy |
| `src/modules/health/domain/harmonogramLeku.ts` | nowy | #4–6 |
| `src/modules/health/domain/__tests__/harmonogramLeku.test.ts` | nowy | test |
| `src/modules/kitchen/domain/dzienPlanu.ts` | nowy | #7 |
| `src/modules/kitchen/domain/slug.ts` | nowy | #8 |
| `src/modules/kitchen/domain/__tests__/{dzienPlanu,slug}.test.ts` | nowe | testy |
| `src/modules/pets/domain/terminOpieki.ts` | nowy | #9 |
| `src/modules/pets/domain/__tests__/terminOpieki.test.ts` | nowy | test |
| `src/modules/portfel/domain/majatek.ts` | nowy | #10 |
| `src/modules/portfel/domain/okres.ts` | nowy | #11–12 |
| `src/modules/portfel/domain/waluta.ts` | nowy | #13 |
| `src/modules/portfel/domain/__tests__/{majatek,okres,waluta}.test.ts` | nowe | testy |
| `src/modules/qa/domain/slug.ts` | nowy | #14 |
| `src/modules/qa/domain/__tests__/slug.test.ts` | nowy | test |
| `src/modules/truck/domain/profilPojazdu.ts` | nowy | #15–16 |
| `src/modules/truck/domain/korytarz.ts` | nowy | #17 |
| `src/modules/truck/domain/__tests__/{profilPojazdu,korytarz}.test.ts` | nowe | testy |
| `src/modules/weather/domain/pora.ts` | nowy | #18 |
| `src/modules/weather/domain/odcisk.ts` | nowy | #19 |
| `src/modules/weather/domain/__tests__/{pora,odcisk}.test.ts` | nowe | testy |
| `src/platform/ai/conversationTitle.ts` | nowy | #20 (akcja przekrojowa — nie należy do modułu) |
| `src/platform/favorites/sanitize.ts` | nowy | #21 |
| `src/platform/__tests__/{conversationTitle,favoritesSanitize}.test.ts` | nowe | testy |
| 12 plików akcji wymienionych w §3.1 | edycja | usunięcie ciała + import z `./domain/…` |
| `src/lib/domain-coverage.json` | nowy | manifest: 21 modułów + próg zapadki |
| `scripts/check-domain.js` | nowy | bramka |
| `package.json` | edycja | `check:domain` + wpięcie w `build` |
| `content/architektura/15-dziennik.md` | edycja | wpis 069 + status zadania 19 |
| `doświadczenia.md` | edycja | lekcje (C-51) |

**Umiejscowienie `domain/` względem granic (C-36):** katalog jest **wnętrzem modułu**, więc nie
trafia do `contract.ts` i nie jest widoczny dla innych modułów. Import z akcji — ścieżką względną.
`check:module-registry` nie wymaga zmian: sprawdza obecność `contract.ts`/`module.ts`, a nie listę
podkatalogów.

## 8. Bramki i weryfikacja (C-50)

### 8.1. Bramka `scripts/check-domain.js` — cztery kontrole

1. **Czystość** — plik w `src/modules/*/domain/**` ani `src/platform/**` (dla dwóch nowych plików)
   nie może zawierać `"use server"` ani importować: `@/platform/db`, `prisma`, `next/headers`,
   `next/cache`, `react`, `@/platform/auth/session`, `requireAuth`, `auth()`.
2. **Test obowiązkowy** — każdy plik `domain/x.ts` musi mieć `domain/__tests__/x.test.ts`.
3. **Manifest kompletny** — każdy z 21 katalogów w `src/modules/` ma wpis z decyzją
   (`domena` | `regula-w-lib` | `bez-regul`) i niepustym `powod`; moduł spoza manifestu = błąd,
   wpis dla nieistniejącego modułu = błąd (kontrola w obie strony, jak w `check:module-registry`).
4. **Zapadka** — liczba synchronicznych pomocników w plikach akcji (`src/modules/*/actions/*.ts`
   + `src/actions/*.ts`) nie może przekroczyć progu z manifestu; **przy spadku bramka też pada**
   i żąda obniżenia progu (dokładnie jak `check:pagination` z 068).

Wykrywanie pomocnika: linia zaczynająca się od `function ` lub `const <nazwa> = (` w pliku
z `"use server"` — ten sam sposób, którym policzono 55, więc próg i pomiar mierzą to samo.
**Próg startowy: 55 − 21 = 34** (do potwierdzenia pomiarem po wyprowadzeniu; rozbieżność oznacza
błąd w klasyfikacji i wraca do §3.1, nie do naginania progu).

### 8.2. Test negatywny bramki (AC-7)

Osobno dla **każdej** z czterech kontroli, wzorcem `scripts/check-boundaries.js` (który sam łamie
regułę i wymaga błędu): tymczasowy plik-sonda → uruchomienie bramki → wymagany niezerowy kod
wyjścia → sprzątnięcie. Powód, dla którego to nie jest przesada: `next lint` **kończy się kodem 0
przy niepoprawnej konfiguracji**, a bramka z 065 dawała fałszywe alarmy — obie awarie wyszły dopiero
przy próbie zobaczenia czerwieni.

### 8.3. Dowód „bez bazy" (AC-3)

`pg_ctlcluster 16 main stop`, uruchomienie testów warstwy reguł, oczekiwane **zielone**, ponowny
start bazy. To jedyny wiarygodny dowód — sam brak importu Prismy go nie daje, bo zależność może
wejść tranzytywnie.

### 8.4. Mapowanie AC → sposób sprawdzenia

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1 | tabela w §3.1: 21 reguł + 34 adaptery = 55, każda pozycja z powodem |
| AC-2 | każdy nowy plik testu ma przypadek typowy **i** brzegowy (przełom roku, pusty wejściowy zbiór, wartość spoza zakresu) |
| AC-3 | testy przy **zatrzymanym** Postgresie (§8.3) |
| AC-4 | kontrola 1 + jej test negatywny |
| AC-5 | kontrola 2 + jej test negatywny |
| AC-6 | kontrola 3 + jej test negatywny |
| AC-6b | kontrola 4 + jej test negatywny (w obie strony: wzrost i spadek) |
| AC-7 | cztery testy negatywne, każdy osobno, wynik w `verify.md` |
| AC-8 | tabela w §3.2 + testy tych trzech reguł z jawnie podanym „teraz" |
| AC-9 | `npm run build` + `npm run test:unit`; liczniki przed/po w `verify.md` |
| AC-10 | brak zmian w `src/app/**` i `src/components/**` (`git diff --stat`); `test:unit` + testy integracyjne zielone |

Weryfikacja lokalna: lokalny Postgres (C-13), `npm run build` do kroku `next build`.

## 9. Ryzyka techniczne i plan wycofania

- **Klasyfikacja rozjedzie się z pomiarem.** Jeśli po wyprowadzeniu zapadka nie wyjdzie na 34,
  znaczy że któraś pozycja została policzona podwójnie albo pominięta → wracamy do §3.1 i poprawiamy
  tabelę (C-54), a nie próg.
- **Cicha zmiana zachowania przy parametryzacji zegara.** Wartość domyślna `new Date()` sprawia,
  że wywołanie w akcji jest **znakowo identyczne** — ryzyko ograniczone do trzech miejsc z §3.2,
  każde z testem.
- **Dwie różne implementacje slugów (#8 i #14)** dają dla tego samego tytułu różne wyniki
  (`slugify` obcina do 80 znaków i ma wartość awaryjną, `normalizeSlug` nie; różnią się też obsługą
  `_`). Kuszące jest ujednolicenie — **nie robimy tego** (C-53): zmieniłoby adresy istniejących
  przepisów albo scenariuszy. Obie reguły idą do domeny **swoich** modułów, a rozbieżność
  odnotowujemy w dzienniku wraz z tym, dlaczego jej nie ruszamy.
- **Bramka zielona, bo nic nie sprawdza** — jedyna realna odpowiedź to §8.2.
- **Rollback:** czysto kodowy, brak migracji. `git revert` commita przywraca stan poprzedni; nic
  w bazie nie zostaje.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14 (migracje)** — bez zmian w schemacie, zero migracji; zielony `check:schema-drift`
      jest tego dowodem.
- [x] **C-20** — akcje zachowują `revalidatePath`; zmiana ogranicza się do importu.
- [x] **C-21** — żaden guard nie opuszcza akcji; wszystkie są asynchroniczne i dotykają bazy, więc
      z definicji nie kwalifikują się do warstwy, a bramka to potwierdza.
- [x] **C-22..C-25** — bez zmian (RBAC, AI, kosz, audyt nietknięte).
- [x] **C-30..C-32** — bez UI; teksty bramki po polsku.
- [x] **C-36** — `domain/` to wnętrze modułu: poza kontraktem, importowane ścieżką względną;
      dwa pliki przekrojowe trafiają do `platform/`, które **nie importuje żadnego modułu**.
- [x] **C-50** — nowa bramka wpięta w `build`; wszystkie istniejące zielone, żaden licznik nie spada.
- [x] **C-51** — lekcje do `doświadczenia.md` razem ze zmianą.
- [x] **C-53** — świadomie **nie** przenosimy 33 plików z `lib/`, **nie** ujednolicamy slugów,
      **nie** naprawiamy `startOfToday`; każde z tych trzech ma zapisany powód i trafia do dziennika
      jako obserwacja.
