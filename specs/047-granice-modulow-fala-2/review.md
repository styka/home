# Recenzja: Granice modułów — Faza 1, fala 2

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Zakres diffa:** `1f520ec7..HEAD` — 15 commitów, 129 plików, w większości `git mv`
- **Werdykt:** **APPROVE Z UWAGAMI**

---

## Jak recenzowałem

Jak w 046: diff jest zdominowany przez przenosiny, więc recenzja celowała w to, co **nowe albo
przepisane**. Realny nowy kod produkcyjny to raptem kilka miejsc — `getEpicTreeForAdmin` (61 linii),
siedem kontraktów, siedem deklaracji, edycje rejestru i uprawnień, krok seeda w skrypcie klikaczy.
Przenosiny sprawdziłem inaczej: szukając martwych odwołań, porównując kształt przepisanego zapytania
z oryginałem i weryfikując rejestr **w czasie wykonania**, a nie z lektury.

---

## Ustalenia

### 1. Seed połykał powód swojej awarii — **naprawione w recenzji**
`scripts/e2e-web.sh:107` · **correctness** (użyteczność sygnału)

Oba wywołania seeda miały `>/dev/null 2>&1`. Przy awarii operator dostawał komunikat „seed nie
przeszedł" **bez żadnej przyczyny** i musiał odtwarzać ją ręcznie.

**Scenariusz:** ktoś zmienia model, seed przestaje przechodzić, pełny zestaw klikaczy znów świeci
czerwienią z powodu pustych tabel — a log mówi tylko tyle, że „nie przeszedł". To działa **przeciwko**
celowi całej zmiany, którym jest zaufanie do czerwonego wyniku.

**Poprawka naniesiona:** wyciszony jest już tylko `stdout`; `stderr` zostaje widoczny. Składnia
skryptu sprawdzona (`bash -n`).

### 2. Runbook klikaczy mówił rzeczy, które przestały być prawdą — **naprawione w recenzji**
`docs/e2e/uruchamianie-e2e-claude.md:28,92` · **convention**

Dokument opisywał ręczne stawianie bazy jako `migrate deploy` bez seeda oraz „znane porażki" bez
liczby i bez rozróżnienia zastane/regresja. Po tej fali to jest myląca instrukcja: ktoś odtwarzający
środowisko z runbooka dostałby puste tabele i 16 czerwonych bez wyjaśnienia.

**Poprawka naniesiona:** dopisane kroki seeda oraz konkretny stan — **16 czerwonych na 132**,
wymienionych z nazwy, z adnotacją, że wszystkie są **potwierdzone jako zastane**, i informacją, że
seed naprawił trzy spece QA.

### 3. `getEpicTreeForAdmin` odtwarza poprzednie zachowanie 1:1 ✅ (sprawdzone, nie założone)
`src/modules/qa/actions/qa.ts:152` · **correctness**

Porównałem `orderBy`, `include`, `select` i kolejność pól mapowania między starym zapytaniem inline
(`git show 1f520ec7:…/admin/qa/page.tsx`) a nową funkcją — **identyczne**. Guard `requireAdmin`
na wejściu, tak jak w pozostałych funkcjach `*ForAdmin`. Wpis w manifeście pokrycia:
`excluded`/`admin`.

### 4. Kontrakty nie są spisami życzeń ✅ (sprawdzone maszynowo)

Dla każdej z 68 pozycji eksportowanych przez siedem kontraktów sprawdziłem, czy istnieje konsument
poza modułem. **Zero pozycji bez konsumenta.** To jest ta różnica, o którą chodziło: Magazynowanie ma
47 eksportów akcji i 14 pozycji w kontrakcie, Warsztaty — 23 i 11.

### 5. Rejestr i mapowanie ścieżek zweryfikowane w czasie wykonania ✅

Nie na podstawie lektury `modules.tsx`, tylko przez uruchomienie: `MODULES.length === 21`,
a `permissionForPath` zwraca poprawny slug dla jedenastu ścieżek przeniesionych modułów, w tym
zagnieżdżonych (`/warsztaty/przeglady`, `/magazynowanie/scan`, `/notes/groups`, `/health/leki`).

### 6. Wyłączenie nawigacji bocznej — zaakceptowane, ale to **ostatnie** takie
`src/components/shell/ModuleSidebar.tsx:14-15` · **convention** · nie blokujące

Powłoka importuje `LanguagesSideNav` i `FlotaSideNav` wprost z `ui/`. Uzasadnienie (kontrakt opisuje
dane, nie ekrany) jest spójne z decyzją z 046 i zostało zapisane **przed** kodem w trzech artefaktach
plus w dzienniku. Akceptuję — z zastrzeżeniem, że przy trzeciej fali dojdą kolejne moduły z boczną
nawigacją i wtedy pole `sideNav` w deklaracji przestaje być „następnym krokiem", a staje się
warunkiem, żeby to wyłączenie nie urosło do sześciu importów.

### 7. Sprawdzone i **czyste**

- **Zero martwych odwołań** do starych ścieżek (dziewięć plików akcji, siedem katalogów komponentów,
  trzy pliki `lib/`) poza `src/generated`, odtwarzanym przy każdym buildzie.
- **RBAC nieosłabione:** 551/551 akcji z guardem. Usunięcie stałych `PERMISSIONS.*` **wymusiło**
  przestawienie tras — kompilator wskazał każdą; nic nie mogło zostać po cichu.
- **Zero enumów Prisma, zero zmian schematu** (`check:schema-drift`), kolory przez zmienne CSS,
  teksty po polsku.
- **`actions/tags.ts` faktycznie został** — Kuchnia nadal importuje `@/actions/tags`, więc słownik
  nie został przypadkiem wciągnięty do Notatek.
- **Reguła granic zadziałała na realnym kodzie**, nie tylko na sondach: `next lint` złapał alias
  w `HealthHomePage`. To dowód, że egzekwowanie z 046 nie jest dekoracją.

### 8. Uwaga do C-53 — tym razem bez zastrzeżeń

W przeciwieństwie do 046 ta fala **nie dołożyła ani jednej bramki ani abstrakcji**. Jedyny nowy kod
produkcyjny poza przenosinami to funkcja wymagana przez AC-5. Wzorzec był gotowy i został powtórzony —
dokładnie o to chodziło w podziale na fale.

---

## Werdykt

**APPROVE Z UWAGAMI.**

Fala robi to, co obiecuje spec, i robi to powtarzalnie: siedem modułów, siedem commitów przenoszących,
poprawki osobno, zero zmian widocznych dla użytkownika, klikacz 21/21. Miary ze speca przekroczone
(11 modułów przy celu ≥10, lista przejściowa 10 przy celu ≤11). Dwie poprawki naniesione w recenzji
dotyczyły **wiarygodności sygnału z klikaczy** — czyli tego samego, co ta fala miała naprawić.

Uwagi przechodzące dalej: pole `sideNav` w deklaracji (przed trzecią falą, nie po niej), osiem
zastanych porażek klikaczy bez diagnozy, tagi do warstwy słowników platformy.
