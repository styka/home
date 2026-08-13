# Plan techniczny: rozstrzyganie dostępu czyta przestrzeń — etap 3A

- **Spec:** ./spec.md (056-workspaceid-etap-3-dostep) · **Data:** 2026-08-12
- **Gałąź:** `claude/omnia-architecture-skins-qlv2ew`

## 1. Podejście

Zmiana ma być tym, co zapowiedział komentarz w `platform/sharing/types.ts` napisany w 052:
*„dojdzie tu **jedno pole**, a w `access.ts` zmieni się **jeden krok** rozstrzygania — reszta
zostaje"*. Ten plan sprawdza, czy to była prawda, i tak właśnie kroi robotę:

1. `ResourceFacts` dostaje `workspaceId`;
2. `AccessContext` dostaje **role w przestrzeniach** — czytane tym samym zapytaniem co dotąd, nie nowym;
3. `rolaZWlasnosci` (jedna funkcja, 12 linii) rozstrzyga po przestrzeni;
4. deklaracja Zadań podaje nowe pole;
5. tabela prawdy liczona ponownie i porównana komórka po komórce.

Kroki 2 i 3 w `access.ts`, dziedziczenie, łańcuch i cache — **bez zmian**.

## 2. Odkrycie planowania, które zmienia spec (C-54)

**Nie każdy zasób ma i będzie miał `workspaceId`.** `Task` nie jest wśród 45 modeli objętych
migracją 0227, bo **nie ma kolumny `ownerId`** — własność zadania idzie przez `createdById` albo
przez projekt. Deklaracja `tasks.task` dla zadania bez projektu zwraca dziś
`{ ownerId: createdById }` i nie ma z czego wziąć przestrzeni.

Wniosek: rozstrzyganie musi obsługiwać **oba** kształty faktów, i to nie tylko przejściowo dla
sierot:

> **Jeśli fakty niosą `workspaceId` — decyduje przestrzeń. Jeśli nie — decyduje para
> `ownerId`/`ownerTeamId`, dokładnie jak dotąd.**

To nie jest osłabienie zmiany, tylko poprawny opis rzeczywistości: `workspaceId` zastępuje parę
kolumn **tam, gdzie ta para była**. Zasób, którego własność jest **wyprowadzona** (zadanie z
projektu, zadanie od twórcy), nie ma własnej przestrzeni i nie powinien jej udawać.

Ta sama gałąź obsługuje przy okazji **sieroty** (rekord, którego właściciel nie miał przestrzeni
w chwili backfillu) — bez niej właściciel takiego rekordu straciłby do niego dostęp, co byłoby
regresją nieujętą w §5 speca. **`spec.md` zaktualizowany**: AC-4 mówi teraz wprost o zachowaniu
awaryjnym, a §6 wymienia gałąź „bez przestrzeni" jako element w zakresie.

## 3. Model danych (Prisma)

**Bez zmian w schemacie i bez migracji.** Kolumna istnieje od 0227, wypełniana jest od 0228.

## 4. Zmiany w platformie

### 4.1 `src/platform/sharing/types.ts`

```ts
export interface ResourceFacts {
  /** 056: PODSTAWOWY fakt o własności. `null` = zasób bez własnej przestrzeni … */
  workspaceId?: string | null;
  ownerId: string | null;
  ownerTeamId: string | null;
  parent?: ResourceRef;
}

export interface AccessContext {
  teamIds: string[];
  adminTeamIds: string[];
  workspaceIds: string[];
  /** 056: moja przestrzeń osobista — `facts.workspaceId` równy tej wartości znaczy „mój zasób". */
  personalWorkspaceId: string | null;
  /** 056: moja rola w każdej przestrzeni, której jestem członkiem. */
  workspaceRoles: Record<string, WorkspaceMemberRole>;
}
```

`workspaceId` jest **opcjonalne** w `ResourceFacts` — dzięki temu deklaracje 18 modułów, które
powstaną w zadaniu 13, nie muszą go podawać, dopóki nie zaczną, a `tasks.task` nie musi go udawać.

### 4.2 `src/platform/sharing/cache.ts`

Zapytanie o członkostwa **rozszerzone o złączenie**, nie zdublowane:

```ts
prisma.workspaceMember.findMany({
  where: { userId },
  select: { workspaceId: true, role: true, workspace: { select: { personalUserId: true } } },
})
```

Jedno zapytanie zamiast jednego — liczba zapytań w kontekście **bez zmian** (AC-5). Przestrzeń
osobistą rozpoznajemy po `workspace.personalUserId === userId`, a nie po `kind === "personal"`:
`kind` mówi, jakiego rodzaju jest przestrzeń, a `personalUserId` — **czyja**.

### 4.3 `src/platform/sharing/access.ts` — jedyna zmiana logiki

`rolaZWlasnosci` dostaje gałąź „po przestrzeni", z tym samym stopniowaniem, które moduł deklaruje
w `teamOwnership`:

| Sytuacja | Rola |
|----------|------|
| `facts.workspaceId` = moja przestrzeń osobista | `manager` |
| `facts.workspaceId` = przestrzeń, w której jestem `owner`/`admin`, a moduł zadeklarował `teamOwnership` | `teamOwnership.admin` |
| `facts.workspaceId` = przestrzeń, w której jestem `member`, a moduł zadeklarował `teamOwnership` | `teamOwnership.member` |
| `facts.workspaceId` ustawione, ale moduł **nie** zadeklarował `teamOwnership` (i to nie moja osobista) | **brak** — jak dziś |
| `facts.workspaceId` = przestrzeń, w której jestem `guest` | **brak** — nic dziś takiej roli nie produkuje, więc przyznanie czegokolwiek byłoby poszerzeniem |
| `facts.workspaceId` puste (`null`/brak) | **stara reguła** na `ownerId`/`ownerTeamId` |

Mapowanie `WorkspaceMemberRole` → rola zasobu jest **jednym miejscem** w tej funkcji, nie tabelą
rozsianą po modułach. Moduł nadal nie definiuje własnych ról (C-17).

### 4.4 `src/modules/tasks/sharing.ts`

`resolve` dla `tasks.project` dobiera `workspaceId` do `select` i podaje je w faktach. Komentarz
zapowiadający zadanie 11 zastąpiony opisem stanu faktycznego. `tasks.task` **bez zmian** — nie ma
tej kolumny i nie będzie jej udawał.

## 5. Server Actions, RBAC, UI, AI

**Bez zmian.** Guardy modułu wołają `requireAccess` tak samo; `revalidatePath` nietykane; żadnego
`AIAction`; zero UI. Read-toole Zadań chodzą przez ten sam guard, więc zmiana obejmuje je
automatycznie — i o to chodzi.

## 6. Dowód — tabela prawdy (C-17)

Test `truthTable.integration.test.ts` z 052 zostaje **tym samym testem**; zmienia się to, co liczy:

- **25 istniejących komórek musi wyjść identycznie** jak w `specs/052…/baseline-dostep.json`.
- **Dochodzi szósty wiersz — „właściciel zespołu bez wiersza `TeamMember`"** (spec §5). Nowego
  wiersza nie było w punkcie odniesienia, więc jego dopisanie jest **rozszerzeniem tabeli**, nie
  zmianą wzorca; wartości w nim opisuje spec.
- **Siódmy wiersz — „zasób bez przestrzeni" (sierota)** — dowód AC-4: właściciel nadal ma dostęp,
  obcy nadal nie ma.

Punkt odniesienia zostaje **w katalogu 052** (nie kopiujemy go do 056): jest jeden i ma być jeden.
Dopisanie wierszy aktualizuje ten plik — **świadomie**, z opisem w `verify.md`, co dokładnie
doszło.

## 7. Pliki

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/platform/sharing/types.ts` | edycja | `workspaceId` w faktach, role przestrzeni w kontekście |
| `src/platform/sharing/cache.ts` | edycja | złączenie w istniejącym zapytaniu (bez nowego) |
| `src/platform/sharing/access.ts` | edycja | `rolaZWlasnosci` — jedyna zmiana logiki |
| `src/modules/tasks/sharing.ts` | edycja | `workspaceId` w `resolve` projektu |
| `src/platform/sharing/__tests__/truthTable.integration.test.ts` | edycja | dwa nowe wiersze |
| `specs/052-requireaccess-platforma/baseline-dostep.json` | edycja | dwa nowe wiersze (25 starych bez ruchu) |
| `specs/056-…/spec.md` | edycja | C-54: AC-4 i §6 po odkryciu z §2 |
| `content/architektura/15-dziennik.md` | edycja | wpis 056 |
| `doświadczenia.md` | edycja | lekcja, jeśli wyjdzie nieoczywisty problem |

## 8. Bramki i weryfikacja (C-50)

Lokalny Postgres (C-13). `test:unit` (tabela prawdy + licznik zapytań + izolacja najemców),
`check:test-types`, **`npx tsc --noEmit`** przed buildem (lekcja z 054), komplet bramek,
`next lint`, `npm run build`.

Mapowanie AC: AC-1/AC-2 → wiersze tabeli prawdy + test licznika zapytań · AC-3 → porównanie 25
komórek z punktem odniesienia · AC-4 → wiersz „sierota" · AC-5 → `queryCount.integration.test.ts`
bez zmiany liczb · AC-6 → tabela bramek + `git diff` · AC-7 → dziennik.

## 9. Ryzyka i wycofanie

| Ryzyko | Odpowiedź |
|--------|-----------|
| Ciche poszerzenie dostępu | 25 komórek porównywanych z zapisanym wzorcem; różnica psuje test |
| Wzrost liczby zapytań | Złączenie w istniejącym zapytaniu; pilnuje test licznika |
| Sierota traci właściciela | Gałąź „bez przestrzeni" + własny wiersz tabeli |
| `guest` w przestrzeni dostaje coś nowego | Jawnie **nic**; nic dziś tej roli nie produkuje |

**Wycofanie:** rewert czterech plików — brak migracji, brak zmian danych.

## 10. Checklista konstytucji

C-01 ✓ · C-10..C-15 ✓ nie dotyczy (bez migracji) · **C-17 ✓** tabela prawdy przed przełączeniem,
jedyne poszerzenie nazwane w specu · C-20/C-21 ✓ akcje nietykane · C-23 ✓ bez `AIAction` ·
C-30..C-35 ✓ zero UI · **C-36 ✓** platforma nadal nie zna modułu; katalog parametrem wymaganym ·
C-50 ✓ · C-51 ✓ · C-53 ✓ zmiana w jednej funkcji, zgodnie z szwem zaprojektowanym w 052.
