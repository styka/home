# Weryfikacja: Migawka pulpitu z deklaracji — domknięcie Fazy 1

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-11 · **Branch:** `claude/omnia-architecture-skins-qlv2ew`
- **Diff przebiegu:** 34 pliki, +1713 / −397

---

## Bramki

| Komenda | Wynik |
|---|---|
| `npm run build` (pełny potok, **lokalny** Postgres — C-13) | ✅ **exit 0**, „Compiled successfully" |
| `next lint --dir src` | ✅ 0 błędów (ostrzeżenia kosmetyczne bez zmian) |
| `tsc --noEmit` | ✅ exit 0 |
| `tsc --noEmit -p tsconfig.test.json` | ✅ exit 0 |
| `npm run test:unit` | ✅ **657 / 657** |
| `check:actions` | ✅ **160** akcji (bez spadku) |
| `check:ai-coverage` | ✅ **551** akcji (bez spadku) |
| `check:cost-badge` | ✅ **35** plików (bez spadku) |
| `check:content-memory` | ✅ **35** plików (bez spadku) |
| `check:migrations` | ✅ następny wolny numer 0226 (brak migracji w tym przebiegu) |
| `check:module-registry` | ✅ 21 modułów, **osiem kontroli** |
| `check:boundaries` | ✅ 4 przypadki |
| `check:ui-contract` | ✅ 21/21 modułów na `ModuleView` |
| `check:schema-drift` | ✅ (bez zmian schematu) |

**Obserwacja spoza zakresu:** seed w `migrate.js` wypisuje `⚠ Failed to seed LLM defaults`
(`LlmAssignmentWhereUniqueInput needs at least one of operationType_level`). To ostrzeżenie
lokalnej bazy e2e, **nie błąd** — build kończy się `exit 0`. Diff tego przebiegu **nie dotyka
żadnego pliku LLM** (`git diff -- '*llm*' '*Llm*'` pusty), więc jest to zastane; odnotowane, nie
naprawiane w tym przebiegu.

---

## Kryteria akceptacji

### AC-1 — obliczenia trasy dają się zawołać jako funkcja · ✅ spełnione

Wyodrębnione w T-2 jako `collectDashboardSnapshotLegacy(userId, permissions, isAdmin)` — **czysta
przenosina**, bez sesji w środku, wzorowana na `collectCalendarEvents`. Dowód, że to przenosina,
a nie przepisanie: `git show` commitu T-2 pokazuje przeniesione bloki z zachowaną kolejnością,
tymi samymi `try/catch` i wartościami domyślnymi. Funkcja spełniła swoją rolę (punkt odniesienia
i cztery porównania) i została skasowana w T-10, gdy wkłady trafiły do modułów.

### AC-2 — punkt odniesienia zapisany PRZED zmianą struktury · ✅ spełnione

`specs/050-pulpit-z-deklaracji/baseline-pulpit.json` — dwa warianty po 20 pól, zrzucone przed
utworzeniem pierwszego `dashboard.ts`. **19 z 20 pól niezerowych**; dwudzieste (`adminStats`) jest
`null` z założenia, bo zrzut leci na koncie bez roli ADMIN.

Zrzut kosztował dwie korekty planu (C-54), obie zapisane w `tasks.md` przy T-3:
- skrypt dawał **6 niezerowych pól z 20** (Server Actions poza kontekstem żądania rzucają „headers
  was called outside a request scope", a `try/catch` zamienia to na ciche zera) → zrzut przez
  tymczasową trasę diagnostyczną na działającym serwerze;
- **siedem z jedenastu bloków ignoruje parametr `userId`** i czyta konto z sesji → fixture nauczony
  siać na istniejącym koncie (`--email=`).

### AC-3 — wkład pochodzi z deklaracji modułu · ✅ spełnione

Jedenaście plików `src/modules/<x>/dashboard.ts` (Zakupy, Notatki, Portfel, Raporty, Kuchnia,
Zwierzęta, Magazynowanie, Nauka języków, Zadania, Flota, Zdrowie), wpiętych w korzeń kompozycji
`src/lib/dashboardContributors.ts`. Żaden nie jest już liczony w trasie: `src/lib/dashboardLegacy.ts`
skasowany w T-10.

**Odstępstwo od planu, świadome i zmierzone (C-54):** wpięcie nie idzie przez pole `dashboard`
w `module.server.ts` — patrz AC-7. Cena (wkład niewidoczny w deklaracji) jest spłacona bramką
sprawdzającą wpięcie **w obie strony**.

### AC-4 — trasa pulpitu bez importów modułów · ✅ spełnione

```
$ grep -n "@/modules/" src/app/page.tsx
12:import { HomePage } from "@/modules/home/ui/HomePage";
```

Jedyne trafienie to **widok** Strony głównej — trasa musi coś wyrenderować. Zero kontraktów, zero
gałęzi `if (has("module.x"))`. Trasa schudła z **322 do 87 linii**, z czego znaczna część to
nagłówek wyjaśniający, co i dlaczego w niej zostało.

### AC-5 — brak uprawnienia = wkład niewołany · ✅ spełnione

Bramkowanie jest w kompozycji (`src/lib/dashboardSnapshot.ts:28-31`), wyprowadzone z rejestru
`MODULES`, nie z listy w trasie — moduł nie decyduje o własnej widoczności (C-22).

Zrzut „bez uprawnień" równa się `EMPTY_SNAPSHOT` w **19 polach na 20**. Dwudzieste to
`recentReports: 1` — i to jest **zgodne**, nie odstępstwo: Raporty mają `permission: null` (są
powierzchnią dostępną każdemu zalogowanemu) i **dziś też nie były bramkowane**. Zbramkowanie ich
byłoby cichą zmianą zachowania, czyli dokładnie tym, czego ten przebieg miał nie zrobić. Kryterium
T-9 doprecyzowano w `tasks.md` (C-54), z zapisanym powodem.

### AC-6 — migawka identyczna wartość po wartości · ✅ spełnione

Porównanie **po każdej grupie wkładów**, nie raz na końcu — pięć razy, za każdym razem oba warianty:

| Po zadaniu | z uprawnieniami | bez uprawnień |
|---|---|---|
| T-6 (4 wkłady jednopolowe) | 20 pól, IDENTYCZNE | 20 pól, IDENTYCZNE |
| T-7 (4 wkłady dwupolowe) | 20 pól, IDENTYCZNE | 20 pól, IDENTYCZNE |
| T-8 (Zadania, Flota, Zdrowie) | 20 pól, IDENTYCZNE | 20 pól, IDENTYCZNE |
| T-10 (trasa składa z katalogu) | 20 pól, IDENTYCZNE | 20 pól, IDENTYCZNE |
| T-12 (własny korzeń kompozycji) | 20 pól, IDENTYCZNE | 20 pól, IDENTYCZNE |

Porównanie leci na żywym serwerze z ciasteczkiem sesji i zestawia **każde pole osobno**
(`json.dumps(..., sort_keys=True)`), nie sumę ani długość.

### AC-7 — graf kompilacji nie rośnie o nic, czego trasa nie używa · ✅ spełnione (kryterium doprecyzowane)

| wariant | `/auth/signin` | `/` |
|---|---|---|
| przed 050 | 1771 | **1889** |
| wkłady przez wspólny `MODULE_SERVER` | 1771 | **2117** |
| wkłady przez własny korzeń (stan dowieziony) | 1771 | **1903** |

`/auth/signin` **bez zmian**. `/` rośnie o **+14 = dokładnie liczba nowych plików** (11 wkładów +
`dashboardContributors.ts` + `dashboardSnapshot.ts` + `platform/dashboard.ts`).

**To pomiar zmienił projekt, nie odwrotnie.** Pierwsze podejście wpinało wkłady polem `dashboard`
w `module.server.ts` — tak jak `ai`, `jobs` i `calendar` — i dało 2117: `MODULE_SERVER` to obiekt
czterech leniwych loaderów na moduł, a webpack w trybie dev kompiluje cele `import()` osiągalne
ze statycznie zaimportowanego pliku, więc pulpit ciągnął egzekutory asystenta i handlery zadań
**siedemnastu** modułów, których nie wywołuje ani razu. To ta sama lekcja co kontrakt-barrel z 049,
piętro wyżej.

Pierwotne brzmienie AC-7 („`/` nie rośnie") było **nieosiągalne z definicji** — jedenaście nowych
wkładów to jedenaście nowych plików. Kryterium doprecyzowano w `spec.md` **razem z tabelą pomiarów**
(C-54), a nie obniżono: mierzoną własnością jest **brak grafu, którego trasa nie używa**, i to ona
odrzuciła wariant 2117.

### AC-8 — bramki i build · ✅ spełnione

Tabela na górze. Cztery liczniki **160 / 551 / 35 / 35** bez spadku, build `exit 0`, `test:unit`
657/657.

### AC-9 — bramka wykrywa trasę „po staremu" · ✅ spełnione

`check-module-registry.js` dostał **dwie** kontrole (razem osiem), obie sprawdzone **testem
negatywnym** — bramka, której nie widziano na czerwono, nie jest dowodem:

| Podłożony błąd | Wynik |
|---|---|
| stan czysty | `exit 0` |
| `import { getVehicles } from "@/modules/flota/contract"` w `src/app/page.tsx` | `exit 1` — „Trasa pulpitu sięga do modułów: @/modules/flota/contract" |
| `dashboard.ts` Zwierząt bez wpięcia w korzeń | `exit 1` — „nie jest wpięty w src/lib/dashboardContributors.ts" |
| wpięcie `qa` bez pliku `src/modules/qa/dashboard.ts` | `exit 1` — „wpina „qa", ale … nie istnieje" |
| po przywróceniu | `exit 0` |

Pierwsza wersja kontroli dwukierunkowej **przepuszczała** przypadek „wpięcie bez pliku" (pętla
usuwała id ze zbioru bezwarunkowo). Złapał to test negatywny — czyli zadziałał dokładnie tak, jak
miał.

### AC-10 — dziennik · ✅ spełnione

`content/architektura/15-dziennik.md`: wpis **050**, aktualizacja sekcji „Gdzie jesteśmy"
(Faza 1 domknięta w całości) i statusu zadania 7 w tabeli. Odpowiedź na pytanie kontrolne
z rozdz. 14 zapisana **bez przypisu**: *jeden katalog plus wpięcie w korzeń kompozycji*. Wskazany
pierwszy krok Fazy 2 (zadanie 9: `Workspace`, `WorkspaceMember`, `ResourceGrant`,
`ResourceInvitation`) oraz dług zabierany z Fazy 1 (read-toole przez `requireAccess`).
Książka przebakowana (`copy-architektura`: 15 rozdziałów, 21264 słowa).

---

## Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| **C-01** praca w `worldofmag/` | ✅ jedyne pliki poza nim to `specs/` (C-03) i `doświadczenia.md` (C-51) |
| **C-02** alias `@/*`, własne wnętrze względnie | ✅ wkłady importują `./contract`, korzeń kompozycji aliasem |
| **C-36** granica modułów | ✅ `grep "@/modules/" src/platform/` = zero; **C-36 rozszerzone** o wkład pulpitu i czystą trasę pulpitu |
| **C-10..C-14** baza | ✅ nie dotyczy — **zero zmian schematu i migracji** |
| **C-20** `revalidatePath` | ✅ nie dotyczy — przebieg nie dodaje mutacji; wkłady są wyłącznie odczytem |
| **C-21** własność danych | ✅ warunki `ownerId`/`ownerTeamId` przeniesione bez zmiany treści (`shopping/dashboard.ts`, `tasks/dashboard.ts`) |
| **C-22** RBAC scentralizowany | ✅ bramkowanie **w kompozycji**, wyprowadzone z rejestru; zero nowych slugów |
| **C-23** akcje AI | ✅ nie dotyczy — zero nowych `AIAction`; `check:actions` 160 bez zmian |
| **C-30..C-34** UI | ✅ nie dotyczy — zero zmian w widokach; `HomePage` dostaje ten sam kształt danych |
| **C-32** teksty PL | ✅ komentarze i komunikaty bramek po polsku |
| **C-50** build zielony | ✅ |
| **C-51** `doświadczenia.md` | ✅ dwa wpisy: wspólny rejestr leniwych loaderów jako barrel; zrzut ze skryptu przy kodzie czytającym sesję |
| **C-53** minimalizm | ✅ rozdzielenie `ai`/`jobs`/`calendar` **świadomie NIE zrobione** w tym przebiegu, mimo tego samego podatku — wskazane jako osobny krok |
| **C-54** spójność artefaktów | ✅ trzy korekty w górę łańcucha, każda z zapisanym powodem: sposób zrzutu (T-3), kryterium T-9, AC-7 w `spec.md` |

---

## Regresje

- **Widok pulpitu:** kształt danych `HomePage` bez zmian (`DashboardSnapshot` + `adminStats` +
  dane konta). Zero zmian w `src/modules/home/ui/`.
- **Sąsiednie moduły:** `module.server.ts` jedenastu modułów straciło **wyłącznie** wiersz
  `dashboard:`; pola `ai`, `jobs`, `calendar` nietknięte. Katalog asystenta (160/56/16), allowlista
  zadań (12) i agenda kalendarza działają na niezmienionej ścieżce przez `MODULE_SERVER`.
- **Trasa diagnostyczna:** `/api/dashboard-baseline` i jej wyjątek w matcherze `middleware.ts`
  **usunięte** (T-12b); `grep -rn "dashboard-baseline" src/ scripts/` nie zwraca nic. Matcher wrócił
  do stanu sprzed przebiegu, więc bramka logowania nie ma nowej dziury.
- **Odporność na błąd wkładu:** osiem rozsypanych `try/catch` zastąpił jeden w korzeniu — zachowanie
  to samo (padnięty wkład daje puste pola, nie pustą stronę), ale **ta sama uwaga co przy agendzie
  w 049**: cichy błąd objawia się brakiem danych, nie komunikatem.
- **Klikacze:** nieuruchamiane — właściciel zdecydował 2026-08-11, że nie inwestujemy w nie czasu
  w tym przebiegu (spec §5). Zamiast nich równoważność dowodzi zrzut runtime pole po polu, który
  dla tej zmiany jest miarą **ostrzejszą** niż klikacz sprawdzający, czy strona się wyrenderowała.

---

## Werdykt końcowy

## **GOTOWE**

Wszystkie dziesięć kryteriów akceptacji spełnione, komplet bramek zielony, cztery liczniki bez
spadku. Faza 1 przebudowy jest domknięta: zniknęła szósta i ostatnia równoległa lista opisująca
moduł, a odpowiedź na pytanie kontrolne z rozdz. 14 nie ma już przypisu.

**Dwie rzeczy warte uwagi recenzji, obie odnotowane, żadna blokująca:**
1. **AC-7 doprecyzowane w trakcie przebiegu** — z pomiarem i tabelą trzech wariantów, nie z wygody.
   Wybór projektowy (własny korzeń kompozycji zamiast pola w `module.server.ts`) jest konsekwencją
   tego pomiaru i kosztuje widoczność wpięcia w deklaracji — spłaconą bramką dwukierunkową.
2. **Trzy pozostałe korzenie kompozycji płacą ten sam podatek** (agenda kalendarza wciąga egzekutory
   asystenta). Rozdzielenie ich to ta sama operacja; świadomie zostawione jako osobny krok (C-53),
   zapisane w dzienniku i w `dashboardContributors.ts`.
