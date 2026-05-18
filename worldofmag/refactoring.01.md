# Raport Refaktoringu — Iteracja 01

**Data:** 2026-05-18  
**Zakres:** Eliminacja duplikacji w warstwie Server Actions

---

## Podsumowanie wykonawcze

Pierwsza iteracja skoncentrowała się na najbardziej rażącej i mechanicznej duplikacji kodu: każdy z 10 plików Server Actions zawierał identyczną lokalną definicję `requireAuth()`, a 3 z nich dodatkowo lokalną wersję `getUserTeamIds()`. Łącznie 13 duplikatów tych samych funkcji rozsianych po całym katalogu `src/actions/`.

---

## Zidentyfikowane problemy

### 1. `requireAuth()` — 10× duplikat

Każdy plik w `src/actions/` definiował:

```typescript
// Identyczny kod w KAŻDYM z 10 plików
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string };
}
```

**Pliki z duplikatem:**
- `actions/tasks.ts`
- `actions/taskProjects.ts`
- `actions/taskTags.ts`
- `actions/items.ts`
- `actions/lists.ts`
- `actions/products.ts`
- `actions/categories.ts`
- `actions/units.ts`
- `actions/teams.ts`
- `actions/invitations.ts`

### 2. `getUserTeamIds()` — 3× duplikat

Trzy pliki definiowały identyczną funkcję pomocniczą:

```typescript
async function getUserTeamIds(userId: string): Promise<string[]> {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  return memberships.map((m) => m.teamId);
}
```

**Pliki z duplikatem:**
- `actions/categories.ts`
- `actions/products.ts`
- `actions/units.ts`

Ponadto `actions/lists.ts` miał inlined wersję tego samego zapytania zamiast dedykowanej funkcji.

---

## Wprowadzone zmiany

### Nowy plik: `src/lib/server-utils.ts`

Stworzono centralny moduł z narzędziami dla Server Actions:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string; role?: string };
}

export async function getUserTeamIds(userId: string): Promise<string[]> {
  const rows = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  return rows.map((r) => r.teamId);
}
```

**Uwaga:** Przy okazji rozszerzono typ zwracany `requireAuth` o opcjonalne `role?: string`, co jest potrzebne w `teams.ts` i `categories.ts`.

### Aktualizacja 10 plików actions

Każdy plik zaktualizowano:
- Usunięto lokalną definicję `requireAuth()`
- Zastąpiono importem `import { requireAuth } from "@/lib/server-utils"`
- Tam gdzie używano `getUserTeamIds` — dodano import tej funkcji z nowego modułu
- `actions/lists.ts` — inlined query zastąpiono wywołaniem `getUserTeamIds()`

---

## Metryki

| Miara | Przed | Po |
|-------|-------|----|
| Duplikaty `requireAuth` | 10 | 0 |
| Duplikaty `getUserTeamIds` | 4 (3 + 1 inlined) | 0 |
| Linie kodu w actions (razem) | ~1960 | ~1918 |
| Pliki z lokalną definicją auth | 10 | 0 |

---

## Problemy znalezione przy okazji

1. **`notes.ts` — brak autoryzacji:** Moduł notatek nie sprawdza tożsamości użytkownika. Funkcje `getNotes`, `createNote`, `updateNote` itd. działają bez auth-guard. Notatki nie mają pola `userId` w schemacie — są globalnie widoczne. To poważna luka bezpieczeństwa do naprawienia w przyszłości.

2. **`noteGroups.ts`, `tags.ts` — brak auth:** Podobnie — grupy notatek i tagi nie mają kontroli dostępu.

3. **`config.ts` — `requireAdmin()` nie używa `requireAuth`:** Implementuje własną logikę zamiast korzystać z `requireAuth` + sprawdzenia roli.

4. **`categories.ts` — `getCategoryEmojiMap` i `getCategoryNames`:** Używają `auth()` bezpośrednio zamiast `requireAuth()` bo wymagają obsługi opcjonalnego użytkownika (zwracają dane globalne gdy brak sesji). Zostawiono `auth()` import, który jest tu uzasadniony.

5. **`teams.ts` line 72:** `Parameter 'm' implicitly has an 'any' type` — pre-existing TS error.

---

## Co pozostało do zrobienia

- Moduł notatek wymaga wprowadzenia autoryzacji (user-scoped notes)
- `requireAdmin()` w `config.ts` mógłby używać `requireAuth()` jako podstawy
- Warto dodać `getUserTeamIds` jako jeden z pierwszych kroków w auth-flow (memoizacja/cache)
