# Zadania: Przestrzenie i nadania — fundament danych pod współdzielenie

- **Plan:** ./plan.md (051-przestrzenie-i-nadania)
- **Status:** todo
- **Data:** 2026-08-12

> **Zasada nadrzędna tego przebiegu:** **niewidzialność jest kryterium jakości.** Każde zadanie musi
> dać się zamknąć zdaniem „użytkownik nie zauważy niczego". Pierwsze zadanie, po którym coś w UI
> wygląda inaczej, jest błędem, a nie postępem.
>
> **Backfill sprawdzamy na bazie Z DANYMI, nigdy na pustej.** Pusty wynik zgadza się z pustym nawet
> wtedy, gdy migracja gubi połowę przypadków — lekcja z 049 i 050, tu obowiązuje wprost, bo cały
> dowód tego przebiegu to zawartość czterech nowych tabel.
>
> **PUSH PO KAŻDYM ZADANIU.** Pierwsze podejście do tego przebiegu przepadło razem z kontenerem:
> siedem zadań istniało wyłącznie w lokalnych commitach. Praca niewypchnięta nie istnieje.
>
> **Rytuał po każdym zadaniu:** `tsc --noEmit` · `check:actions` (**160**) · `check:ai-coverage`
> (**551**) · `check:cost-badge` (**35**) · `check:content-memory` (**35**) · `check:schema-drift` ·
> `next lint --dir src` · commit · **push**. Cztery liczniki **nie mają prawa się ruszyć** — ten
> przebieg nie dotyka asystenta, więc każdy ruch oznacza, że zrobiliśmy coś spoza zakresu.
>
> **NIGDY `next build` ani `next dev` równolegle z klikaczami** (`ps aux | grep playwright`).
> **NIGDY builda ani `migrate.js` przeciw produkcyjnej bazie (C-13)** — tu szczególnie, bo backfill
> dotyka wszystkich kont.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

---

## Faza A — Fundament danych

- [ ] **T-1** — **Cztery modele w `schema.prisma` + DDL migracji 0226.**
      Kształt wg planu §2: `Workspace` (z `personalUserId` i `teamId`, oba `String?` **unikalne**),
      `WorkspaceMember`, `ResourceGrant`, `ResourceInvitation` + relacje zwrotne w `User` i `Team`
      z `onDelete: Cascade`. Rodzaje i role jako `String` — **zero enumów Prisma (C-12)**.
      **Gotowe, gdy:** `npx prisma migrate deploy` przechodzi, `npm run check:schema-drift`
      **zielony** (to jest dowód na AC-1), `npm run check:migrations` zielony. **(AC-1, AC-2)**
- [ ] **T-2** — **Backfill w tej samej migracji + weryfikacja na bazie Z DANYMI.**
      Pięć kroków wg planu §2: przestrzenie zespołów → członkowie z mapowaniem ról → **właściciel
      zespołu osobnym `INSERT … DO UPDATE`** → przestrzenie osobiste → członkostwa osobiste.
      Wszystko `ON CONFLICT`, `gen_random_uuid()::text` (C-14).
      Do weryfikacji potrzebny fixture z przypadkiem brzegowym: **zespół, którego właściciel NIE ma
      wiersza `TeamMember`** — to najbardziej prawdopodobny cichy błąd tego przebiegu.
      **Gotowe, gdy:** na bazie z danymi liczba przestrzeni = liczba użytkowników + liczba zespołów,
      skład każdej przestrzeni zespołowej zgadza się ze składem zespołu **wraz z właścicielem**,
      a **powtórne** wykonanie sekcji backfillu nie zmienia ani jednego wiersza. **(AC-3, AC-4, AC-5)**

## Faza B — Lustro w przód

- [ ] **T-3** `[P]` — **Słowniki w `src/platform/workspaces/types.ts`.**
      `WorkspaceKind`, `WorkspaceMemberRole`, `ResourceRole`, `GrantSubjectType` + kolejność rang ról
      zasobu (`viewer` < `commenter` < `editor` < `manager`). **Sam słownik — zero egzekwowania**,
      bo to zadanie 10.
      **Gotowe, gdy:** typy istnieją, `tsc` czysty, nic ich jeszcze nie używa. **(AC-2)**
- [ ] **T-4** — **`src/platform/workspaces/sync.ts` — lustro i detektor rozjazdu w jednym.**
      `ensurePersonalWorkspace(userId)`, `syncTeamWorkspace(teamId)`,
      `reconcileWorkspaces(zakres?) → { utworzone, zaktualizowane, usuniete }`.
      **Uzgadnianie JEST detekcją rozjazdu** — „druga próba zwraca zero zmian" to jednocześnie
      dowód idempotencji i test niezmiennika. Bez guardów w środku (uzasadnienie w planie §3:
      wołane też ze zdarzenia tworzenia konta, gdzie sesji jeszcze nie ma).
      **Gotowe, gdy:** `tsc` czysty; `reconcileWorkspaces()` na bazie **po backfillu SQL** zwraca
      **zero zmian** — czyli TypeScript i SQL interpretują tę samą regułę identycznie. **(AC-6, AC-7)**
- [ ] **T-5** — **Wpięcie w trzy istniejące miejsca.**
      `session.ts` (zdarzenie `createUser`) → przestrzeń osobista; `actions/teams.ts` (siedem
      mutacji) i `actions/invitations.ts` (przyjęcie zaproszenia) → uzgodnienie przestrzeni.
      `deleteTeam` **świadomie bez wywołania** — sprząta kaskada klucza obcego.
      **Gotowe, gdy:** żadna sygnatura akcji się nie zmieniła, `revalidatePath` zostały tam, gdzie
      były, `tsc` i lint czyste. **(AC-6, AC-7)**

## Faza C — Dowód

> Kolejność jest tu istotna: **najpierw test, potem bramka.** Test sprawdza, czy lustro działa;
> bramka — czy ktoś w przyszłości go nie ominie. Odwrotna kolejność dałaby bramkę pilnującą
> mechanizmu, o którym jeszcze nie wiadomo, czy jest poprawny.

- [ ] **T-6** — **Test integracyjny `workspaceMirror.integration.test.ts`.**
      Wzorzec: `accessibleTeamIds.integration.test.ts` (DB-gated przez `HAS_DB`, własny fixture,
      `concurrency: false`). Przypadki: przestrzeń zespołu · **właściciel spoza listy członków**
      (AC-4) · idempotencja · przestrzeń osobista dokładnie jedna · zmiana nazwy · awans członka ·
      usunięcie członka · **TEST NEGATYWNY: podłożony rozjazd → uzgodnienie zwraca ≠ 0** ·
      kaskadowe usunięcie przestrzeni z zespołem.
      **Test operuje na własnym fixture, nie na całej bazie** — inne testy integracyjne tworzą
      użytkowników wprost przez Prismę, więc globalna asercja byłaby czerwona z cudzych powodów
      (plan §9).
      **Gotowe, gdy:** `npm run test:unit` zielony, a test **naprawdę widziany na czerwono** po
      podłożeniu awarii w lustrze. **(AC-3, AC-4, AC-5, AC-6, AC-7, AC-8)**
- [ ] **T-7** — **Bramka `check:workspace-mirror` + wpięcie w `build`.**
      Wzorzec `check-cost-badge.js`: plik mutujący `Team`/`TeamMember` musi importować
      `@/platform/workspaces/sync` albo mieć **uzasadniony** wyjątek w manifeście. Bramka odrzuca
      też wpisy **martwe** — wyjątek bez powodu z czasem staje się furtką.
      **Gotowe, gdy:** stan czysty → zielona; podłożona mutacja zespołu w pliku bez importu →
      **czerwona**; martwy wyjątek → **czerwona**; po cofnięciu → zielona. **(AC-8)**

## Faza D — Domknięcie

- [ ] **T-8** — **Bramki końcowe:** komplet + `test:unit` + `next build` przeciw **lokalnemu**
      Postgresowi (C-13).
      **Gotowe, gdy:** wszystko zielone, cztery liczniki **bez ruchu** (160/551/35/35), a
      `git diff --stat` **nie pokazuje ani jednego pliku** w `src/app/` i `src/components/` — to
      jest maszynowy dowód na AC-9. **(AC-9, AC-10)**
- [ ] **T-9** — **Dokumentacja otwarcia Fazy 2:** `CLAUDE.md` (cztery nowe modele w sekcji schematu),
      `constitution.md` (reguła: kto mutuje zespół, uzgadnia przestrzeń), rozdz. 15 dziennika —
      **Faza 2 otwarta, zadanie 9 zrobione**, następny krok = zadanie 10, wraz z **dwiema rzeczami
      świadomie zostawionymi**: tabele nadań bez konsumenta i unikalność nadań linkowych.
      Wpis do `doświadczenia.md` (C-51). **(AC-11)**

---

## Mapowanie kryteriów akceptacji

| AC | Zadania |
|---|---|
| AC-1 — schemat zgodny z migracjami | T-1 |
| AC-2 — `String` + unia, zero enumów | T-1, T-3 |
| AC-3 — każdy użytkownik i zespół ma przestrzeń | T-2, T-6 |
| AC-4 — właściciel zespołu w przestrzeni, także bez wiersza członkostwa | T-2, T-6 |
| AC-5 — backfill idempotentny | T-2, T-6 |
| AC-6 — nowe konto dostaje przestrzeń | T-4, T-5, T-6 |
| AC-7 — zmiany zespołu przechodzą do lustra | T-4, T-5, T-6 |
| AC-8 — rozjazd jest wykrywany (test negatywny) | T-6, T-7 |
| AC-9 — zero zmian widocznych | T-8 |
| AC-10 — bramki i build | T-8 |
| AC-11 — dziennik | T-9 |

## Ścieżka krytyczna

```
T-1 → T-2                    ← fundament + dowód, że backfill działa na danych
        ↓
T-3 → T-4 → T-5              ← lustro w przód
        ↓
T-6 → T-7                    ← najpierw test poprawności, potem bramka na przyszłość
        ↓
T-8 → T-9
```

**Co blokuje co:**
- **T-1 blokuje wszystko** — bez tabel nie ma czego wypełniać ani czym lustrzyć.
- **T-2 blokuje T-4**: funkcja uzgadniająca musi dawać **ten sam** wynik co backfill z migracji.
  Napisana wcześniej, byłaby drugą interpretacją tej samej reguły — a dwie interpretacje rozjeżdżają
  się dokładnie tak, jak dwa źródła prawdy.
- **T-6 przed T-7** — bramka pilnująca niesprawdzonego mechanizmu utrwala błąd.
- **T-3 jest jedynym `[P]`** — słowniki nie zależą od niczego poza sobą.

## Notatki / blokady

- **Poza zakresem tego przebiegu** (spec §5): `requireAccess` i cała reszta zadania 10, `workspaceId`
  na 46 modelach (zadanie 11 — rozdz. 8.10 nazywa je najbardziej ryzykownym krokiem przebudowy),
  przeniesienie `TaskProjectMember`/`TaskShare`/`PetShare` (zadanie 12), UI udostępniania.
- **Znane ograniczenie, odroczone z powodem** (plan §2): unikalność nadań linkowych nie zadziała,
  bo w PostgreSQL `NULL != NULL`. Tabela nie ma konsumenta do zadania 12; poprawka wymaga częściowego
  indeksu w surowym SQL-u i wpisu w `schema-drift-allowed.json`. Ma trafić do dziennika (T-9), żeby
  nie zostało odkryte przypadkiem.
