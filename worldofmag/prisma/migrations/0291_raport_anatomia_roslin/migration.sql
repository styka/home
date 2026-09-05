-- 113 — RAPORT: ANATOMIA MODUŁU ROŚLINY.
--
-- Mapa modułu dla administratora: drzewo bytów, dwa przepływy, których nie da się oddać zdaniem
-- (skąd bierze się termin podlewania i którędy dane opuszczają moduł), drzewo funkcjonalności
-- trasa po trasie oraz reguły domenowe razem z powodem, dla którego są takie a nie inne.
-- Stoi w aplikacji, a nie tylko w rozmowie, bo pytanie „co ten moduł właściwie robi i gdzie tego
-- szukać w kodzie" wraca przy każdym powrocie do niego po przerwie.
--
-- Liczby w raporcie policzone z kodu na `master` (nie z pamięci): 6 tras, 10 tabel,
-- 51 Server Actions, 182 wpisy katalogu gatunków, 4 tryby przestrzeni, 4 użycia modelu.
--
-- Migracja NIE zmienia kształtu bazy: jeden `INSERT` z `ON CONFLICT DO NOTHING` (C-14).
-- Treść nie zawiera żadnego sekretu ani adresu bazy (C-41).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "storage", "authorId", "teamId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Moduł Rośliny — anatomia: byty, przepływy i reguły',
  'modul-rosliny-anatomia',
  $rosliny_mapa$# Moduł Rośliny — anatomia

Ten sam byt w czterech skalach: od doniczki na parapecie po 4,2 ha pola. Poniżej drzewo bytów,
przepływy, których nie da się oddać zdaniem, i reguły, które o czymś rozstrzygają.

| Liczba | Co |
|---:|---|
| 6 | tras |
| 10 | tabel |
| 51 | Server Actions |
| 182 | gatunki w katalogu systemowym |
| 4 | tryby przestrzeni |
| 4 | użycia modelu |

---

## 1. Drzewo bytów

Hierarchia zawierania. Kluczowa decyzja: **jeden wiersz `Plant`** opisuje okaz, partię stu sztuk
i hektar uprawy — rozbicie tego na trzy tabele rozdzieliłoby ewidencję zabiegów, agendę opieki
i oś czasu rośliny na trzy niezależne źródła.

- **Przestrzeń roślinna** — `PlantSpace`
  Użytkownik ma ich dowolnie wiele. **Tryb siedzi na przestrzeni, nie na koncie** — kwiaciarnia
  i prywatny parapet istnieją w jednym koncie naraz.
  - **Miejsce** — `PlantPlace` *(parapet → grządka → sektor → pole)*
    Niesie nasłonecznienie, glebę i powierzchnię. To z niego liczy się historia uprawy
    i ostrzeżenie płodozmianowe.
    - **Roślina** — `Plant` *(1 szt. · 100 szt. · 4,2 ha)*
      Stan życia z **wymaganą przyczyną śmierci**, faza BBCH, rodzic (rozmnażanie).
      - **Zadanie opieki** — `PlantCareTask` — termin *razem z uzasadnieniem*
      - **Zdarzenie** — `PlantCareEvent` — podlanie, zabieg ŚOR i zbiór w **jednej** tabeli
      - **Wpis dziennika** — `PlantJournalEntry` — notatka ze zdjęciem
      - **Pomiar** — `PlantMeasurement` — rodzaj + jednostka; `source` to szew pod czujniki etapu 2
      - **Zdarzenie zdrowotne** — `PlantHealthEvent` — diagnoza z pewnością i **skutkiem**
        (pomogło / bez zmian / gorzej)

Katalog gatunków stoi obok, na dwóch tabelach (wzorcem Wiadomości):

- `PlantSpeciesCatalog` — systemowy, bez właściciela i bez przestrzeni, zaseedowany migracją 0273
  (182 wpisy)
- `PlantSpecies` — **kopia** w przestrzeni użytkownika. Zmiana „mojej" monstery nie rusza wiersza
  systemowego; `origin` odpowiada na pytanie „skąd to wiem" (`system` / `user` / `ai`)

---

## 2. Skąd bierze się termin podlewania

To jest rdzeń modułu. **Odstęp podlewania nigdy nie jest stałą gatunku** — wynika z czterech wejść
naraz, a wynik wraca z jednozdaniowym uzasadnieniem, bo aplikacja, która tłumaczy, uczy.

```
                      ┌───────────────────────────┐
Gatunek ───────────→  │                           │
  4 liczby: odstęp    │   domain/harmonogram      │
  na porę roku        │                           │
                      │   czysta reguła:          │
Miejsce ───────────→  │   bez bazy, bez sesji,    │
  nasłonecznienie     │   w całości testowalna    │
  ×0,8 / 1 / 1,25     │                           │
                      │   opad        ≥ 5 mm      │
Pora roku ─────────→  │   upał        ≥ 27 °C     │
  liczona z daty      │   przymrozek  ≤ 2 °C      │
                      │                           │
Prognoza ──────────→  │                           │
  kontrakt Pogody     │                           │
                      └─────────────┬─────────────┘
                                    │ terminDoZapisu
                                    ▼
                      ┌───────────────────────────┐
                      │  Zadanie opieki           │
                      │    nextDueAt              │
                      │    reason — „dlaczego wtedy│
                      └─────────────┬─────────────┘
                                    ▼
                      Agenda / Kalendarz / Powiadomienia
                                    │
              ┌─────────────────────┘
              │  recordCare: zrobione / pominięte / odłożone
              └─→ liczy następny termin od FAKTYCZNEGO wykonania
```

**Kolejność korekt jest celowa: najpierw gatunek i pora roku, potem miejsce, na końcu pogoda.**
Odwrotna dałaby ten sam wynik liczbowo, ale uzasadnienie mówiłoby o pogodzie także wtedy, gdy
zadecydowała pora roku — a zdanie podające nieprawdziwy powód jest gorsze niż brak zdania.

Trzy wyniki odhaczenia znaczą trzy różne rzeczy:

| Wynik | Co robi z cyklem | Co robi z historią |
|---|---|---|
| zrobione | przesuwa cykl | zapisuje `lastDoneAt` |
| pominięte | przesuwa cykl | **nie** zapisuje wykonania — roślina nie była podlana |
| odłożone | zostawia cykl w spokoju | przesuwa sam termin o kilka dni |

„Pomiń" i „Odłóż" istnieją dlatego, że harmonogram, którego nie da się odłożyć, po tygodniu składa
się z samych zaległości i przestaje być czytany.

**Gatunek bez cyklu podlewania w żadnej porze** (zboża, uprawy polowe — 20 ze 182 wpisów katalogu)
nie dostaje wymyślonej daty, tylko zadanie bez terminu. Zero w **jednej** porze to co innego:
pomidor dodany w styczniu ma prawdziwą datę wznowienia (1 marca) i po prostu czeka.

---

## 3. Wyjścia z modułu

Moduł **nie buduje u siebie ani drugiego magazynu, ani drugiej księgowości**. Wszystko, co opuszcza
Rośliny, idzie przez kontrakt innego modułu — tą samą drogą, którą Flota księguje paliwo.

```
   Pogoda ──prognoza──→ ┌───────────┐ ──zbiór─────────→ Kuchnia (spiżarnia)
                        │           │ ──koszt─────────→ Portfel
                        │  ROŚLINY  │ ──nasiona───────→ Zakupy
                        │           │ ──pozycja planu─→ Zadania
                        └───────────┘ ──agenda────────→ Kalendarz + Powiadomienia
                              │
                              └────────CSV──────────→ Ewidencja ŚOR (plik)
```

| Kierunek | Funkcja modułu | Kontrakt obcego modułu |
|---|---|---|
| zbiór → spiżarnia | `harvestToPantry` | `addPantryItem` |
| koszt zabiegu | `bookCareCost` | `bookAutoExpense` |
| nasiona, środki | `addToShoppingList` | Zakupy |
| pozycja planu sezonu | `planToTask` | `createTask` |
| agenda opieki | `getCareAgenda` | Kalendarz + powiadomienia |
| prognoza (**wejście**) | `lib/pogoda` | kontrakt Pogody |

**Ewidencja zabiegów opuszcza aplikację wyłącznie jako plik CSV.** Jako jedyny element modułu ma
zewnętrzny, datowany przymus prawny — i świadomie nie ma integracji z systemem rządowym: obowiązek
dotyczy prowadzenia i formy, a nie kanału przesyłania.

---

## 4. Drzewo funkcjonalności — trasa po trasie

### `/rosliny` — lista przestrzeni i „co dziś"

- założenie przestrzeni z wyborem trybu
- **pilne zabiegi nad listą**, nie pod nią — do modułu wchodzi się z pytaniem „co dziś podlać"

`getSpaces` · `createSpace` · `getCareAgenda`

### `/rosliny/[spaceId]` — jedna przestrzeń

- rośliny i miejsca; dodanie, edycja, usunięcie miejsca
- ostrzeżenie płodozmianowe **w chwili wyboru**, nie po zapisie
- przypisanie lokalizacji pogodowej, udostępnienie, usunięcie przestrzeni
- plan sezonu i wnioski o przestrzeni (model)

`getSpace` · `updateSpace` · `deleteSpace` · `getPlaces` · `createPlace` · `updatePlace` ·
`deletePlace` · `getPlaceHistory` · `createPlant` · `getSeasonPlan` · `getSpaceInsights` ·
`planToTask` · `getWeatherOptions`

### `/rosliny/[spaceId]/roslina/[plantId]` — jedna roślina

- oś czasu, dziennik ze zdjęciami, pomiary
- faza rozwojowa BBCH (po odsłonięciu pól zaawansowanych)
- zadania opieki — dodanie ręczne i wyłączenie
- zbiory z akcjami przy każdej pozycji
- sadzonka z zapisem rodzica; zakończenie życia **z wymaganą przyczyną**
- rozpoznanie ze zdjęcia i diagnoza z historią (model)

`getPlant` · `updatePlant` · `setPlantStatus` · `propagatePlant` · `deletePlant` · `getJournal` ·
`addJournalEntry` · `deleteJournalEntry` · `getMeasurements` · `addMeasurement` ·
`getPlantCareTasks` · `createCareTask` · `updateCareTask` · `getCareHistory` · `getHarvests` ·
`recordHarvest` · `harvestToPantry` · `bookCareCost` · `addToShoppingList` · `identifyPlant` ·
`diagnosePlant` · `markHealthOutcome` · `scheduleRecommendedCare`

### `/rosliny/opieka` — agenda ze wszystkich przestrzeni

- zaległe / dziś / wkrótce, z dobą liczoną **w strefie użytkownika**
- cztery przyciski: zrobione, odłóż, pomiń, nie przypominaj
- każda pozycja niesie uzasadnienie terminu

`getCareAgenda` · `recordCare` · `updateCareTask`

### `/rosliny/katalog` — gatunki

- przeglądanie katalogu systemowego i dodawanie do swoich
- własny wpis oraz edycja **kopii** — wiersz systemowy zostaje nietknięty

`searchCatalog` · `getSpeciesList` · `addSpeciesFromCatalog` · `createSpecies` · `updateSpecies`

### `/rosliny/ewidencja` — rejestr zabiegów ŚOR *(tylko przestrzenie zawodowe)*

- zapis zabiegu z kompletem pól wymaganych od 1 stycznia 2026
- **braki nie blokują zapisu** — są wypisane przy wierszu
- eksport CSV za wybrany okres; nazwa pliku z faktycznego zakresu

`recordTreatment` · `getTreatmentRegister` · `exportTreatmentRegister`

---

## 5. Cztery reguły, które naprawdę o czymś rozstrzygają

Wszystkie mieszkają w `domain/` i mają testy — plik z `"use server"` nie eksportuje funkcji
synchronicznych, więc reguła w nim zamknięta byłaby niesprawdzalna.

| Reguła | Plik | Na czym polega |
|---|---|---|
| Termin zabiegu | `domain/harmonogram.ts` | Gatunek i pora roku, potem miejsce, na końcu pogoda — w tej kolejności, żeby uzasadnienie podawało prawdziwy powód |
| Ostrzeżenie płodozmianowe | `domain/plodozmian.ts` | Liczone z rodziny botanicznej gatunku, który użytkownik **właśnie wybiera** — nie z rośliny, która w miejscu już stoi. Zawsze ostrzega, nigdy nie blokuje |
| Kubełek agendy | `domain/agenda.ts` | Zaległe zaczynają się **dobę po terminie**, nie w chwili jego minięcia. Koniec doby wchodzi parametrem, ze strefy użytkownika |
| Przyczyna zakończenia | `domain/roslina.ts` | Wymagana **wyłącznie dla „padła"** — sprzedaż i zbiór mówią same za siebie, a śmierć bez powodu nie mówi nic |

Piąta reguła mieszka obok i pilnuje spójności zapisu: `terminDoZapisu` rozstrzyga, co trafia do
`nextDueAt`, w jednym miejscu dla wszystkich trzech pisarzy tego pola (założenie harmonogramu,
ręczne dodanie zadania, odnotowanie wykonania). Warunek powielony w trzech miejscach zgubił się raz
i zgubiłby się znowu.

---

## 6. Tryb przestrzeni decyduje o widoczności, nigdy o dostępie

Przełącznik „pokaż zaawansowane" odsłania w każdym trybie wszystko. Tryb, który *blokuje*,
zmuszałby do zakładania drugiej przestrzeni po to, żeby raz wpisać pH.

| Pole domyślnie widoczne | `home` | `garden` | `production` | `field` |
|---|:---:|:---:|:---:|:---:|
| Liczność (szt. / m² / ha) | — | — | tak | tak |
| Faza rozwojowa (BBCH) | — | — | tak | tak |
| Powierzchnia miejsca | — | tak | — | tak |
| Gleba | — | tak | tak | tak |
| Koszt jednostkowy | — | — | tak | tak |
| Ewidencja zabiegów | — | — | tak | tak |
| Parametry chemiczne (pH, EC) | — | — | — | tak |

Mieszkanie jest jedynym segmentem o **zerowej tolerancji na parametry** — stąd pusty wiersz
domyślny. Pole ma wszystko, bo ewidencja jest tam obowiązkiem prawnym, a nie opcją.

---

## 7. Cztery użycia modelu, każde osobnego typu

| Użycie | Typ operacji | Kiedy | Co je wyróżnia |
|---|---|---|---|
| Rozpoznanie ze zdjęcia — `identifyPlant` | `vision` | na żądanie | `unknown` jest dozwoloną odpowiedzią |
| Diagnoza problemu — `diagnosePlant` | `vision` | na żądanie | dostaje **historię tej rośliny**, nie samo zdjęcie; skutek zalecenia wraca do bazy |
| Plan sezonu — `getSeasonPlan` | `reasoning` | zapamiętany | pozycję planu da się jednym kliknięciem wysłać do Zadań |
| Wnioski o przestrzeni — `getSpaceInsights` | `reasoning` | zapamiętany | liczy przeżywalność z rzeczywistych stanów życia |

Asystent widzi moduł przez **trzy narzędzia odczytu** (`list_plant_spaces`, `list_plants`,
`plant_care_agenda`) i **cztery akcje zapisu** (`create_plant_space`, `create_plant`,
`log_plant_care`, `add_plant_measurement`) — wszystkie zawężone do przestrzeni, do których wołający
ma dostęp.

---

## 8. Czego tu świadomie nie ma

Wstępna mapa pomysłów mieszała warstwę *roślinną* z warstwą ogólnobiznesową, którą Omnia już ma.

| Odrzucone / odłożone | Powód |
|---|---|
| Sprzedaż i magazyn towaru | Mają je Magazynowanie i Usługi. Drugi magazyn byłby drugim źródłem prawdy o tym samym |
| Księgowość uprawy | Koszt idzie do Portfela przez kontrakt. Moduł nie liczy marży |
| Integracja z systemem rządowym (ŚOR) | Obowiązek dotyczy prowadzenia i formy, nie kanału przesyłania. Osobna, znacznie większa praca |
| Czujniki IoT | Etap 2 — ale szew już jest: `PlantMeasurement.source` przyjmuje `sensor`, więc wejdą jako wiersze, nie jako migracja |
| Ostrzeżenie o karencji przed zbiorem | Etap 2. `withdrawalDays` zapisujemy od pierwszego dnia, żeby etap 2 nie zaczynał się od migracji na zapełnionej tabeli |
| Genetyka i rodowody | Etap 2, ale `Plant.parentId` powstaje teraz — dokładanie relacji do zapełnionej tabeli to migracja z wypełnianiem wstecz |

---

## 9. Gdzie to żyje w kodzie

| Warstwa | Ścieżka |
|---|---|
| Reguły domenowe (z testami) | `src/modules/rosliny/domain/` |
| Server Actions | `src/modules/rosliny/actions/` |
| Widoki | `src/modules/rosliny/ui/` |
| Kontrakt dla innych modułów | `src/modules/rosliny/contract.ts` |
| Deklaracja zasobów (udostępnianie) | `src/modules/rosliny/sharing.ts` |
| Wkłady do platformy | `dashboard.ts` · `calendar.ts` · `retention.ts` |
| Migracje | `0272` (tabele) · `0273` (katalog) · `0274` (klucz katalogu) |
| Specyfikacja i przebieg prac | `specs/113-modul-roslin/` |

Moduł powstał przez spec-driven pipeline: badania → specyfikacja (30 kryteriów akceptacji) → plan →
91 zadań → implementacja → 6 przebiegów weryfikacji → 4 rundy recenzji świeżym okiem
(12 → 12 → 8 → 2 ustalenia, blokujących 4 → 3 → 2 → 0).
$rosliny_mapa$,
  'architecture',
  'db',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
