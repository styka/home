# Recenzja: Granice modułów — Faza 1 (pionowy wycinek)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Zakres diffa:** `1f4a88cd..HEAD` — 11 commitów, 361 plików (w przeważającej części `git mv`)
- **Werdykt:** **APPROVE Z UWAGAMI**

---

## Jak recenzowałem

Diff jest nietypowy: ~90% to czyste przenosiny plików (`git show --stat` pokazuje je jako rename
z zerową zmianą treści), a realna nowa logika mieści się w kilkunastu plikach. Recenzja skupiła się
więc na tym, co **nowe albo przepisane**: `platform/registry.ts`, `lib/modules.tsx`,
`lib/pathPermissions.ts`, zmieniony `platform/auth/permissions.ts`, odwrócona zależność w
`platform/favorites/favoriteViews.ts`, cztery kontrakty i deklaracje, dwie nowe bramki oraz
konfiguracja lintu. Przenosiny sprawdziłem inaczej — szukając martwych odwołań do starych ścieżek
i licząc, czy bramki nadal widzą tyle samo elementów, co przed refaktorem.

---

## Ustalenia

### 1. Duplikacja dopasowania ścieżki — **naprawione w trakcie recenzji**
`src/lib/modules.tsx:68` · **simplification** (C-53)

`declaredPermissionForPath` przepisywało pętlę po `routes` z `exact`/prefiksem, mimo że identyczna
logika stała już w `platform/registry.ts` jako `permissionForPathIn`. Dwie kopie reguły dopasowania
ścieżki to nie kosmetyka: to reguła **decydująca o dostępie**, a rozjazd między kopiami dałby
sytuację, w której menu uważa ścieżkę za chronioną, a strażnik nie (albo odwrotnie).

**Poprawka naniesiona:** `declaredPermissionForPath` to teraz jednolinijkowe wywołanie
`permissionForPathIn(DECLARED, path)`. Test `moduleRegistry.test.ts` (11/11), `next build` i obie
nowe bramki nadal zielone.

### 2. `AC-6` domyka się dopiero przy pustej liście przejściowej
`scripts/check-module-registry.js` · **convention** · nie blokujące, opisane w `verify.md`

Bramka wykrywa niekompletny moduł **wewnątrz** `src/modules/`, ale nie wykryje modułu napisanego po
staremu (rozsypanego po `src/actions` + `src/components`). Nie da się jej dziś zaostrzyć, bo tak
wygląda 17 z 21 modułów. To ograniczenie **wynikające z fazy**, nie niedoróbka — i jest jawnie
zapisane w dzienniku oraz w `verify.md`, a nie przemilczane.

### 3. `app/admin/qa/page.tsx` czyta Prismę z pominięciem kontraktu QA
`src/app/admin/qa/page.tsx:15` · **convention** · **dług zastany, świadomie nietknięty**

Strona admina buduje drzewo epików bezpośrednim `prisma.qaEpic.findMany`, mimo że moduł wystawia
`getAllEpics`. Stan sprzed tego przebiegu. Nie ruszałem go celowo: `src/app/**` nie podlega regule
granic, a podmiana zapytania na wywołanie kontraktu byłaby **zmianą zachowania w commicie
przenoszącym** — czyli złamaniem zasady, na której stoi cała ta faza. Do sprzątnięcia przy okazji
następnej fali.

### 4. Klikacze: 16 czerwonych z braku seeda w środowisku weryfikacji
`scripts/e2e-web.sh:92` · **test-coverage** · nie blokujące

Skrypt odpala `prisma migrate deploy` i seed użytkowników E2E, ale nie `npm run db:seed`.
Potwierdzone zapytaniem: `QaEpic` = 0, `ShoppingList` = 0, `Note` = 0. Skutek jest gorszy niż same
czerwone testy — **psuje wartość sygnału**: „czerwony" przestaje znaczyć „regresja". Poza zakresem
tego feature'a, ale wart osobnego zadania.

### 5. Sprawdzone i **czyste** — rzeczy, przy których diff tej wielkości zwykle się psuje

- **Brak martwych odwołań** do `components/{truck,contacts,reports,qa}`, `actions/{…}`,
  `lib/{ors,overpass,googleMaps}` w `src/`, `e2e/`, `scripts/` (poza `src/generated`, które jest
  odtwarzane przy każdym buildzie).
- **RBAC nie osłabione.** Kontrola dostępu nadal 550/550 akcji z guardem. Rename
  `isPathLocked` → `legacyIsPathLocked` w platformie był celowy: gdyby zostawić starą nazwę,
  zapomniany import dawałby **wariant widzący tylko część aplikacji** bez żadnego sygnału. Po zmianie
  jest to błąd kompilacji — i `tsc` potwierdza, że nie została ani jedna taka referencja.
- **Odwrócenie zależności w ulubionych zrobione bezpiecznie.** `filterAccessibleFavorites` przyjmuje
  predykat **parametrem wymaganym**, nie opcjonalnym z domyślnym. Przy domyślnym zapomniane
  przekazanie oznaczałoby cichy przeciek RBAC (ulubiony do modułu bez uprawnienia po prostu by się
  pokazał); teraz to błąd kompilacji. Wszystkie trzy miejsca renderowania przekazują predykat.
- **Zero enumów Prisma, zero hardcode'u kolorów** (deklaracje używają `var(--accent-*)`; pilnuje tego
  test i bramka), teksty po polsku (etykiety, komunikaty obu bramek i reguł lintu).
- **Bez zmian schematu** — potwierdza `check:schema-drift`, nie tylko deklaracja w planie.
- **Reguła granic naprawdę działa**, a nie tylko istnieje: `check:boundaries` sprawdzony testem
  negatywnym samej bramki (wyłączenie reguły → czerwona; zepsucie konfiguracji → czerwona).

### 6. Uwaga do C-53 (minimalizm) — świadome przekroczenie planu

Powstały trzy rzeczy spoza planu: `check:boundaries`, kontrola wpięcia w `check:module-registry`
i `tsconfig.test.json`. Każda jest odpowiedzią na dziurę **napotkaną w tym przebiegu**, nie na
przeczucie: (1) `next lint` przy niepoprawnej konfiguracji kończy się kodem 0, więc reguła, którą
rozdz. 14 nazywa nieopcjonalną, mogła po cichu nie działać; (2) moduł z kompletną deklaracją,
którego nikt nie importuje, istnieje na dysku i nie istnieje w aplikacji przy zielonym buildzie;
(3) `tsc` nie widzi plików testowych i dwa razy w tym przebiegu przepuścił zerwany import.
Uzasadnienia zapisane w `plan.md` (C-54). Uznaję to za uzasadnione, ale odnotowuję — to jest
przekroczenie planu, a nie jego realizacja.

---

## Werdykt

**APPROVE Z UWAGAMI.**

Diff robi dokładnie to, co obiecuje spec, i robi to w sposób, który da się powtórzyć siedemnaście
razy: przenosiny oddzielone od zmian funkcji (osobne commity, widoczne jako rename), granica
egzekwowana maszynowo i **sprawdzona testem negatywnym**, deklaracja **zastępująca** wpisy w listach,
a nie dokładająca dziewiątej. Jedna poprawka naniesiona w recenzji (duplikacja dopasowania ścieżki).
Trzy uwagi przechodzą dalej jako jawny, nazwany dług: domknięcie AC-6 przy pustej liście
przejściowej, `prisma` w panelu admina QA i brak seeda w środowisku klikaczy.
