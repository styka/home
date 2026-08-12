# Weryfikacja: Przestrzenie i nadania — fundament danych pod współdzielenie

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-12 · **Branch:** `claude/omnia-architecture-skins-qlv2ew`
- **Diff przebiegu:** 15 plików, +1354 / −17

---

## Bramki

| Komenda | Wynik |
|---|---|
| `npm run build` (pełny potok, **lokalny** Postgres — C-13) | ✅ **exit 0**, „Compiled successfully" |
| `npm run test:unit` | ✅ **666 / 666** (było 657 — +9 z nowego testu lustra) |
| `tsc --noEmit` · `tsc -p tsconfig.test.json` | ✅ oba exit 0 |
| `next lint --dir src` | ✅ 0 błędów |
| `check:migrations` | ✅ następny wolny numer 0227 |
| `check:schema-drift` | ✅ **realnie uruchomiona** (nie pominięta — patrz niżej) |
| `check:workspace-mirror` (nowa) | ✅ 2 pliki mutujące zespół, każdy uzgadnia przestrzeń |
| `check:actions` 160 · `check:ai-coverage` 551 · `check:cost-badge` 35 · `check:content-memory` 35 | ✅ **bez ruchu** |
| `check:module-registry` · `check:boundaries` · `check:ui-contract` | ✅ |

**Obserwacja spoza zakresu:** seed w `migrate.js` wypisuje `⚠ Failed to seed LLM defaults` na lokalnej
bazie e2e. Ostrzeżenie, nie błąd (build `exit 0`), zastane — diff przebiegu nie dotyka plików LLM.

---

## Kryteria akceptacji

### AC-1 — schemat zgodny z migracjami · ✅ spełnione

`npm run check:schema-drift` → *„brak — migracje odtwarzają dokładnie `schema.prisma`
(2 świadomych wyjątków)"*.

**Ta zieleń wymagała najpierw naprawy samej bramki.** Przy pierwszym uruchomieniu wypisała
*„pominięty (nie udało się przygotować bazy cienia)"* — bo tworzy ją przez `CREATE DATABASE`
i toleruje wyłącznie błąd „already exists", a rola bez uprawnienia `CREATEDB` dostaje „permission
denied" **także wtedy, gdy baza cienia istnieje**. Bramka była więc najcichsza dokładnie tam, gdzie
najbardziej potrzebna. Po poprawce (sprawdzamy stan faktyczny — czy da się połączyć — zamiast ufać
treści błędu) ruszyła po raz pierwszy i **od razu zarobiła na siebie**, wyłapując defekt opisany
w AC-10. Test negatywny wykonany: podłożona kolumna w `schema.prisma` → `exit 1`, po cofnięciu →
zielona.

### AC-2 — `String` + unia, zero enumów bazy · ✅ spełnione

`grep -c "^enum " prisma/schema.prisma` → **0**. Cztery nowe słowniki są tekstem z zawężającym typem
w `src/platform/workspaces/types.ts:13,16,25,28` (`WorkspaceKind`, `WorkspaceMemberRole`,
`ResourceRole`, `GrantSubjectType`).

### AC-3 — każdy użytkownik i zespół ma przestrzeń · ✅ spełnione

Migracja 0226 zastosowana na bazie **z danymi** (nie na pustej — pusty wynik zgadza się z pustym):

```
użytkownicy 4 = przestrzenie osobiste 4 | zespoły 1 = zespołowe 1
użytkownicy bez przestrzeni osobistej: 0
```

### AC-4 — właściciel zespołu w przestrzeni, także bez wiersza członkostwa · ✅ spełnione

Fixture zawiera zespół, którego właściciel **celowo nie ma wiersza `TeamMember`** — to najbardziej
prawdopodobny cichy błąd tego przebiegu, bo odwzorowanie „po członkach" wygląda przy nim na kompletne.

```
brzegowy: u-brzeg-czlonek=member, u-brzeg-wlasciciel=owner
```

Pokryte dwukrotnie: krokiem 1c migracji (`INSERT … ON CONFLICT DO UPDATE SET role='owner'`, **po**
członkach) i osobnym przypadkiem testu.

### AC-5 — backfill idempotentny · ✅ spełnione

Powtórzenie sekcji backfillu na bazie po migracji: liczniki `Workspace/WorkspaceMember` **5/6 przed
i 5/6 po**, zero duplikatów. Dodatkowo test: drugie `syncTeamWorkspace` i drugie
`ensurePersonalWorkspace` zwracają `{0,0,0}`.

### AC-6 — nowe konto dostaje przestrzeń · ✅ spełnione

`ensurePersonalWorkspace` wpięte w zdarzenie `createUser`
(`src/platform/auth/session.ts`) — rozdz. 8.2 mówi „powstaje automatycznie przy rejestracji", więc
to jej jedyne właściwe miejsce. Test sprawdza, że pierwsze wywołanie tworzy dokładnie jedną
przestrzeń z rolą `owner`, a drugie nie zmienia niczego.

### AC-7 — zmiany zespołu przechodzą do lustra · ✅ spełnione

Osiem punktów wpięcia: `actions/teams.ts` (7 mutacji: `createTeam`, `createSubTeam`, `updateTeam`,
`changeMemberRole`, `removeMember`, `leaveTeam`, `transferTeamOwnership`) i `actions/invitations.ts`
(przyjęcie zaproszenia). `deleteTeam` **świadomie bez wywołania** — sprząta kaskada klucza obcego,
co test potwierdza osobnym przypadkiem. Testy pokrywają zmianę nazwy, awans członka i usunięcie
członka.

**Dowód krzyżowy, mocniejszy niż same testy:** `reconcileWorkspaces()` uruchomione na bazie **po
backfillu SQL** zwróciło `{utworzone:0, zaktualizowane:0, usuniete:0}`. Reguła mapowania ról ma dwa
niezależne zapisy (SQL migracji i TypeScript lustra, bo prod nie wykona kodu TS przy
`migrate deploy`) i **oba dają identyczny wynik**.

### AC-8 — rozjazd jest wykrywany, sprawdzone testem negatywnym · ✅ spełnione

Dwa poziomy, oba widziane na czerwono:

| Podłożony błąd | Wynik |
|---|---|
| awaria w `syncTeamWorkspace` (wczesny `return`) | **6 z 9 przypadków testu czerwonych**, w tym ten sprawdzający wykrywanie rozjazdu |
| po przywróceniu | 9/9 zielonych |
| nowy plik mutujący `TeamMember` bez importu lustra | `check:workspace-mirror` **exit 1** |
| martwy wyjątek w manifeście bramki | `check:workspace-mirror` **exit 1** |
| stan czysty | exit 0 |

### AC-9 — zero zmian widocznych · ✅ spełnione

```
$ git diff --stat origin/develop..HEAD -- worldofmag/src/app worldofmag/src/components
(pusto)
```

**Ani jeden plik** trasy ani komponentu. Żadna Server Action nie zmieniła sygnatury ani wyniku;
`revalidatePath` zostały tam, gdzie były. Nic nie czyta nowych tabel — dostęp liczy się dalej przez
`ownerId`/`ownerTeamId`.

### AC-10 — bramki i build · ✅ spełnione

Tabela na górze. **Tu jednak weryfikacja znalazła realny defekt i wróciła do implementacji (C-54),
zamiast go obejść** — opisane poniżej w „Regresje", bo to jedyna rzecz w tym przebiegu, która mogła
zaszkodzić produkcji.

### AC-11 — dziennik · ✅ spełnione

`content/architektura/15-dziennik.md`: wpis **051**, sekcja „Gdzie jesteśmy" (**Faza 2 otwarta**),
tabela zadań (9 → ✅), wskazanie zadania 10 jako następnego kroku i **dwie rzeczy świadomie
zostawione** (tabele nadań bez konsumenta, unikalność nadań linkowych). Książka przebakowana
(15 rozdziałów, 22 161 słów). Do tego `constitution.md` (**C-15**, **C-16**), `CLAUDE.md` i dwie
lekcje w `doświadczenia.md`.

---

## Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| **C-01** praca w `worldofmag/` | ✅ poza nim tylko `specs/` (C-03) i `doświadczenia.md` (C-51) |
| **C-10, C-11, C-14** migracje | ✅ ręczna 0226, numer z `next:migration`, backfill idempotentny (`ON CONFLICT`, `gen_random_uuid()::text`) |
| **C-12** zero enumów Prisma | ✅ 0 enumów w schemacie |
| **C-13** nigdy prod DB | ✅ wyłącznie lokalny Postgres; przy backfillu dotykającym wszystkich kont to nie formalność |
| **C-20** `revalidatePath` | ✅ zero nowych akcji; istniejące nietknięte |
| **C-21** własność danych | ✅ `ownerId`/`ownerTeamId` bez zmian — przestrzenie są lustrem, nie zamiennikiem |
| **C-22** RBAC | ✅ zero nowych slugów; role przestrzeni to inny wymiar niż `module.*` |
| **C-23** akcje AI | ✅ nie dotyczy — liczniki bez ruchu |
| **C-30..C-32** UI | ✅ brak UI; jedyny tekst do bazy („Moja przestrzeń") po polsku |
| **C-36** granica platformy | ✅ nowa zdolność w `src/platform/`, `resourceType` to **tekst**, nie odwołanie do modułu |
| **C-50** build zielony | ✅ |
| **C-51** `doświadczenia.md` | ✅ dwa wpisy (defekt `migrate diff`, milcząca bramka) |
| **C-53** minimalizm | ✅ świadomie **nie**: `requireAccess`, `workspaceId` na 46 modelach, indeks nadań linkowych, UI |
| **C-54** spójność artefaktów | ✅ jedna korekta w górę łańcucha: dwa pola łączące przestrzeń ze źródłem dopisane do `spec.md` §8 z uzasadnieniem |

---

## Regresje

**Znaleziona i naprawiona — jedyna rzecz w tym przebiegu, która mogła zaszkodzić produkcji.**
Migracja 0226 w pierwszej wersji zawierała **pięć instrukcji, których nikt nie zamawiał**:
`DROP INDEX "Note_title_trgm_idx"`, `DROP INDEX "Note_content_trgm_idx"` oraz trzy
`ALTER COLUMN "updatedAt" DROP DEFAULT` na niezwiązanych tabelach. Powstały, bo DDL wygenerowałem
przez `prisma migrate diff --to-schema-datamodel` i **dopisałem wyjście bez przeczytania** — a diff
proponuje doprowadzenie bazy do schematu, więc wszystko, co żyje wyłącznie w surowym SQL-u (czyli
dokładnie zawartość `schema-drift-allowed.json`), chce skasować. Skutek na produkcji byłby cichy:
wyszukiwanie notatek spada z indeksu GIN na skan sekwencyjny.

**Jak wyszło i czego się nauczyłem o własnej diagnozie:** dwa testy `notesFts.integration` zrobiły
się czerwone. Najpierw wziąłem to za stan lokalnej bazy i **odtworzyłem indeksy ręcznie** — po czym
przy następnym `migrate deploy` zniknęły znowu. Sprawcę pokazał `grep "DROP INDEX" prisma/`: moja
własna migracja. To jest zapisane w `doświadczenia.md`, bo naprawa objawu ukryła defekt na jeden cykl.

**Weryfikacja po naprawie** — pełny cykl od zera (`DROP TABLE` czterech tabel + usunięcie wpisu
z `_prisma_migrations` + `migrate deploy`):

```
indeksy trigramowe przed migracją: 2
Applying migration `0226_workspaces_and_grants`
indeksy trigramowe PO migracji: 2   ← przeżywają
użytkownicy 4 = przestrzenie osobiste 4 | zespoły 1 = zespołowe 1
```

`test:unit` po naprawie: **666/666** (wcześniej 664/666 — te dwa czerwone to był właśnie ten defekt,
a nie środowisko).

**Pozostałe obszary bez regresji:** zero zmian w widokach i trasach (AC-9), guardy dostępu
nietknięte (funkcje lustra świadomie ich nie mają — są wołane z akcji, które już sprawdziły
uprawnienie, oraz ze zdarzenia tworzenia konta, gdzie sesji jeszcze nie ma), model współwłasności
bez zmian, liczniki asystenta bez ruchu.

**Klikacze:** nieuruchamiane — decyzja właściciela z 2026-08-11. Dla przebiegu, który z założenia
nie zmienia niczego widocznego, maszynowy dowód z AC-9 (zero plików w `src/app` i `src/components`)
jest zresztą ostrzejszy niż klikacz sprawdzający, czy strona się renderuje.

---

## Werdykt końcowy

## **GOTOWE**

Jedenaście na jedenaście kryteriów akceptacji spełnione, komplet bramek zielony, cztery liczniki bez
ruchu. Faza 2 przebudowy jest otwarta: fundament współdzielenia istnieje **i jest wypełniony
danymi**, a niezmiennik trzyma się także dla danych powstających po wdrożeniu.

**Dwie rzeczy warte uwagi recenzji, obie odnotowane, żadna blokująca:**
1. **Weryfikacja wykryła defekt w migracji** (skasowanie indeksów trigramowych) i wróciła do
   implementacji zamiast go obejść. Wyszedł dzięki naprawie bramki `check:schema-drift`, która
   wcześniej **pomijała kontrolę** w środowisku bez uprawnienia `CREATEDB`.
2. **`ResourceGrant` i `ResourceInvitation` nie mają konsumenta** do zadań 10/12 — świadome
   odstępstwo od C-35 z zapisaną ceną, powtórzone w dzienniku i w `CLAUDE.md`, żeby nikt nie usunął
   ich „w ramach porządków".
