# Plan techniczny: Przestrzenie i nadania — fundament danych pod współdzielenie

- **Spec:** ./spec.md (051-przestrzenie-i-nadania)
- **Status:** draft
- **Data:** 2026-08-12

> **Zasada planu:** to jest **JAK**.

## 1. Podejście

Cztery modele z rozdz. 8.3 trafiają do `schema.prisma` i do **jednej** ręcznej migracji, która
w tym samym pliku **wypełnia je danymi** — bo seed nie odpala się po wdrożeniu, więc backfill
zostawiony w skrypcie nie zadziałałby nigdy. Utrzymanie lustra w przód dostaje **jeden moduł
platformowy** (`src/platform/workspaces/`) wołany z dwóch — i tylko dwóch — plików, które w całej
aplikacji mutują zespoły. Wzorzec do naśladowania to **`src/platform/trash/`**: zdolność platformy
bez wiedzy o modułach, z cienkim API wołanym z warstwy akcji.

Kluczowa decyzja projektowa: **funkcja uzgadniająca JEST detektorem rozjazdu.** `reconcileWorkspaces`
zwraca liczbę wprowadzonych zmian, więc „zero zmian przy drugim uruchomieniu" to jednocześnie dowód
idempotencji (AC-5) i test rozjazdu (AC-8) — bez drugiego API, które trzeba by trzymać w zgodzie
z pierwszym.

## 2. Model danych (Prisma)

### Nowe modele

- **`Workspace`** — `id`, `kind` (`String`: `"personal" | "team"` — unia TS, **nie enum**, C-12),
  `name`, `personalUserId` (`String?`, **unikalne**), `teamId` (`String?`, **unikalne**),
  `createdAt`. Relacje: `members`, `grants`, `personalUser`, `team`.
- **`WorkspaceMember`** — `workspaceId`, `userId`, `role` (`String`:
  `"owner" | "admin" | "member" | "guest"`), `createdAt`; `@@id([workspaceId, userId])`,
  `@@index([userId])`.
- **`ResourceGrant`** — wg rozdz. 8.3: `workspaceId`, `resourceType`, `resourceId`, `subjectType`,
  `subjectId?`, `role`, `inherited`, `expiresAt?`, `createdById`, `createdAt`;
  `@@unique([resourceType, resourceId, subjectType, subjectId])`,
  `@@index([subjectType, subjectId])`, `@@index([resourceType, resourceId])`, `@@index([workspaceId])`.
- **`ResourceInvitation`** — `resourceType`, `resourceId`, `email`, `role`, `token` (unikalny),
  `expiresAt`, `acceptedAt?`, `createdById`, `@@index([email])`.

### Dwa pola, których nie ma w szkicu z rozdz. 8.3 — i dlaczego są konieczne

`personalUserId` i `teamId` na `Workspace` to **doprecyzowanie kształtu, nie zmiana pomysłu**.
Szkic w dokumencie nie mówi, **czym przestrzeń jest połączona ze swoim źródłem**, a bez tego:
- nie da się napisać **idempotentnego** backfillu (AC-5) — nie ma na czym oprzeć `ON CONFLICT`;
- nie da się utrzymać lustra (AC-7) — przy zmianie składu zespołu nie ma jak odnaleźć jego przestrzeni;
- „dokładnie jedna przestrzeń osobista na użytkownika" (AC-3) pozostaje obietnicą, a nie
  **więzem bazy**.

Oba są `String?` **unikalne**: w PostgreSQL wartości `NULL` są w indeksie unikalnym traktowane jako
różne, więc dowolnie wiele przestrzeni zespołowych może mieć `personalUserId = NULL` i odwrotnie.
Jeden indeks daje więc dwa niezmienniki naraz. **Odnotowane w `spec.md` §8 (C-54).**

Relacje z `onDelete: Cascade` w obie strony (`User` → przestrzeń osobista, `Team` → przestrzeń
zespołowa) **załatwiają usuwanie bez ani jednej linijki kodu aplikacji** — kasowanie konta lub
zespołu sprząta lustro samo. To jedyny fragment lustra, którego nie trzeba pilnować bramką.

### Znane ograniczenie, świadomie odroczone

`@@unique([resourceType, resourceId, subjectType, subjectId])` **nie zadziała dla nadań linkowych**
(`subjectType: "link"`, `subjectId: NULL`) — z tego samego powodu, dla którego działa sztuczka
wyżej: w PostgreSQL `NULL != NULL`, więc dwa nadania linkowe do tego samego zasobu przejdą.
Poprawka to częściowy indeks pisany surowym SQL-em plus wpis w `schema-drift-allowed.json`.
**Nie robimy jej teraz:** tabela nie ma konsumenta, a przy zadaniu 12 (gdy nadania zaczną powstawać)
będzie wiadomo, czy nadania linkowe w ogóle wchodzą w pierwszej odsłonie. Zapisane w planie i w
dzienniku, żeby nie odkryć tego przypadkiem.

### Migracja (C-10, C-11)

- Numer z `npm run next:migration`: **0226**
- Katalog: `prisma/migrations/0226_workspaces_and_grants/migration.sql`
- Zawartość, w tej kolejności:
  1. `CREATE TABLE` × 4 + indeksy + klucze obce (`ON DELETE CASCADE` dla `personalUserId`,
     `teamId`, `workspaceId`).
  2. **Backfill zespołów** (rozdz. 8.10 krok 1): `INSERT … SELECT` z `Team`,
     `ON CONFLICT ("teamId") DO NOTHING`; `id` przez `gen_random_uuid()::text` (C-14).
  3. **Backfill członków**: z `TeamMember`, mapowanie ról `OWNER→owner`, `ADMIN→admin`,
     pozostałe `→member`; `ON CONFLICT DO NOTHING`.
  4. **Właściciel zespołu** osobnym `INSERT … ON CONFLICT ("workspaceId","userId") DO UPDATE SET
     role = 'owner'` — **po** kroku 3, żeby wygrał z ewentualnym wierszem `member`. To pokrywa
     AC-4: właściciel bez wiersza `TeamMember` też trafia do przestrzeni.
  5. **Backfill przestrzeni osobistych** (krok 2): z `User`, nazwa `'Moja przestrzeń'` (C-32),
     `ON CONFLICT ("personalUserId") DO NOTHING`, plus wiersz członkostwa z rolą `owner`.

Wszystkie pięć kroków to wyłącznie **dokładanie wierszy do nowych tabel** — żaden istniejący wiersz
nie jest czytany do zapisu ani kasowany.

## 3. Warstwa serwera (Server Actions — C-20)

**Nie powstaje żadna nowa Server Action** i żadna istniejąca nie zmienia sygnatury ani wyniku —
to wynika wprost z AC-9 („zero zmian widocznych"). Zmiana polega na **dopięciu lustra** wewnątrz
istniejących akcji, za `revalidatePath`, który zostaje tam, gdzie był.

Nowa zdolność platformy — `src/platform/workspaces/`:

- `types.ts` — `WorkspaceKind`, `WorkspaceMemberRole`, `ResourceRole`, `GrantSubjectType`
  (`String` + unie TS) oraz `RESOURCE_ROLE_ORDER` jako **sam słownik** z porównaniem rang; zero
  logiki egzekwowania (to zadanie 10).
- `sync.ts`:
  - `ensurePersonalWorkspace(userId)` — tworzy przestrzeń osobistą + członkostwo `owner`; idempotentne.
  - `syncTeamWorkspace(teamId)` — uzgadnia przestrzeń zespołu: nazwę, skład i role (łącznie
    z właścicielem). Idempotentne.
  - `reconcileWorkspaces(zakres?)` → `{ utworzone, zaktualizowane, usuniete }` — uzgadnia
    wskazanych użytkowników/zespoły (albo wszystkich) i **zwraca liczbę zmian**. To jest zarazem
    detektor rozjazdu.

Guard dostępu (C-21): funkcje lustra **nie mają własnych guardów i nie mogą ich mieć** — są wołane
z akcji, które już sprawdziły uprawnienie (`requireTeamRole`), oraz ze zdarzenia tworzenia konta,
gdzie sesji jeszcze nie ma. Guard w środku byłby albo martwy, albo blokowałby tworzenie konta.
Odpowiedzialność za dostęp zostaje w wołającym — tak samo jak w `platform/trash`.

Punkty wpięcia (wszystkie istniejące):
| Plik | Miejsce | Wywołanie |
|---|---|---|
| `src/platform/auth/session.ts` | zdarzenie `createUser` | `ensurePersonalWorkspace` |
| `src/actions/teams.ts` | `createTeam`, `createSubTeam`, `updateTeam`, `changeMemberRole`, `removeMember`, `leaveTeam`, `transferTeamOwnership` | `syncTeamWorkspace` |
| `src/actions/invitations.ts` | przyjęcie zaproszenia (dodanie członka) | `syncTeamWorkspace` |

`deleteTeam` **nie dostaje wywołania** — kasowanie robi kaskada klucza obcego.

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Zero nowych slugów, zero wpięć w `permissions.ts` / `modules.tsx` / `ModuleSidebar`.
Role przestrzeni i role zasobu to inny wymiar niż uprawnienia modułowe; połączenie ich to zadanie 10.

## 5. UI (C-30, C-31, C-32)

**Brak UI.** Żadnej nowej trasy, komponentu ani zmiany w istniejących — AC-9 tego zabrania.
Teksty, które trafiają do bazy (nazwa przestrzeni osobistej: `Moja przestrzeń`), są po polsku (C-32).

## 6. AI / integracje

**Nie dotyczy.** Zero nowych `AIAction`, read-tooli, wpięć w kalendarz, powiadomienia i kosz.
Liczniki `check:actions` / `check:ai-coverage` nie mogą się ruszyć — jeśli się ruszą, coś poszło nie tak.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | cztery modele + trzy relacje zwrotne (`User`, `Team`) |
| `prisma/migrations/0226_workspaces_and_grants/migration.sql` | nowy | DDL + backfill idempotentny |
| `src/platform/workspaces/types.ts` | nowy | słowniki ról i rodzajów (`String` + unia) |
| `src/platform/workspaces/sync.ts` | nowy | lustro w przód + uzgadnianie/detekcja rozjazdu |
| `src/platform/auth/session.ts` | edycja | przestrzeń osobista przy zakładaniu konta |
| `src/actions/teams.ts` | edycja | uzgodnienie przestrzeni po zmianie zespołu (7 miejsc) |
| `src/actions/invitations.ts` | edycja | uzgodnienie po przyjęciu zaproszenia |
| `scripts/check-workspace-mirror.js` | nowy | bramka: kto mutuje zespół, uzgadnia przestrzeń |
| `package.json` | edycja | `check:workspace-mirror` + wpięcie w `build` |
| `src/platform/workspaces/__tests__/workspaceMirror.integration.test.ts` | nowy | AC-3..AC-8 |
| `content/architektura/15-dziennik.md` | edycja | otwarcie Fazy 2, zadanie 9 |
| `CLAUDE.md`, `.claude/spec-pipeline/constitution.md` | edycja | nowe modele + reguła lustra |

## 8. Bramki i weryfikacja (C-50)

Lokalnie: Postgres `worldofmag_e2e`, `npx prisma migrate deploy`, **nigdy prod** (C-13). Backfill
sprawdzamy na bazie **z danymi** (fixture: użytkownicy + zespoły z członkami i właścicielem spoza
listy członków), nie na pustej — pusty wynik zgadza się z pustym (lekcja z 049/050).

Nowa bramka `check:workspace-mirror` — wzorzec `check-cost-badge.js`: plik mutujący `Team`
/`TeamMember` musi importować `@/platform/workspaces/sync` **albo** mieć uzasadniony wyjątek
w manifeście. Dziś takich plików są dokładnie dwa; bramka pilnuje trzeciego, który kiedyś powstanie.

| AC | Sposób weryfikacji |
|---|---|
| AC-1 | `npm run check:schema-drift` (zielony = brak rozjazdu schemat ↔ migracje) |
| AC-2 | `grep "enum " prisma/schema.prisma` bez trafień w nowych modelach + typy w `types.ts` |
| AC-3 | test: fixture → `reconcileWorkspaces` → zliczenie przestrzeni per użytkownik/zespół |
| AC-4 | test: zespół z właścicielem **bez** wiersza `TeamMember` → właściciel jest w przestrzeni z rolą `owner` |
| AC-5 | `migrate deploy` na bazie z danymi → ręczne powtórzenie sekcji backfillu → brak duplikatów; test: drugie `reconcileWorkspaces` zwraca zero zmian |
| AC-6 | test: `ensurePersonalWorkspace` na świeżym użytkowniku; przegląd wpięcia w `createUser` |
| AC-7 | test: zmiana składu/roli/nazwy → uzgodnienie odwzorowuje stan; usunięcie zespołu → kaskada |
| AC-8 | **test negatywny**: usunięcie wiersza członkostwa z przestrzeni → `reconcileWorkspaces` zwraca ≠ 0 |
| AC-9 | `next build` + brak zmian w `src/app` i `src/components`; liczniki bez ruchu |
| AC-10 | komplet bramek + `test:unit` |
| AC-11 | przegląd `15-dziennik.md` |

## 9. Ryzyka techniczne i plan wycofania

- **Backfill dotyka wszystkich kont** → tylko `INSERT` do nowych tabel. **Rollback kodu nie wymaga
  rollbacku migracji**: nowe tabele nikogo nie obchodzą, dopóki nic ich nie czyta.
- **Właściciel zespołu bez wiersza członkostwa** → osobny krok 4 backfillu i osobny przypadek
  testowy (AC-4). To najbardziej prawdopodobny cichy błąd tego przebiegu.
- **Test globalnego niezmiennika zderzyłby się ze śmieciami po innych testach** — inne testy
  integracyjne tworzą użytkowników wprost przez Prismę, więc asercja „każdy użytkownik w bazie ma
  przestrzeń" byłaby czerwona z powodów niezwiązanych ze zmianą. Dlatego test operuje na **własnym
  fixture**, a globalny niezmiennik zapewnia migracja plus bramka na przyszłe punkty mutacji.
- **Kaskada przy usuwaniu konta/zespołu** → sprawdzić testem, że usunięcie zespołu faktycznie
  usuwa przestrzeń; `Team.ownerId` ma `onDelete: Restrict`, więc kolejność kasowania jest istotna.
- **Pokusa zakresu** (skoro są przestrzenie, dołóżmy `workspaceId`…) → granica z `spec.md` §5.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczna migracja 0226, numer z `next:migration`, backfill idempotentny
      (`ON CONFLICT`, `gen_random_uuid()::text`), zero enumów Prisma, weryfikacja na lokalnym Postgresie
- [x] **C-20..C-25** — zero nowych akcji; `revalidatePath` bez zmian; guard zostaje w wołającym
      (uzasadnione); RBAC nietknięty; kosz i audyt nie dotyczą
- [x] **C-30..C-32** — brak UI; jedyny tekst trafiający do bazy po polsku
- [x] **C-36** — nowa zdolność w `src/platform/`, bez wiedzy o modułach; rodzaje zasobów w nadaniach
      są tekstem, nie odwołaniem do modułu
- [x] **C-53** — minimalizm sprawdzony świadomie: **nie** dokładamy `workspaceId` do modeli, **nie**
      piszemy `requireAccess`, **nie** naprawiamy indeksu nadań linkowych (odroczone z powodem),
      **nie** budujemy UI. Jedyny nowy mechanizm to bramka lustra — uzasadniona tym, że dwa źródła
      prawdy przez okres przejściowy rozjeżdżają się po cichu.
