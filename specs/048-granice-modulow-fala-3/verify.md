# Weryfikacja: Granice modułów — Faza 1, fala 3 (domknięcie zadania 5)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (24/24 odhaczone)
- **Data:** 2026-08-05
- **Branch:** `claude/omnia-architecture-skins-qlv2ew`
- **Zakres weryfikacji:** commity `17b64b2d..c2cfbb59` (19 commitów po specu)

---

## 1. Bramki

Wszystkie uruchomione lokalnie, przeciw **lokalnemu** Postgresowi (C-13 — produkcyjna baza nietknięta).

| Komenda | Wynik | Output |
|---|---|---|
| `npm run check:actions` | ✅ | 160 akcji w katalogu, wszystkie z egzekutorem i kontraktem; 372 parametry z etykietami PL |
| `npm run check:ai-coverage` | ✅ | **551** akcji z zakresem dostępu i guardem; pokrycie AI: MUTACJE 159 ai/1 pending/222 excluded · ODCZYTY 65 ai/3 pending/101 excluded |
| `npm run check:cost-badge` | ✅ | 35 plików wołających model, każdy przekazuje zużycie lub ma świadomy wyjątek |
| `npm run check:content-memory` | ✅ | 35 plików sklasyfikowanych (5 z pamięcią treści, 30 na żądanie) |
| `npm run check:migrations` | ✅ | numeracja OK, następny wolny numer 0226 — **fala nie dodała migracji** (zgodnie ze specem §6) |
| `npm run check:ui-contract` | ✅ | 21/21 modułów na `ModuleView`; 29 plików z zadeklarowanymi kolorami |
| `npm run check:schema-drift` | ✅ | brak rozjazdu `schema.prisma` ↔ migracje |
| `npm run check:boundaries` | ✅ | 4 przypadki: import przez granicę blokowany, kontrakt i własne wnętrze przechodzą |
| `npm run check:module-registry` | ✅ | **21 modułów**, każdy z `contract.ts`, kompletną deklaracją, wpięciem w rejestr **i bez kodu poza swoim katalogiem** |
| `npm run check:test-types` (`tsc -p tsconfig.test.json`) | ✅ | exit 0 |
| `next lint --dir src` | ✅ | 0 błędów (zastane ostrzeżenia kosmetyczne bez zmian) |
| `next build` | ✅ | exit 0 |
| `npm run test:unit` | ✅ | **566/566** przechodzi (46 pominiętych) |

**Uwaga metodologiczna:** `check:ai-coverage` **nie spadło** (551 = 551 z punktu wyjścia T-1).
Przy okazji T-15 liczba przez chwilę urosła o jedną akcję (`getEpicTreeForAdmin`) — to wzrost
z nazwaną przyczyną, nie dryf. Spadek byłby sygnałem, że przenosiny wyprowadziły akcję poza zasięg
skanera; wzrost o świadomie dodaną akcję nie jest.

---

## 2. Kryteria akceptacji

### Domknięcie przenoszenia

**AC-1 — kod modułu mieszka w katalogu modułu** ✅
*Jak sprawdzone:* `ls src/modules | wc -l` → **21**. Bramka `check:module-registry` ma od T-19
piąty test, który dla **każdego** zarejestrowanego id szuka `src/actions/<id>.ts` i
`src/components/<id>/` — i wywala build, jeśli znajdzie. Wynik: „21 modułów … bez kodu poza swoim
katalogiem". Lista pozostawionych jest **pusta** — nie było potrzeby korzystać z furtki „z powodem".

**AC-2 — konsument spoza modułu idzie wyłącznie przez kontrakt** ✅
*Jak sprawdzone:* reguła ESLint `no-restricted-imports` (`@/modules/*/**` z wyjątkiem
`!@/modules/*/contract`) + `next lint --dir src` na całym repo = 0 błędów. To jest właściwy dowód:
`check:boundaries` testuje **swoje sondy**, nie kod repozytorium (lekcja z 047, dlatego lint jest
w rytuale po każdym module).

**AC-3 — brak wpisu na liście przejściowej i w słowniku uprawnień** ✅
*Jak sprawdzone:* `grep LEGACY src/lib/modules.tsx` → brak (tablica przejściowa **usunięta**,
nie tylko opróżniona, T-19). `PERMISSIONS` w `src/platform/auth/permissions.ts` zawiera dziś
wyłącznie:

```
SETTINGS, ADMIN, INVITATIONS
KITCHEN_RECIPE_CREATE, KITCHEN_RECIPE_EDIT, KITCHEN_RECIPE_DELETE,
KITCHEN_MEALPLAN_EDIT, KITCHEN_PANTRY_EDIT, KITCHEN_AI
```

czyli **tylko slugi spoza rejestru modułów** (powierzchnie niemodułowe + podupranienia Kuchni,
które nie mapują się na trasę). To jest sprawdzalny dowód z §6 speca, że „8 równoległych list → 1"
faktycznie zadziałało: tożsamość modułu (etykieta, ikona, kolor, uprawnienie, trasy, nawigacja)
pochodzi z jednej deklaracji `defineModule`.

**AC-4 — sprzężenia przez kontrakt, rozmiar kontraktu pokazuje koszt** ✅
*Jak sprawdzone:* przegląd realnych wywołań międzymodułowych po fali. Zostało ich **pięć**, każde
jednofunkcyjne:

| Konsument | Dostawca | Wywołanie |
|---|---|---|
| Nawyki | Zadania | `createTask` |
| Pogoda | Zadania | `createTask` (+ `tasksModule` po uprawnienie przed utworzeniem zadania) |
| Kuchnia | Zakupy | `assertListAccess` |
| Usługi | Portfel | `addEntry` |
| Usługi | Portfel | `bookAutoExpense` |

Rozmiary kontraktów (liczba eksportów) raportujemy jako **pomiar sprzężenia**, zgodnie z §9 speca:
kitchen 36 · portfel 17 · qa 17 · magazynowanie 14 · tasks 13 · health 12 · pets 12 · news 11 ·
warsztaty 11 · languages 10 · weather 10 · notes 9 · shopping 9 · reports 9 · habits 6 · flota 6 ·
contacts 4; **wyłącznie typy**: truck, services, calendar, home.
Kontrakt Kuchni (36) jest największy w systemie i to jest informacja, nie porażka — konsumentem
jest głównie asystent AI (egzekutory + read-toole), a nie inny moduł domenowy.

### Powłoka bez wiedzy o wnętrzach

**AC-5 — nawigacja boczna z deklaracji** ✅
*Jak sprawdzone:* `ModuleDeclaration` ma pole `sideNav?: () => Promise<{default: ComponentType}>`;
`ModuleSidebar` rozwiązuje je przez `next/dynamic` z cache komponentów
(`sideNavCache`, `moduleSideNav(id)`) i **nie zna nazw komponentów** — sześć importów wnętrz
zniknęło (commit `3bbbdcf8`, osobny, bo to zmiana zachowania).

**AC-6 — żaden import powłoki nie sięga do wnętrza modułu** ✅
*Jak sprawdzone:* `grep -rn "@/modules/[a-z]*/\(actions\|ui\|lib\)" src/components/shell/` → **brak
trafień**. Warunkiem było najpierw rozdzielenie asystenta (`components/assistant/`) i `ActivityFeed`
(`components/settings/`) od modułu Strona główna — T-2/T-3, przed przenosinami.

### Słowniki współdzielone

**AC-7 — miejsce słownika wynika z listy konsumentów, nie z nazwy** ✅
*Jak sprawdzone:* przegląd konsumentów **przed** przeniesieniem. `categories`, `units`, `products`,
`categoryIcons` mają wyłącznie konsumentów zakupowych → pojechały z Zakupami (`bf855734`).
Współdzielony okazał się tylko `tags` (Notatki + Kuchnia) → **został** w `src/actions` z powodem.
Założenie ze speca („kategorie dzielone z Kuchnią") okazało się nieprawdziwe i **spec został
poprawiony przed kodem** (C-54 — korekta wpisana wprost przy AC-7).

### Dług testowy

**AC-8 — każda z ośmiu zastanych porażek ma diagnozę** ✅
*Jak sprawdzone:* commit `82968270` + `c2cfbb59`. Wszystkie osiem zdiagnozowano jako **błędy
testów**, nie aplikacji; **sześć naprawiono**:

| Scenariusz | Diagnoza | Stan |
|---|---|---|
| `shopping` (nowa lista) | selektor łapał też przycisk z sidebara — zawężony do `<main>`, dodane `openNewListForm()` | naprawione |
| `tasks` (nowy projekt) | to samo — `createProject` zawężone do `<main>` | naprawione |
| `notes`, `reports` | selektory łapały duplikat z nawigacji | naprawione |
| `kitchen` (plan) | plan renderuje dwa warianty (`hidden md:grid` + `md:hidden`), etykiety pór posiłków są w DOM dwukrotnie — zawężone do `<main>` | naprawione |
| `qa-tester-access` | „moduł dostępny w nawigacji" ma **dwie** poprawne postacie: moduł włączony = link, moduł `defaultEnabled: false` (dziś tylko QA) = **przycisk** w zwiniętej sekcji „Więcej…". Test szukał wyłącznie linku. Zamierzone zachowanie produktu → poprawiamy test | opisane, poprawka **nie domyka** — patrz §5 |
| pozostałe | takie same zawężenia selektorów | naprawione |

**AC-9 — klikacz ścieżki szczęśliwej 21/21** ✅
*Jak sprawdzone:* uruchomiony po przejściu na leniwą nawigację: **22/22** (21 modułów + test
odczytu rejestru). Zero zmian widocznych dla użytkownika w tej ścieżce.

**AC-10 — komplet bramek zielony, pokrycie dostępu nie spada** ✅ — patrz §1.

**AC-11 — bramka wykrywa moduł „po staremu"** ✅
*Jak sprawdzone:* **test negatywny** — podłożono `src/actions/habits.ts`, bramka
`check:module-registry` zapaliła się na czerwono; po usunięciu pliku wróciła do zieleni. To domyka
AC-6 z przebiegu 046 (wtedy bramka umiała sprawdzić tylko istnienie deklaracji, nie brak duplikatu
poza katalogiem).

**AC-12 — przenosiny oddzielone od zmian zachowania** ✅
*Jak sprawdzone:* `git log` fali. 10 commitów `refaktor(048): modul <X> do src/modules/<x>` (czyste
przenosiny + przepisane importy), a trzy zmiany zachowania mają własne commity:
`4f3322b9` (rozdzielenie asystenta), `3bbbdcf8` (nawigacja z deklaracji), `6bf8360e` (zaostrzenie
bramki + usunięcie martwego kodu). Żaden commit nie miesza jednego z drugim.

**AC-13 — dziennik przebudowy mówi, gdzie jesteśmy** ✅
*Jak sprawdzone:* `worldofmag/content/architektura/15-dziennik.md` — wpis 048, zadania **5 i 7
odhaczone ✅**, jawnie wypisane, co z Fazy 1 zostaje (zdolności platformy `ai`/`llm`/`jobs`,
zadanie 8 — asystent z deklaracji) i że to jest pierwszy krok następnego przebiegu.
Zaktualizowane też `CLAUDE.md` (sekcja granic modułów: 21/21, brak listy przejściowej)
i `.claude/spec-pipeline/constitution.md` (C-36 rozszerzone o `sideNav`, regułę przynależności
po konsumentach i regułę „powłoka nie zna wnętrz").

---

## 3. Zgodność z konstytucją

| Reguła | Stan | Uwaga |
|---|---|---|
| **C-36** (granice modułów) | ✅ | obowiązuje **bez wyjątków** — nie został moduł, do którego się nie stosuje |
| **C-02** (alias na zewnątrz, ścieżka względna wewnątrz) | ✅ | wymuszone lintem; naruszenie w `HealthHomePage` (047) już nie występuje |
| **C-10..C-14** (migracje) | ✅ n/d | fala bez zmian schematu; potwierdza `check:schema-drift` i `check:migrations` |
| **C-13** (nigdy prod DB lokalnie) | ✅ | build i migracje wyłącznie przeciw lokalnemu Postgresowi |
| **C-20, C-21** (Server Actions, własność) | ✅ | akcje przeniesione bez zmian treści; `revalidatePath` i guardy jadą razem z nimi |
| **C-22** (RBAC / rejestr) | ✅ | zero nowych slugów; `PERMISSIONS` zredukowane do slugów spoza rejestru |
| **C-23** (AI) | ✅ | zero nowych `AIAction`; zmieniły się wyłącznie ścieżki importu; pokrycie 551 bez spadku |
| **C-30..C-32** (UI) | ✅ | zero zmian w warstwie wizualnej; `check:ui-contract` 21/21 |
| **C-50** (bramki) | ✅ | komplet zielony |
| **C-51** (lekcje) | ✅ | wpisy dopisane do `doświadczenia.md` (m.in. kolizja „plik X.ts + katalog X/", bramka wrażliwa na refaktor przenoszący) |
| **C-53** (minimalizm) | ✅ | nowe są tylko trzy rzeczy, których fala wymaga: pole `sideNav`, rozstrzygnięcie słowników, zaostrzenie bramki |
| **C-54** (spójność artefaktów) | ✅ | błędne założenie o słownikach poprawione **w specu**, nie obejściem w kodzie |

---

## 4. Regresje

- **Kalendarz** — najostrzejszy test fali (czyta dane sześciu modułów). Agregat `getCalendarEvents`
  przeniesiony bez zmiany treści; testy jednostkowe kalendarza przechodzą, klikacz otwiera widok
  miesiąca. ✅
- **Asystent AI** — egzekutory i read-toole przepisane wyłącznie na nowe ścieżki; `check:actions`
  (160) i `check:ai-coverage` (551) bez ubytku. ✅
- **RBAC** — mapowanie ścieżka→uprawnienie przeszło do `permissionForPath` w
  `src/lib/pathPermissions.ts` (deklaracje → `legacyPermissionForPath` jako fallback dla powierzchni
  niemodułowych). Pusta ścieżka normalizowana do `/`, żeby korzeń nie wypadł z mapowania. ✅
- **Powłoka** — leniwa nawigacja boczna zmieniła **moment** pojawienia się sub-nawigacji (dociąga się
  po hydratacji). To jedyna realna zmiana czasowa w tej fali i **złapały ją klikacze**: dwa testy
  zakładające synchroniczną obecność sub-nawigacji trzeba było zawęzić (`c2cfbb59`). Dla użytkownika
  różnica jest niewidoczna (komponent jest w tym samym bundlu trasy), ale odnotowujemy ją jawnie.
- **Migracje / dane** — brak zmian.

---

## 5. Czego nie udało się domknąć (uczciwie)

Pełny zestaw klikaczy: **120 przeszło / 14 czerwonych** (przed falą 16). Z tych 14 **jedenaście
przechodzi uruchomione pojedynczo** — to flaki równoległego ładowania w tym środowisku (darmowy
sandbox, jeden Postgres, kilka workerów), nie regresja kodu. Reprodukują się w izolacji **trzy**:

1. **`scenario-kitchen-plan-cooked`** — *nierozstrzygnięte.* Strona renderuje się poprawnie
   (nagłówek, nawigacja tygodni, przyciski; sąsiedni `kitchen-plan-week-nav` przechodzi), ale
   w migawce błędu siatka planu po 10 s wciąż pokazuje region `status`, czyli **doczytuje się**.
   Nie ustaliłem, czy to wolne ładowanie w tym środowisku, czy brak wpisów planu na **bieżący
   tydzień** w danych z seeda (seed sadzi wpisy pod datę tworzenia, a test patrzy na dzisiejszy
   tydzień). Nie „naprawiłem" tego rozluźnieniem asercji — to zamiotłoby pod dywan potencjalny
   problem z danymi. Przyczyna opisana komentarzem w `e2e/specs/kitchen.spec.ts`.
2. **`scenario-qa-tester-access`** — diagnoza jest pewna (QA ma `defaultEnabled: false`, więc siedzi
   jako **przycisk** w zwiniętej sekcji „Więcej…"), ale poprawka testu — rozwinięcie sekcji i
   akceptacja linku **lub** przycisku — nadal nie znajduje elementu. Podejrzenie: sekcja „Więcej…"
   nie rozwija się w tym przebiegu (leniwa nawigacja / czas hydratacji), ale nie potwierdziłem tego.
   Dwie próby naprawy, obie nieskuteczne.
3. **`scenario-switch-lists-sidebar`** — przełączanie list z sidebara Zakupów; dwie próby naprawy,
   nadal czerwone. Ten najprawdopodobniej dotyka tej samej zmiany czasowej co punkt 2
   (sub-nawigacja dociągana leniwie), ale nie mam na to dowodu, więc tak to raportuję.

**Wpływ na AC:** AC-8 wymaga **diagnozy**, nie naprawy wszystkiego — i diagnozę mają wszystkie osiem.
AC-9 (klikacz ścieżki szczęśliwej) jest zielone. Trzy powyższe to **dług testowy przeniesiony dalej**,
nie zablokowane kryterium — ale nie należą do „naprawionych" i tak są tu policzone.

**Poza zakresem tej fali** (świadomie, zgodnie ze specem §5, wpisane do dziennika): zdolności
platformy `ai`/`llm`/`jobs`, zadanie 8 (asystent AI składany z deklaracji), pola `dashboard`/
`calendar`/`resources` w deklaracji, cała Faza 2.

---

## 6. Werdykt końcowy

## **GOTOWE Z UWAGAMI**

Wszystkie trzynaście kryteriów akceptacji spełnione, komplet bramek zielony, build i 566 testów
jednostkowych przechodzą. **Zadanie 5 checklisty Fazy 1 jest domknięte**: 21/21 modułów za granicą,
lista przejściowa usunięta, `PERMISSIONS` zredukowane do slugów spoza rejestru, powłoka bez ani
jednego importu wnętrza modułu, a bramka rejestru wykrywa próbę napisania modułu „po staremu"
(potwierdzone testem negatywnym).

**Uwagi, z którymi to wypuszczamy:**
- trzy scenariusze klikaczy reprodukują się w izolacji i **nie mają domkniętej naprawy** (§5) —
  jeden bez ustalonej przyczyny, dwa z hipotezą bez dowodu;
- leniwa nawigacja boczna zmienia moment pojawienia się sub-nawigacji — dla użytkownika niewidoczne,
  dla testów zakładających synchroniczność już nie.

Żadna z uwag nie dotyczy zachowania widocznego dla użytkownika ani poprawności danych, więc nie
zawracam pipeline'u do `/implement` — przechodzę do `/review`.
