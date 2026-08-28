# Zadania: Moduł Rośliny — od parapetu do hektara

- **Plan:** ./plan.md (113-modul-roslin) · **Spec:** ./spec.md · **Badania:** ./badania.md
- **Status:** in-progress (zawrót z `/review` — Faza 7)
- **Data:** 2026-08-28

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami
> (migracja → domena → akcje → UI → AI → wpięcia → bramki). Każde zadanie ≈ jeden spójny commit.
> `[P]` = niezależne od poprzedniego, można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatki)
- `[P]` — można robić równolegle

---

## Faza 0 — Fundament danych (blokuje wszystko)

- [x] **T-1** — **Uniony i typy modułu.** `src/modules/rosliny/lib/typy.ts`: `TrybPrzestrzeni`,
      `RodzajMiejsca`, `Naslonecznienie`, `JednostkaLicznosci`, `StatusRosliny`, `RodzajZabiegu`,
      `WynikZabiegu`, `RodzajPomiaru`, `ZrodloPomiaru`, `PewnoscDiagnozy`, `PochodzenieGatunku`,
      `KategoriaGatunku`. Wyłącznie `String` + union TS (**C-12**).
      *Gotowe, gdy:* `tsc --noEmit` czysto; plik nie importuje Prismy.
- [x] **T-2** — **Migracja `0272_modul_roslin`** (plan §2.3): `CREATE TABLE` dla 10 modeli, indeksy,
      FK (dzieci `ON DELETE CASCADE`, `Plant.parentId` → `SET NULL`, `workspaceId` → `Workspace`
      `CASCADE`) + idempotentny seed uprawnienia `module.rosliny` i nadanie go roli administratora.
      **`workspaceId` WYMAGANY, bez `dbgenerated()`, bez triggera** (plan §2.1a).
      *Gotowe, gdy:* `npm run check:migrations` przechodzi; `grep -E "^(DROP|ALTER)"` pokazuje
      wyłącznie `ALTER TABLE … ADD CONSTRAINT` (**C-15**).
- [x] **T-3** — **`schema.prisma`** — 10 modeli zgodnie z migracją + relacja zwrotna w `Workspace`.
      *Gotowe, gdy:* `npx prisma generate` czysto i `npm run check:schema-drift` nie zgłasza rozjazdu
      (lokalny Postgres, **C-13**).
- [x] **T-4** — **Migracja `0273_katalog_gatunkow`** — seed `PlantSpeciesCatalog`, 150–250 pozycji
      (doniczkowe, warzywa, zioła, owoce, zboża), dollar-quoting, `ON CONFLICT ("key") DO NOTHING`.
      *Gotowe, gdy:* `migrate deploy` na lokalnej bazie przechodzi dwa razy z rzędu bez błędu
      (dowód idempotencji) i tabela ma ≥150 wierszy.

## Faza 1 — Domena (czyste reguły z testami; niezależna od bazy)

- [x] **T-5** `[P]` — **`domain/harmonogram.ts`** — termin następnego zabiegu z (gatunek × miejsce ×
      sezon × prognoza) **wraz z jednozdaniowym uzasadnieniem**; przeliczenie od faktycznego
      wykonania; odsunięcie po opadach; ostrzeżenie przy przymrozku. Czysta funkcja — pogodę i datę
      dostaje parametrem. → **AC-8, AC-9, AC-10, AC-11**
      *Gotowe, gdy:* testy jednostkowe pokrywają cztery sezony, trzy nasłonecznienia i wariant
      „deszcz w prognozie"; brak importu Prismy.
- [x] **T-6** `[P]` — **`domain/plodozmian.ts`** — z historii miejsca i rodziny botanicznej wylicza
      ostrzeżenie (nie blokadę). → **AC-26**
      *Gotowe, gdy:* test pokazuje ostrzeżenie przy trzecim sezonie tej samej rodziny i milczenie
      przy zmianie rodziny.
- [x] **T-7** `[P]` — **`lib/tryb.ts`** — `poleWidoczne(tryb, pole)` + `etykietaFazy(kod, tryb)`.
      Tryb **chowa domyślnie, nigdy nie blokuje**. → **AC-2, AC-3**
      *Gotowe, gdy:* test przechodzi całą tablicę (4 tryby × pola zawodowe) i potwierdza, że żadne
      pole nie jest niedostępne po „pokaż zaawansowane".
- [x] **T-8** `[P]` — **`lib/fenologia.ts`** — słownik faz BBCH (10 głównych + używane szczegółowe),
      dwie prezentacje: kod dla trybu zawodowego, słowo po polsku dla hobby.
      *Gotowe, gdy:* test sprawdza, że każdy kod ma polską nazwę i że nieznany kod nie rzuca.
- [x] **T-9** — **Wpis w `src/lib/domain-coverage.json`** dla modułu (`decyzja: "domena"`, pliki
      z T-5..T-8, powód).
      *Gotowe, gdy:* `npm run check:domain` przechodzi.

## Faza 2 — Warstwa serwera

- [x] **T-10** — **Guard i granica.** `lib/sharingGuard.ts` (woła `requireAccess` z **własnym**
      katalogiem — nie przez korzeń kompozycji), `sharing.ts` (zasoby `rosliny.space` i
      `rosliny.plant` z rodzicem), wpięcie w `src/lib/sharingResources.ts` i wpis w
      `src/lib/sharing-classification.json`. → **AC-28**
      *Gotowe, gdy:* deklaracja i guard istnieją oraz są wpięte. **Bramka `check:module-registry`
      zamyka się dopiero po T-20** i to nie jest usterka: sprawdza ona wpięcie w obie strony wobec
      listy ZADEKLAROWANYCH modułów, a moduł staje się zadeklarowany dopiero z `module.ts`.
- [x] **T-11** — **`actions/przestrzenie.ts` + `actions/miejsca.ts`** — CRUD przestrzeni i miejsc,
      własność przez `wlasnoscDoZapisu`, odczyt przez `ownedWhereAsync`, `revalidatePath`.
      → **AC-1**
      *Gotowe, gdy:* test integracyjny zakłada przestrzeń i miejsce; `check:owner-columns`
      i `check:pagination` przechodzą.
- [x] **T-12** — **`actions/rosliny.ts`** — `getPlants`/`getPlant`/`createPlant`/`updatePlant`/
      `setPlantStatus`/`propagatePlant`/`deletePlant` + `assertPlantAccess` (cienka nakładka na dwie
      operacje deklaracji). Liczność, status z powodem, relacja rodzic → potomstwo.
      → **AC-4, AC-5, AC-6**
      *Gotowe, gdy:* testy: byt o liczności `100 szt` i `4.2 ha` zapisuje się jako jeden rekord;
      sadzonka wskazuje rodzica; zakończenie zostawia byt w historii miejsca.
- [x] **T-13** — **Kosz (C-24).** `TrashModule` += `"rosliny"`, `recordTrash` przy usuwaniu rośliny
      i przestrzeni, gałąź przywracania w `src/actions/trash.ts` + `revalidatePath`. → **AC-7**
      *Gotowe, gdy:* test: usunięcie → wiersz w `TrashItem` → przywrócenie odtwarza byt.
- [x] **T-14** — **`actions/opieka.ts`** — agenda, CRUD zadań opieki, `completeCare`/`skipCare`/
      `postponeCare` (zapis `PlantCareEvent`, przeliczenie `nextDueAt` przez `domain/harmonogram`),
      historia. Termin liczony w strefie użytkownika (`userTime.ts`). → **AC-8..AC-11**
      *Gotowe, gdy:* test: wykonanie przesuwa następny termin; pominięcie nie gubi zadania.
- [x] **T-15** `[P]` — **`actions/dziennik.ts`** — wpisy ze zdjęciem, pomiary z rodzajem i jednostką
      (`source: "manual"`). → **AC-13, AC-14**
- [x] **T-16** `[P]` — **`actions/gatunki.ts`** — wyszukiwanie w katalogu systemowym, kopiowanie do
      przestrzeni (`origin`), własny gatunek, edycja kopii. → **AC-16, AC-17**
      *Gotowe, gdy:* test: kopia ma `catalogKey` i `origin: "system"`, a edycja kopii **nie rusza**
      wiersza katalogu.
- [x] **T-17** — **`actions/zbiory.ts`** — `recordHarvest` (zdarzenie `kind: "HARVEST"`),
      `harvestToPantry` (kontrakt Kuchni), księgowanie kosztu (`bookAutoExpense`, `sourceModule:
      "rosliny"`), dopisanie do listy zakupów (kontrakt Zakupów). → **AC-15**
      *Gotowe, gdy:* test z zamockowanymi kontraktami potwierdza trzy wywołania; **żadna z tych
      rzeczy nie jest budowana w module** (granica ze spec §5).
- [x] **T-18** — **`actions/ewidencja.ts`** — `recordTreatment` z kompletem pól wymaganych od
      2026‑01‑01 (rodzaj zastosowania, numer zezwolenia, dokładna lokalizacja, dawka, powierzchnia,
      wykonujący, warunki, karencja), rejestr za okres, `exportTreatmentRegister` +
      `lib/eksportEwidencji.ts`. → **AC-24, AC-25**
      *Gotowe, gdy:* test: zapis kompletu pól; eksport za okres zawiera **wszystkie** kolumny
      i tylko zdarzenia z przestrzeni `production`/`field`.
- [x] **T-19** — **`contract.ts`** — wyłącznie to, czego potrzebują konsumenci (pulpit, kalendarz,
      read-toole i egzekutor asystenta, test izolacji najemcy). Nie „wszystko na wszelki wypadek".
      *Gotowe, gdy:* `npm run check:boundaries` przechodzi.

## Faza 3 — Rejestracja modułu i UI

- [x] **T-20** — **Deklaracja modułu.** `module.ts` (id `rosliny`, `module.rosliny`, `/rosliny`,
      `Sprout`, `var(--accent-green)`, `sideNav` leniwie, `szybkieCele`) + `module.server.ts`
      (`ai`, `calendar` — **bez `jobs`**, plan §9) + wpięcie w `src/lib/modules.tsx` i
      `src/lib/modules.server.ts`. **Nie dopisujemy do `permissions.ts`** (plan §4).
      *Gotowe, gdy:* `npm run check:module-registry` i `check:boundaries` przechodzą.
- [x] **T-21** — **Bramka trasy.** `src/app/rosliny/layout.tsx` z `wymagajDostepuDoModulu` (w
      layoucie, bo obejmuje podtrasy). → **AC-27**
      *Gotowe, gdy:* `npm run check:route-gating` przechodzi.
- [x] **T-22** — **Teksty.** `messages/pl.json` → `modules.rosliny.*` dla wszystkich widoków
      z Fazy 3. Zero literałów z polskimi znakami w komponentach (**C-32**).
      *Gotowe, gdy:* `npm run check:i18n` przechodzi (reguła bezwzględna od 097).
- [x] **T-23** — **Lista przestrzeni** `/rosliny` (`ui/RoslinyPage.tsx` + wrapper): przestrzenie
      z licznikiem roślin, kafel „do zrobienia dziś", zakładanie przestrzeni z wyborem trybu.
      `ModuleView` ze `state`, slot `settings`. → **AC-1**
- [x] **T-24** — **Widok przestrzeni** `/rosliny/[spaceId]`: rośliny, miejsca, przełącznik „pokaż
      zaawansowane" sterowany `lib/tryb`. → **AC-2, AC-3**
- [x] **T-25** — **Szczegół rośliny** `/rosliny/[spaceId]/roslina/[plantId]`: oś czasu (dziennik,
      pomiary, opieka, zdrowie), potomstwo, zmiana statusu z powodem, `confirmDialog({ destructive:
      true })` przy usuwaniu. → **AC-5, AC-6, AC-13, AC-14**
- [x] **T-26** `[P]` — **Agenda opieki** `/rosliny/opieka` — pozycje ze wszystkich przestrzeni,
      **uzasadnienie terminu przy każdej**, wykonaj / pomiń / przesuń. → **AC-9, AC-10**
- [x] **T-27** `[P]` — **Katalog gatunków** `/rosliny/katalog` — wyszukiwarka, pochodzenie wpisu,
      dodanie do swoich. → **AC-16, AC-17**
- [x] **T-28** `[P]` — **Ewidencja** `/rosliny/ewidencja` — rejestr + eksport; widok dostępny tylko
      dla przestrzeni `production`/`field`. → **AC-24, AC-25**
- [x] **T-29** — **Nawigacja boczna modułu** `ui/RoslinySideNav.tsx` + `ShareDialog` w nagłówku
      przestrzeni. → **AC-28**
- [x] **T-30** — **Manifest kontraktu widoku** — wpis `rosliny` w `src/lib/ui/view-contract.json`
      (klucz = moduł, `entries` = 6 widoków).
      *Gotowe, gdy:* `npm run check:ui-contract` przechodzi; zero hexów bez zadeklarowanej roli.
- [x] **T-31** — **Mobile i klawiatura (C-31).** Jednokolumnowy szczegół, cele dotyku `py-3`,
      `env(safe-area-inset-bottom)` w stopkach modali, skróty `j/k`, `a/n`, `e`, `/`.
      *Gotowe, gdy:* przegląd przy 360 px nie daje przewijania poziomego ani dwóch pasków nawigacji.

## Faza 4 — AI i integracje

- [x] **T-32** — **Rodzaje treści AI.** `AiContentKind` += `"rosliny.planSezonu" | "rosliny.wnioski"`;
      **obie** etykiety w `AI_SECTION_LABELS` (mapa pokrywa całą unię) i obie w `AI_SECTION_KINDS`.
      *Gotowe, gdy:* `tsc --noEmit` czysto.
- [x] **T-33** — **`actions/ai.ts` — identyfikacja i diagnoza** (`vision`): identyfikacja z propozycją
      do przyjęcia; diagnoza z **kontekstem rośliny** (gatunek, miejsce, 10 ostatnich zdarzeń,
      prognoza), wymuszonym poziomem pewności i **dopuszczalnym „nie wiem"**, zaleceniami w kolejności
      naturalne → biologiczne → chemiczne, zapisem `PlantHealthEvent` i akcją „zaplanuj zalecany
      zabieg". Model i provider **z konfiguracji** (C-40). → **AC-18, AC-19**
      *Gotowe, gdy:* test kontraktu odpowiedzi (walidacja JSON, `confidence`, wariant „nie wiem").
- [x] **T-34** — **`actions/ai.ts` — plan sezonu i wnioski** (`reasoning`, `rememberedContent`
      z `mode`): plan dla lokalizacji, trybu, tego co rośnie i historii miejsca; pozycje wysyłane do
      Zadań (`createTask`). `hashInputs` z `userContextStamp`. Obsługa `PendingContent` przez
      `AiContentPending` — **nigdy jako błąd**. → **AC-20, AC-21**
      *Gotowe, gdy:* test: drugie wejście nie woła modelu; zmiana warunków zapala `stale`.
- [x] **T-35** — **Wskaźnik kosztu.** `AiCostBadge` z **wymaganym** propem `akcja` w czterech
      miejscach („Rozpoznanie rośliny", „Diagnoza rośliny", „Plan sezonu", „Wnioski o przestrzeni")
      + `AiContentMeta` przy sekcjach pamiętanych. → **AC-22**
      *Gotowe, gdy:* `npm run check:cost-badge` i `npm run check:content-memory` przechodzą
      (wpis dla `actions/ai.ts` w manifeście pamięci treści z klasyfikacją i powodem).
- [x] **T-36** — **Asystent — odczyty i akcje.** `ai/{catalog,readTools,executor,index}.ts`;
      read-toole `list_plant_spaces`, `list_plants` (z `offset`/`take`), `plant_care_agenda`; akcje
      `create_plant_space`, `create_plant`, `log_plant_care`, `add_plant_measurement`.
      `AIActionModule` += `"rosliny"`, cztery wpisy w `actionContract.ts` z polskimi etykietami,
      egzekutory w `/api/llm/home/execute`, wpięcie w `src/lib/ai/catalog.ts`. → **AC-23**
      *Gotowe, gdy:* `npm run check:actions` przechodzi.
- [x] **T-37** — **Manifest pokrycia AI i dostępu.** Wpis w `src/lib/ai/action-coverage.json` dla
      **każdej** akcji i **każdego** odczytu modułu (`kind`, `status`, `action`, `access: "owner"`),
      przy faktycznym guardzie w ciele akcji.
      *Gotowe, gdy:* `npm run check:ai-coverage` i `npm run check:access` przechodzą.
- [x] **T-38** `[P]` — **Kalendarz.** `calendar.ts` — zaplanowane zabiegi w zakresie dat. → **AC-12**
- [x] **T-39** `[P]` — **Powiadomienia.** `syncReminders` w `src/actions/notifications.ts` +
      zapytanie o `plantCareTask` z `nextDueAt` w oknie 3 dni, idempotentnie po `dedupeKey`.
      → **AC-12**
- [x] **T-40** — **Pulpit.** `dashboard.ts` (`plantCareDue`, `plantAgenda`) + wpięcie w
      `src/lib/dashboardContributors.ts` + pola w `DashboardSnapshot` (`@/modules/home/contract`).
      **`src/app/page.tsx` pozostaje nietknięta.** → **AC-29**
      *Gotowe, gdy:* `npm run check:module-registry` przechodzi (wpięcie w obie strony).
- [x] **T-41** `[P]` — **Retencja.** `retention.ts` — polityka na zdjęcia dziennika roślin
      zakończonych; **rejestr zabiegów jawnie wyłączony** (dokumentacja o wymogu ustawowym, powód
      w pliku) + wpięcie w `src/lib/retention/polityki.ts`.

## Faza 5 — Bramki i domknięcie

- [x] **T-42** — **Tabela prawdy udostępniania** (wzorzec `pets/__tests__/truthTablePets`) dla
      `rosliny.space` i `rosliny.plant`, porównana komórka po komórce (**C-17**). → **AC-28**
- [x] **T-43** — **Test „bypass" asystenta** (wzorzec `assistantBypassPets`) — akcje modułu nie
      omijają guardu. → **AC-23**
- [x] **T-44** — **Pełna sekwencja bramek** na lokalnym Postgresie (**C-13 — nigdy prod DB**),
      zatrzymana **przed** `scripts/migrate.js`: `check:migrations`, `check:schema-drift`,
      `check:module-registry`, `check:boundaries`, `check:ui-contract`, `check:route-gating`,
      `check:actions`, `check:ai-coverage`, `check:cost-badge`, `check:content-memory`,
      `check:pagination`, `check:i18n`, `check:owner-columns`, `check:logs`, `check:workspace-fill`
      (**musi raportować tyle samo tabel co przed zmianą — 4; nowe tabele mają przestrzeń wymaganą,
      więc nie wchodzą do tej listy**), `check:tailwind`, `check:test-types`,
      `tsc --noEmit`, `next lint`, `next build`. → **AC-30**
- [x] **T-45** — **Aktualizacja `CLAUDE.md`** — wiersz modułu w tabeli, blok Route Structure, lista
      uprawnień, sekcja schematu bazy. („Keep this table honest.")
- [x] **T-46** — **Mapowanie AC → wynik** jako wejście do `/verify`.
- [x] **T-47** — **Wpis do `doświadczenia.md`** (C-51), jeśli po drodze wyszedł nieoczywisty problem.

## Faza 6 — Domknięcie braków z weryfikacji (C-54: zawrót z `/verify`)

> **Jedna przyczyna wszystkich dziewięciu pozycji: warstwa serwera jest kompletna, a widoki jej nie
> wołają.** Osiem guardowanych, sklasyfikowanych funkcji nie ma konsumenta — czyli dla użytkownika
> nie istnieje (**C-35**: „gotowe znaczy WPIĘTE"). Bramki tego nie złapały, bo pytają o poprawność
> podłączenia do platformy, nie o dostępność funkcji. Żaden z braków nie wynika z błędnego speca ani
> planu, więc poprawka idzie wprost w kod.

- [x] **T-48** — **Harmonogram przy nowej roślinie.** `createPlant` zakłada zadanie opieki
      (podlewanie) i liczy jego pierwszy termin regułą dziedzinową. → **AC-8**
      *Gotowe, gdy:* test integracyjny potwierdza, że po dodaniu rośliny istnieje zadanie z terminem
      i **niepustym uzasadnieniem**.
- [x] **T-49** — **Lokalizacja pogodowa przestrzeni.** Wybór lokalizacji (z kontraktu Pogody)
      w ustawieniach przestrzeni — slot `settings` widoku, nie zakładka (C-33). → **AC-11**
      *Gotowe, gdy:* zapis ustawia `weatherLocationId`, a agenda pokazuje uzasadnienie z pogodą.
- [x] **T-50** `[P]` — **Zdjęcie we wpisie dziennika.** → **AC-13**
- [x] **T-51** — **Zbiór i trzy wyjścia.** Formularz zbioru w szczególe rośliny + przyciski „do
      spiżarni", „zapisz koszt", „dopisz do zakupów". → **AC-15**
      *Gotowe, gdy:* każdy przycisk woła kontrakt obcego modułu, a druga próba wysłania do spiżarni
      nie tworzy drugiej pozycji.
- [x] **T-52** `[P]` — **Własny gatunek** w widoku katalogu. → **AC-17**
- [x] **T-53** — **Rozpoznanie ze zdjęcia + „zaplanuj zalecany zabieg".** Przyjęcie propozycji
      wypełnia gatunek rośliny; zalecenie z `zabieg` zakłada zadanie opieki. → **AC-18, AC-19**
- [x] **T-54** — **Plan sezonu → Zadania**, formularz zabiegu z polami ewidencji, ostrzeżenie
      płodozmianowe przy zakładaniu uprawy. → **AC-20, AC-24, AC-26**
      *Gotowe, gdy:* pozycja planu tworzy zadanie przez kontrakt Zadań (usuwa też rozjazd wobec
      planu §6.3), zapis zabiegu zwraca listę braków, a ostrzeżenie jest OSTRZEŻENIEM, nie blokadą.
- [x] **T-55** — Ponowny przebieg bramek + testów, aktualizacja `verify.md`.

## Faza 7 — Ustalenia recenzji (C-54: zawrót z `/review`)

> Recenzja świeżym okiem znalazła cztery ustalenia blokujące i sześć dotykających kryteriów
> akceptacji. **Wspólny mianownik dwóch najgorszych: weryfikacja zaliczyła kryterium na podstawie
> OBECNOŚCI mechanizmu, a nie jego SKUTKU** — `ShareDialog` istnieje, więc uznałem udostępnianie za
> działające; `deleteSpace` istnieje, więc uznałem usuwanie przestrzeni za dostępne. Pełny opis
> w `review.md`.

- [x] **T-56** — **Migawka kosza obejmuje ewidencję.** `deleteSpace` zapisuje `careTasks`
      i `careEvents`; `restoreRosliny` je odtwarza. → **U-1, AC-7, AC-24**
      *Gotowe, gdy:* test kasuje przestrzeń z zabiegiem ŚOR i po przywróceniu **odzyskuje wpis
      ewidencji z numerem zezwolenia**.
- [x] **T-57** — **Przywrócenie rośliny odtwarza jej historię i daty.** Dziennik, pomiary, zdarzenia
      zdrowotne oraz `sownAt`/`acquiredAt`/`statusAt`/`parentId` (**korekta po recenzji 2:** rodzic świadomie NIE wraca — roślina-matka mogła nie należeć do tej przestrzeni i klucz obcy odrzuciłby cały zapis; rodowód jest ozdobą przywróconego rekordu, utrata całej przestrzeni byłaby ceną nieproporcjonalną). → **U-2, AC-7**
      *Gotowe, gdy:* test: roślina z wpisami i datą siewu wraca kompletna, a rok w historii miejsca
      się nie zmienia.
- [x] **T-58** — **Listy uwzględniają nadania.** `getSpaces`, `getPlants`, `getCareAgenda`,
      `getCareHistory`, `getHarvests` unionują `idZasobowNadanychMi` (wzorzec Notatek). → **U-3, AC-28**
      *Gotowe, gdy:* **tabela prawdy dostaje czwartą osobę — z nadaniem `editor`** — i pokazuje,
      że widzi ona przestrzeń na liście ORAZ jej rośliny.
- [x] **T-59** — **Zero w wymaganiach wodnych znaczy „nie planuj podlewania w tej porze".** Jedna
      semantyka w trzech miejscach: seed, reguła, test. → **U-4, AC-8**
      *Gotowe, gdy:* gatunek z `winter: 0` nie dostaje w styczniu zadania „podlej za 14 dni",
      a test sprawdza REGUŁĘ z migracji, nie powtarza implementacji.
- [x] **T-60** — **Eksport ewidencji za wybrany okres**, z nazwą pliku z faktycznego zakresu. → **U-5, AC-25**
- [x] **T-61** — **Formularz zabiegu: data, uprawa i miejsce**; `brakiEwidencji` zgłasza brak
      uprawy/miejsca. → **U-6, AC-24**
- [x] **T-62** — **Zawężenie kluczy obcych podanych przez klienta.** `placeId` musi należeć do
      `spaceId`; `speciesId`/`parentId`/`plantId` do zakresu wołającego; `diagnosePlant` zawęża
      zapytanie o zdarzenia. → **U-7 (security)**
      *Gotowe, gdy:* test rozszerza `asystentBezObejscia` o próbę wstrzyknięcia cudzego `parentId`
      i cudzego `plantId`.
- [x] **T-63** — **Lista zbiorów z akcjami.** `getHarvests` wyrenderowane; „do spiżarni" i „zapisz
      koszt" przypięte do pozycji listy, nie do stanu sesji. → **U-8, AC-15**
- [x] **T-64** — **Usunięcie przestrzeni dostępne z interfejsu** + edycja i usunięcie miejsca,
      wyłączenie zadania opieki, edytor fazy rozwojowej (konsument `listaFaz`). → **U-9, AC-7**
- [x] **T-65** — **Przyczyna śmierci bez `window.prompt`** — pole w widoku. → **U-10, C-34, C-32**
- [x] **T-66** `[P]` — **Kubełek agendy w strefie użytkownika** (`userTime`), nie serwera. → **U-11**
- [x] **T-67** `[P]` — **`harvestToPantry` idempotentne wobec wyścigu.** → **U-12**
- [x] **T-68** — **Korekta `verify.md`** (C-54): dwa twierdzenia obalone przez recenzję — „C-35
      naprawiona" i dowód AC-28/AC-7. Ponowny przebieg bramek i testów.

---

## Faza 8 — po drugiej recenzji (F-1…F-12)

- [x] **T-69** — **Formularz zabiegu widoczny przy pustym rejestrze.** Stan `empty` nie może zjadać
      `children`, bo tam mieszka jedyne wejście do `recordTreatment`. → **F-1, AC-24, AC-25**
      *Gotowe, gdy:* konto bez ani jednego zabiegu klika „Nowy zabieg" i widzi formularz.
- [x] **T-70** — **Migawka przestrzeni obejmuje dziennik, pomiary i zdarzenia zdrowotne roślin.**
      `plants: true` → `plants: { include: … }`. → **F-2, AC-7**
      *Gotowe, gdy:* test integracyjny kasuje PRZESTRZEŃ z rośliną mającą wpis dziennika i pomiar,
      przywraca ją i odnajduje oba.
- [x] **T-71** — **`propagatePlant` zawęża `placeId`** przez `sprawdzWskazania`. → **F-3 (security)**
      *Gotowe, gdy:* test wstrzyknięcia obejmuje też tę drogę.
- [x] **T-72** — **Własność rośliny wynika z PRZESTRZENI, nie z parametru `teamId`.** → **F-5**
      *Gotowe, gdy:* roślina dodana do przestrzeni zespołowej ma `workspaceId` tej przestrzeni,
      co sprawdza test.
- [x] **T-73** — **Rozdzielić „zero w tej porze" od „brak cyklu w ogóle".** Pierwsze ma prawdziwą
      datę i dostaje zadanie; drugie zadania nie dostaje, więc użytkownik potrzebuje wejścia do
      `createCareTask`. → **F-4, AC-8**
      *Gotowe, gdy:* pomidor dodany w styczniu MA zadanie podlewania z terminem na 1 marca,
      pszenica go nie ma, a w szczególe rośliny da się dodać zadanie opieki ręcznie.
- [x] **T-74** — **Nazwa pliku ewidencji liczona w strefie użytkownika**, nie procesu. → **F-6, AC-25**
      *Gotowe, gdy:* „Cały rok 2026" daje `ewidencja-zabiegow-2026.csv` także przy serwerze w UTC.
- [x] **T-75** — **Selektor fazy honoruje tryb przestrzeni** (dziś argument `true` czyni warunek
      stałą). → **F-7, AC-2**
- [x] **T-76** — **Tabela prawdy dostaje czwarty podmiot: osobę z nadaniem** — widzi przestrzeń na
      liście ORAZ jej rośliny. Warunek ukończenia T-58, niedowieziony. → **F-8, AC-28, C-54**
- [x] **T-77** `[P]` — **`updatePlant` podaje `spaceId` do `sprawdzWskazania`.** → **F-10 (security)**
- [x] **T-78** — **Kalendarz i powiadomienia w tym samym zakresie co agenda** (przestrzenie nadane),
      albo jawna decyzja przeciwna. Poprawić też opis kontraktu. → **F-11**
- [x] **T-79** `[P]` — **Resztki po zamianach:** lista ewidencji przeładowywana po zapisie zamiast
      doklejania w ślepo (F-9), martwy klucz `okresZastosuj`, potrójne `dzienPrzymrozku`,
      `revalidatePath` w przegranej gałęzi wyścigu, odświeżenie po zapisaniu przyczyny śmierci,
      korekta warunku T-57 o `parentId`. → **F-9, F-12, C-53, C-54**
- [x] **T-80** — **Ponowny przebieg bramek, builda i testów; aktualizacja `verify.md`** o drugą
      rundę recenzji.


## Faza 9 — po trzeciej recenzji (R-1…R-8)

- [x] **T-81** — **Przełącznik „zaawansowane" w szczególe rośliny**, tak jak w widoku przestrzeni;
      `poleWidoczne` dostaje jego stan, a nie stałą. → **R-2, AC-3**
      *Gotowe, gdy:* w trybie `home` fazy nie widać domyślnie, ale da się ją odsłonić i zmienić.
- [x] **T-82** — **Jedna reguła strefy w całej ewidencji**: nazwa pliku, kolumna „Data zabiegu"
      i lista liczą dzień tak samo, w strefie użytkownika. → **R-4, R-8, AC-25**
      *Gotowe, gdy:* zabieg odhaczony o 00:30 czasu polskiego ma w CSV datę tego dnia, a nie
      poprzedniego, i mieści się w okresie, który głosi nazwa pliku.
- [x] **T-83** — **`createCareTask` czyta `pomijac`** — gatunek bez cyklu nie dostaje wymyślonej daty;
      sekcja „Zadania opieki" **wypisuje zadania rośliny** z możliwością wyłączenia. → **R-3**
      *Gotowe, gdy:* „Podlewanie" dodane pszenicy nie ma terminu, a widać je tam, gdzie powstało.
- [x] **T-84** `[P]` — **Tekst pola odstępu mówi prawdę o domyślnej wartości** (moduł nie zna zabiegu
      jednorazowego). → **R-1**
- [x] **T-85** `[P]` — **Nazwa pory w bierniku** w uzasadnieniu terminu. → **R-6, C-32**
- [x] **T-86** — **`getCareAgenda` przyjmuje `od`**, powiadomienia proszą o samo okno zamiast
      o wszystko od początku świata. → **R-7**
- [x] **T-87** `[P]` — **Nagłówek `zalozHarmonogramPodlewania` opisuje AKTUALNĄ semantykę** `pomijac`
      i aktualną ścieżkę zakładania zadania. → **R-5, C-54**
- [x] **T-88** — **Bramki, build, testy; aktualizacja `verify.md`** o trzecią rundę recenzji.

## Faza 10 — po czwartej recenzji (APPROVE Z UWAGAMI)

- [x] **T-89** — **Jedna funkcja decyduje, co trafia do `nextDueAt`** (`terminDoZapisu` w domenie,
      z testem). Trzeci pisarz tego pola — `recordCare` — jako jedyny nie dostał warunku `pomijac`
      i przywracał techniczną datę usuniętą w T-83. → **Z-1**
- [x] **T-90** — **Komunikat po dodaniu zadania mówi o TYM zadaniu**, a nie obiecuje agendy zadaniu
      bez terminu. → **Z-2**
- [x] **T-91** `[P]` — Domknięcia: komentarz przy polu odstępu, prywatny `dzien` + formater `Intl`
      budowany raz na eksport, dzień listy zadań w strefie przeglądarki. → **Z-3, Z-4, Z-5**

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania | AC | Zadania |
|---|---|---|---|
| AC-1 | T-11, T-23 | AC-16 | T-16, T-27 |
| AC-2 | T-7, T-24, **T-75, T-81** | AC-17 | T-16, T-27, **T-52** |
| AC-3 | T-7, T-24 | AC-18 | T-33, **T-53** |
| AC-4 | T-12 | AC-19 | T-33, **T-53** |
| AC-5 | T-12, T-25 | AC-20 | T-34, **T-54** |
| AC-6 | T-12, T-25 | AC-21 | T-34 |
| AC-7 | T-13, **T-56, T-57, T-64, T-70** | AC-22 | T-35 |
| AC-8 | T-5, T-14, T-48, **T-59, T-73** | AC-23 | T-36, T-37, T-43 |
| AC-9 | T-5, T-14, T-26 | AC-24 | T-18, T-28, T-54, **T-56, T-61, T-69** |
| AC-10 | T-5, T-14, T-26 | AC-25 | T-18, T-28, **T-60, T-69, T-74, T-82** |
| AC-11 | T-5, T-14, **T-49** | AC-26 | T-6, **T-54** |
| AC-12 | T-38, T-39 | AC-27 | T-21 |
| AC-13 | T-15, T-25, **T-50** | AC-28 | T-10, T-29, T-42, **T-58, T-76** |
| AC-14 | T-15, T-25 | AC-29 | T-40 |
| AC-15 | T-17, T-51, **T-63** | AC-30 | T-44 |

**Żaden AC nie został bez pokrycia.**

## Ścieżka krytyczna

```
T-1 → T-2 → T-3 → T-4        (fundament danych; T-4 tylko po T-3)
   ↘ T-5..T-8 [P]            (domena — niezależna od bazy, może iść równolegle z T-2..T-4)
T-3 → T-10 → T-11 → T-12 → T-13
                  ↘ T-14 (potrzebuje T-5) → T-26
                  ↘ T-15, T-16 [P]
                  ↘ T-17 (kontrakty obcych modułów), T-18
T-12 → T-19 → T-20 → T-21 → T-23..T-31   (UI po deklaracji modułu)
T-19 → T-32 → T-33, T-34 → T-35 → T-36 → T-37
T-20 → T-38, T-39, T-40, T-41 [P]
wszystko → T-42, T-43 → T-44 → T-45..T-47
```

**Co blokuje co:**
- **T-3 blokuje całą Fazę 2** — bez klienta Prismy nie ma akcji.
- **T-5 blokuje T-14 i T-26** — agenda bez reguły terminu nie ma czego pokazać.
- **T-20 blokuje całe UI** — trasa bez deklaracji modułu nie przejdzie bramki rejestru.
- **T-19 (kontrakt) blokuje T-38/T-40** — wkłady czytają moduł przez kontrakt.
- **T-44 jest bramą do `/verify`** — dopóki nie jest zielone, weryfikacja nie ma czego sprawdzać.

## Notatki / blokady
- Brak zadań spoza planu (**C-53**). Jedyna zmiana wobec szablonu: akcje mieszkają w
  `src/modules/rosliny/actions/`, nie w `src/actions/` — to obowiązująca konwencja po 046 (**C-36**),
  a szablon opisuje stan sprzed przebudowy.
- `src/actions/notifications.ts` i `src/actions/trash.ts` są **istniejącymi agregatami warstwy
  aplikacji** (czytają tabele wielu modułów) — dopisanie się do nich w T-13 i T-39 nie jest
  „równoległą listą modułów" z C-36, która dotyczy rejestracji modułu.
