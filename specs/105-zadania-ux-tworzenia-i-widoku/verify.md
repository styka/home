# Weryfikacja: Moduł Zadania — UX tworzenia i przeglądania zadań

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-26
- **Werdykt:** **GOTOWE Z UWAGAMI** (uwagi dotyczą zastanego długu, nie tej zmiany)

## 1. Bramki

Wszystko przeciw **lokalnemu** Postgresowi (`127.0.0.1:5432/omnia_dev`); `scripts/migrate.js`
świadomie pominięty — rusza prawdziwą bazę Neon (C-13).

| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0267)" — ta zmiana nie dodaje migracji |
| `npm run check:actions` | ✅ 164 akcje, wszystkie z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ 597 akcji sklasyfikowanych |
| `npm run check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `npm run check:ui-contract` | ✅ 23/23 modułów na `ModuleView`; 28 plików z zadeklarowanymi kolorami |
| `npm run check:client-safe` | ✅ |
| `npm run check:tailwind` | ✅ 176 katalogów objętych `content` |
| `npm run check:owner-columns` | ✅ 2409 wywołań Prismy, żadne nie pyta o skasowane kolumny |
| `npm run check:pagination` | ✅ każde `findMany` ma granicę |
| `npm run check:schema-drift` | ✅ brak rozjazdu |
| `npm run check:boundaries` | ✅ granice modułów egzekwowane |
| `npm run check:module-registry` | ✅ |
| `npm run check:content-memory`, `check:cost-badge` | ✅ 39 plików, bez nowego wejścia |
| `npm run check:e2e-waits` | ✅ żaden test nie czeka na `networkidle` |
| `tsc --noEmit` (`tsconfig.json` + `tsconfig.test.json`) | ✅ czysto |
| `next lint --dir src` | ✅ zero błędów; 3 ostrzeżenia `exhaustive-deps` w `TasksPage`/`TaskDetail` — tej samej klasy co ~64 zastane w repo |
| `next build` | ✅ „Compiled successfully" |
| `node scripts/check-perf-budget.js` | ✅ najcięższa trasa 1172 kB, suma 67494 kB — w pasmie ±5% |

## 2. Kryteria akceptacji

Klikacze: `e2e/specs/tasks-ux.spec.ts` + `e2e/specs/tasks.spec.ts` — **17 zielonych, 0 czerwonych**
(`/tmp/e2e-tasks.log`).

| AC | Jak sprawdzone | Dowód | Werdykt |
|----|----------------|-------|---------|
| AC-1 | klikacz `[105-AC1]` | z `/tasks` powstaje zadanie bez wchodzenia w projekt | ✅ |
| AC-2 | kod | `src/app/tasks/page.tsx` — `findFirst` po `createdById` → prop `ostatniProjektId`; `SzybkieDodanieZadania.tsx:32` odrzuca id spoza listy dostępnych | ✅ |
| AC-3 | klikacz `[105-AC1]` | adres pasuje do `/tasks/<id>?task=<id>`, tytuł widoczny w panelu | ✅ |
| AC-4 | kod | brak projektu → `wybranyProjekt === ""` → `createTask({ projectId: null })`; select zawsze ma pozycję „Skrzynka" | ✅ |
| AC-5 | klikacz `[105-AC5]` | zmierzone `scrollHeight = clientHeight = 63 px` — brak przewijania wewnątrz pola | ✅ |
| AC-6 | kod | `FormularzZadania.tsx` — `autoFocus` na opisie po rozwinięciu, pole tytułu z podpisem `tytulPowstanieZOpisu`/`tytulWlasny`; gałąź `if (recznyTytul)` **nie woła** `llm.tasks.suggestTitle` | ✅ |
| AC-7 | klikacz `[scenario-tasks-add-quick]` | `Enter` w polu tworzy zadanie (test istniejący, po zmianie `placeholder` faktycznie trafia w pole) | ✅ |
| AC-8 | kod | `FormularzZadania.tsx:207-210` — `Escape` ustawia `setRozwiniety(false)`, stanu `tresc` nie dotyka | ✅ |
| AC-9 | klikacz `[105-AC11]` | panel startuje na **480 px** (przed zmianą sztywne 380 px) | ✅ |
| AC-10 | klikacz + kod | `TasksPage.tsx:995` uchwyt `hidden md:block … cursor-col-resize`, zapis na `pointerup`; klikacz potwierdza trwałość po `reload()` | ✅ |
| AC-11 | klikacz `[105-AC11]` | panel **480 → 1060 px** po przełączeniu; `TaskList` nierenderowana | ✅ |
| AC-12 | klikacz `[105-AC11]` | `Esc` przywraca przycisk „Rozwiń", zadanie zostaje otwarte | ✅ |
| AC-12a | klikacz `[105-AC11]` | po `reload()` tryb pełny nadal włączony | ✅ |
| AC-13 | kod | uchwyt `hidden md:block` (`TasksPage.tsx:995`), przełącznik `hidden md:flex` (`TaskDetail.tsx:948`), `useIsNarrowScreen()` (`TasksPage.tsx:143`) blokuje chowanie listy na wąskim ekranie; mobilny `md:hidden` panel bez zmian | ✅ |
| AC-14 | klikacz `[scenario-tasks-nav-jk]` | `j`/`k` nie psują widoku | ✅ |
| AC-15 | kod | `TaskDetail.tsx:279` i `TasksPage.tsx:509` — `description` z tytułem zadania i wzmianką o Koszu | ✅ |
| AC-16 | kod | `Modal.tsx:90` — `children != null && children !== false`; dotyczy wszystkich okien aplikacji | ✅ |
| AC-17 | klikacz `[105-AC17]` | po akcji masowej kolumna zaznaczeń **nadal w drzewie** | ✅ |
| AC-18 | klikacz `[105-AC17]` | `toHaveCount(2)` — oba wiersze wracają do stanu „do zaznaczenia", można zaznaczać dalej | ✅ |
| AC-19 | klikacz `[105-AC17]` + `[080-AC1]` | `Esc` i przycisk trybu chowają kolumnę; poza tym tryb trwa | ✅ |
| AC-20 | kod | `TasksPage.tsx:406-411` — `wyczyscZaznaczenie` zeruje `selectedIds`, więc licznik nie może wskazywać usuniętych zadań | ✅ |

**21 z 21 spełnionych.** Żadne nie jest częściowe ani niesprawdzone.

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|--------|-------|
| C-01 | ✅ cała zmiana w `worldofmag/`; legacy `src/`, `_old/`, `pom.xml` nietknięte |
| C-10..C-14 | ✅ brak zmian w schemacie i brak migracji — napisane wprost w planie §2 |
| C-20 | ✅ jedyna mutacja idzie istniejącym `createTask` z jego `revalidatePath` |
| C-17/C-21 | ✅ dostęp bez zmian; guard `assertProjectAccess` wewnątrz `createTask` |
| C-22 | ✅ istniejący slug `module.tasks`, zero nowych tras |
| C-23/C-40 | ✅ brak nowych `AIAction`; `llm.tasks.suggestTitle` przeniesione, manifesty pokrycia bez zmian |
| C-24 | ✅ usuwanie nadal przez Kosz — i okno wreszcie to mówi |
| C-30 | ✅ wyłącznie zmienne CSS; **usunięty** zastany hex `#dc2626` z formularza, wraz z martwym wyjątkiem w manifeście |
| C-31 | ✅ mobilny widok nietknięty; `Enter`, `a/n`, `j/k`, `Esc` zachowane |
| C-32 | ✅ 17 nowych tekstów w `messages/pl.json`, zero literałów |
| C-33 | ✅ **kontrakt widoku nietknięty** — tryb pełny mieści się wewnątrz `layout="fill"` `TasksPage`; brak wyjątku w module |
| C-34 | ✅ `confirmDialog` z jawnym `destructive`, dołożona brakująca treść |
| C-35 | ✅ `FormularzZadania` dowieziony **z dwoma konsumentami**; `QuickAddTask` jako cienka nakładka |
| C-51 | ✅ cztery wpisy w `doświadczenia.md` |
| C-53 | ✅ zero nowych zależności, tabel, tras i akcji; nowe pliki: dwa komponenty + jeden helper |

Naruszeń brak.

## 4. Regresje

- **Pełny zestaw klikaczy: 212 przeszło, 15 padło.** Czternaście z nich **pada identycznie, co do
  nazwy, na czystym `origin/develop`** — zmierzone osobnym przebiegiem bazowym (`/tmp/e2e-baza.log`:
  „14 failed", ta sama lista). To zastany dług: Wiadomości ×10 (specy zależą od kanałów RSS, których
  sandbox nie pobiera), `favorites`, `shortcuts`, `chrom-konta`, `zgloszenia-i-uklad`.
- **Piętnasty był mój i został naprawiony** — `[105-AC17]` mierzył co innego, niż mówi jego nazwa
  (zaznaczony wiersz zmienia `aria-label` na „Odznacz zadanie", a klik w `/priorytet/i` trafiał
  w przycisk formularza dodawania, nie w pasek akcji zbiorczych).
- **Wspólny `Modal`** — zmiana jest zawężająca (mniej DOM przy pustym ciele). Okna z treścią
  renderują się jak dotąd; potwierdzone przejściem całego zestawu, w którym modale otwiera
  kilkanaście specyfikacji.
- **Istniejący klikacz `[ux-AC23]`** wymagał poprawki locatora, bo pole dodawania stało się
  `textarea` i stoi wyżej w drzewie niż opis zadania. To realna zmiana DOM, nie naciąganie testu.
- **`[080-AC1]`** (kolumna zaznaczeń znika razem z trybem) — nadal zielony, więc trwały tryb nie
  odebrał możliwości wyjścia z niego.
- Moduły sąsiednie: brak zmian w `revalidatePath`, RBAC i schemacie, więc nie ma czym ich ruszyć.

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie 21 kryteriów spełnione, wszystkie bramki zielone, zestaw klikaczy Zadań w całości zielony.

Uwagi, świadomie **niebędące** przedmiotem tej zmiany:
1. **14 zastanych czerwonych klikaczy** — potwierdzone pomiarem na `develop`. Dziesięć z nich to
   Wiadomości, których specy wymagają realnych kanałów RSS; w sandboksie nie da się ich zazielenić
   bez sieci. To backlog jakości scenariuszy.
2. **3 ostrzeżenia `exhaustive-deps`** w dotkniętych plikach — tej samej klasy co ~64 zastane
   w repo, wypisane w roadmapie `CLAUDE.md` jako osobne zadanie porządkowe.
3. **AC-6 potwierdzone kodem, nie klikaczem** — „ręczny tytuł nie woła modelu" wymagałoby
   przechwycenia żądania sieciowego; gałąź jest jednoznaczna w kodzie i pokryta wpisem w dzienniku.
