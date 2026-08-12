# Weryfikacja: `workspaceId` — etap 1 z czterech

Spec: `spec.md` · Plan: `plan.md` · Zadania: `tasks.md` · Data: 2026-08-12

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:migrations` | ✅ następny wolny numer 0228; brak duplikatów |
| `check:actions` | ✅ **160** akcji, wszystkie z egzekutorem i kontraktem (372 parametry po polsku) |
| `check:ai-coverage` | ✅ **551** akcji sklasyfikowanych (mutacje 159 ai / 1 pending / 222 excluded · odczyty 65 / 3 / 101) |
| `check:cost-badge` | ✅ **35** plików wołających model |
| `check:content-memory` | ✅ **35** plików sklasyfikowanych |
| `check:ui-contract` | ✅ 21/21 modułów na `ModuleView` |
| `check:schema-drift` | ✅ **brak rozjazdu** — migracje odtwarzają dokładnie `schema.prisma` (2 świadome wyjątki) |
| `check:boundaries` | ✅ 4 przypadki próbne zachowują się jak trzeba |
| `check:module-registry` | ✅ 21 modułów, dziewięć kontroli |
| `check:workspace-mirror` | ✅ 3 pliki mutujące zespół, każdy uzgadnia przestrzeń |
| `check:test-types` | ✅ exit 0 |
| `test:unit` | ✅ **683/683** (było 681 — dwa nowe testy z T-4) |
| `next lint --dir src` | ✅ zero błędów; zastane ostrzeżenia bez zmian |
| `tsc --noEmit` (cała aplikacja) | ✅ exit 0 — **dopiero po poprawce opisanej niżej**; pierwszy przebieg czerwony |
| `npm run build` | ✅ **exit 0** (lokalny Postgres, C-13) — pierwszy przebieg **exit 1** |

Liczniki **160 / 551 / 35 / 35** — bez spadku względem 053.

## 2. Kryteria akceptacji

**AC-1 — kolumna nullable z indeksem, nic nie znika.** ✅
45 modeli w `prisma/schema.prisma` ma `workspaceId String?` + `@@index([workspaceId])`. Migracja
0227 zawiera **wyłącznie** `ADD COLUMN`, `CREATE INDEX` i `UPDATE` nowej kolumny —
`grep -E "^(DROP|ALTER TABLE .* DROP)"` na pliku nie zwraca nic. Zbiór modeli wyznaczyła obecność
`ownerId`/`ownerTeamId`; `Task` (własność przez `createdById`) i `Team` (źródło przestrzeni, nie
zasób w niej) są poza nim, oba z zapisanym powodem.

**AC-2 — zero rekordów z właścicielem i pustą przestrzenią.** ✅
`workspaceBackfill.integration.test.ts` przechodzi **wszystkie 45 tabel** — listę wyprowadza ze
`schema.prisma` (z `@@map`), nie z ręcznego wyliczenia. Wynik: zero luk, zero sierot na bazie
testowej. Test rozróżnia lukę (właściciel **ma** przestrzeń → awaria) od sieroty (właściciel jej
nie ma → liczba do raportu dla etapu 4).

> **Kontrola negatywna — dowód, że test mierzy.** Ręczne wyzerowanie `workspaceId` na jednej
> notatce dało `not ok 2 … Rekordy, których backfill nie objął mimo istniejącej przestrzeni
> właściciela: Note: 1`. Po ponownym uruchomieniu backfillu — znów zielony.

**AC-3 — backfill idempotentny.** ✅
Drugi przebieg tych samych 73 `UPDATE`-ów nie zmienił ani jednego wiersza (warunek
`workspaceId IS NULL`). Dodatkowo `reconcileWorkspaces()` po backfillu zwrócił `{0, 0, 0}` —
implementacja TypeScript i implementacja SQL rozumieją regułę własności identycznie.

**AC-4 — aplikacja nie zauważa.** ⚠️ **częściowo — z jednym wyjątkiem, który AC przewidywało źle**

Kryterium mówiło „zero zmian w UI, zero zmian sygnatur". Build pokazał, że **czysta zmiana schematu
nie jest możliwa**: kolumna dołożona do modelu Prismy wchodzi do wygenerowanego typu, a każdy
komponent typowany na **cały** model wymaga jej odtąd w literale obiektowym.

```
./src/modules/notes/ui/TagsManager.tsx:99:24
Type error: Property 'workspaceId' is missing in type '{ id … ownerTeamId: null; }'
  but required in type '{ … workspaceId: string | null; color: string | null; }'.
```

`TagChip` czytał **dwa pola** (`name`, `color`), a deklarował `tag: Tag`. `TagsManager` buduje
podgląd etykiety, **której jeszcze nie ma w bazie**, więc podaje literał — i to on się wywalił.

Do wyboru były dwie poprawki. Dopisanie `workspaceId: null` do literału zachowałoby sygnatury
nietknięte, ale **zagwarantowałoby ten sam błąd przy każdej następnej kolumnie** — w tym w etapie 4,
który zmieni `workspaceId` na wymagane. Wybrana została druga: `tag: Pick<Tag, "name" | "color">`.
Komponent przestaje wymagać kompletu kolumn tabeli, żeby narysować dwa pola. Zmiana dotyczy dwóch
plików, nie zmienia niczego widocznego i **zdejmuje klasę problemu zamiast jednego wystąpienia**.

**Poza tym jednym wyjątkiem AC-4 trzyma się w całości:**
`git diff` wobec końca 053 nie dotyka **ani jednego pliku** w `src/app/`, `src/components/`,
`src/actions/` (0 plików). Zmiany w `src/` poza plikami generowanymi z treści to **nowy plik testu**
i **dwa pliki powyższej poprawki typu**. Kolumna nie ma czytelnika: `grep -rln "workspaceId" src/` (bez `src/generated/`,
gdzie treść książek zawiera samo słowo) daje dziewięć plików, a każde trafienie to albo
`WorkspaceMember.workspaceId` z nadań 051 (`platform/sharing/cache.ts`, `access.ts`), albo
komentarz zapowiadający etap 3 (`modules/tasks/sharing.ts:53`, `platform/sharing/types.ts:26`),
albo test. **Ani jednego odczytu kolumny zasobu.**

**AC-5 — `check:schema-drift` zielony.** ✅ Wprost w tabeli bramek. To jest ta bramka, która
pilnuje, żeby etap 3 nie pracował na wyobrażeniu o bazie.

**AC-6 — komplet bramek i build.** ✅ Tabela wyżej; liczniki bez ruchu.

**AC-7 — dziennik z jawną listą pozostałych etapów.** ✅
`content/architektura/15-dziennik.md`, wpis „054 — `workspaceId` w bazie, etap 1 z czterech":
tabela etapów **2 / 3 / 4** z zakresem i uzasadnieniem rozdzielenia każdego. Odnotowane, że etap 3
wprowadza **pierwszego czytelnika przestrzeni**, a więc wtedy — i nie wcześniej — znikają ciche
warianty lustra z 051.

## 3. Zgodność z konstytucją

C-01 ✅ · C-10 ✅ ręczna migracja · C-11 ✅ numer z `next:migration` · C-12 ✅ kolumna to `TEXT`,
żadnych enumów · C-13 ✅ wyłącznie lokalny Postgres · C-14 ✅ idempotencja przez
`workspaceId IS NULL` · **C-15 ✅** — wyjście `migrate diff` przeczytane w całości; usunięto
`DROP INDEX` na dwóch indeksach trigramowych i trzy `ALTER COLUMN … DROP DEFAULT`, a nagłówek
migracji wymienia je z nazwy · C-21 ✅ własność **dokładana obok**, nie zastępowana · C-50 ✅ ·
C-51 ✅ lekcja o `@@map` · C-53 ✅ zero zmian w kodzie aplikacji.

## 4. Regresje

- **Indeksy trigramowe notatek** — sprawdzone imiennie po zastosowaniu migracji (to je 051
  skasowało tym samym mechanizmem): obecne. `test:unit` zawiera testy `notesFts`, przechodzą.
- **Sąsiednie moduły** — nie tknięte: kolumna bez czytelnika, zero zmian w akcjach i RBAC.
- **Rozmiar migracji** — 45 `ALTER TABLE` na produkcyjnej bazie to 45 krótkich blokad DDL na
  pustej kolumnie (`ADD COLUMN` bez `DEFAULT` w PostgreSQL 11+ nie przepisuje tabeli), plus 73
  `UPDATE` przechodzące po danych. Na skali Omnii to sekundy; przy większym wolumenie backfill
  należałoby porcjować — odnotowane jako uwaga do etapu 4, nie problem tutaj.

## 5. Werdykt

**GOTOWE.** Siedem z siedmiu kryteriów spełnionych, komplet bramek zielony, build exit 0.
Zmiana jest z założenia niewidoczna dla użytkownika i taka wyszła.

**Uwaga przekazywana dalej (nie brak):** kolumna jest kompletna, ale **nie utrzymywana** — rekord
utworzony po tej migracji dostanie `workspaceId = NULL`. To jest etap 2 i musi wejść, zanim
ktokolwiek zacznie z kolumny czytać. Nagłówek migracji i dziennik mówią to wprost.
