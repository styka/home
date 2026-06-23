// Z-010: wspólna infrastruktura egzekutora akcji asystenta (wyodrębniona z
// execute/route.ts). Typy wyniku + helpery rozwiązywania rekordów używane przez
// route i (docelowo) handlery per-domena w tym katalogu.
//
// Brak `type === "..."` tutaj — to wyłącznie typy i resolvery (scripts/check-action-coverage.js
// skanuje ten katalog, ale ten plik nie deklaruje żadnych akcji).
import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import { createList } from "@/actions/lists";
import type { AIAction } from "@/lib/ai/aiAction";
import type { TaskPriority } from "@/types";

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Priorytety to skala porządkowa — „podnieś o 1" działa na każdym zadaniu względem
// JEGO obecnego priorytetu (nie ustawia wspólnej wartości). Przesunięcie klampujemy
// do zakresu NONE..URGENT, więc bump powyżej/poniżej skali jest no-opem zamiast błędu.
const PRIORITY_LADDER: TaskPriority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];

export function shiftPriority(current: TaskPriority, steps: number): TaskPriority {
  const idx = PRIORITY_LADDER.indexOf(current);
  const base = idx === -1 ? 0 : idx;
  const next = Math.max(0, Math.min(PRIORITY_LADDER.length - 1, base + steps));
  return PRIORITY_LADDER[next];
}

export function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export interface ActionResult {
  id: string;
  success: boolean;
  description: string;
  error?: string;
  // Opcjonalny cel przekierowania po utworzeniu rekordu (params.openAfter).
  navigateTo?: string;
  navigateLabel?: string;
  // Akcja odwracająca skutek (np. utworzono → usuń utworzony rekord). Klient
  // pokazuje „Cofnij" i wykonuje te akcje ponownie przez /execute (te same
  // asercje dostępu). Brak = akcji nie da się prosto cofnąć.
  undo?: AIAction;
}

// Wynik pojedynczej akcji: komunikat + opcjonalna propozycja przejścia do utworzonego widoku.
export interface ExecOutcome {
  message: string;
  navigateTo?: string;
  navigateLabel?: string;
  undo?: AIAction;
}

// Helper: zbuduj akcję odwracającą (cofnięcie). description jest po ludzku — to ją widzi użytkownik.
export function undoAction(module: AIAction["module"], type: string, params: Record<string, unknown>, description: string): AIAction {
  return { id: `undo_${Math.random().toString(36).slice(2, 8)}`, module, type, description, params };
}

// ── Helpery rozwiązywania rekordów (id-first, z fallbackiem po searchQuery) ──────────────
// WAŻNE (bezpieczeństwo): payload `execute` jest edytowalny po stronie klienta, więc nigdy
// nie ufamy id z klienta. Dla ścieżki id zwracamy je i pozwalamy Server Action zweryfikować
// własność (assert*Access). Dla fallbacku po nazwie szukamy WYŁĄCZNIE w zakresie użytkownika.

async function accessibleListIds(userId: string): Promise<string[]> {
  const teamIds = await getUserTeamIds(userId);
  const lists = await prisma.shoppingList.findMany({
    where: { OR: teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }] },
    select: { id: true },
  });
  return lists.map((l) => l.id);
}

export async function resolveOrCreateList(
  userId: string,
  opts: { listId?: string; listName?: string; activeListId?: string }
): Promise<{ id: string; name: string }> {
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];

  let list =
    (opts.listId && (await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id: opts.listId } }))) || null;
  if (!list && opts.listName) {
    list = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, name: { contains: opts.listName, mode: "insensitive" } } });
  }
  if (!list && opts.activeListId) {
    list = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id: opts.activeListId } });
  }
  if (!list) {
    list = await prisma.shoppingList.findFirst({ where: { OR: ownerOr }, orderBy: { createdAt: "asc" } });
  }
  if (!list) {
    const created = await createList("Zakupy");
    return { id: created.id, name: created.name };
  }
  return { id: list.id, name: list.name };
}

export async function resolveListId(
  userId: string,
  params: Record<string, unknown>,
  searchQuery?: string,
  activeListId?: string
): Promise<string> {
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];
  const id = asStr(params.listId);
  if (id) {
    const l = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id } });
    if (l) return l.id;
  }
  if (searchQuery) {
    const l = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, name: { contains: searchQuery, mode: "insensitive" } } });
    if (l) return l.id;
  }
  if (activeListId) {
    const l = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id: activeListId } });
    if (l) return l.id;
  }
  throw new Error(`Nie znaleziono listy: "${searchQuery ?? asStr(params.listId) ?? ""}"`);
}

export async function resolveItemId(userId: string, params: Record<string, unknown>, searchQuery?: string): Promise<string> {
  const id = asStr(params.itemId);
  if (id) return id; // updateItem*/deleteItem same w sobie asertują dostęp
  const listIds = await accessibleListIds(userId);
  const item = await prisma.item.findFirst({
    where: { listId: { in: listIds }, name: { contains: searchQuery ?? "", mode: "insensitive" } },
  });
  if (!item) throw new Error(`Nie znaleziono produktu: "${searchQuery}"`);
  return item.id;
}

export async function resolveTaskId(
  userId: string,
  params: Record<string, unknown>,
  searchQuery?: string,
  opts?: { notDone?: boolean }
): Promise<string> {
  const id = asStr(params.taskId);
  if (id) return id; // updateTask/deleteTask asertują dostęp
  const task = await prisma.task.findFirst({
    where: {
      OR: [
        { createdById: userId },
        { assigneeId: userId },
        { project: { ownerId: userId } },
        { project: { members: { some: { userId } } } },
      ],
      title: { contains: searchQuery ?? "", mode: "insensitive" },
      ...(opts?.notDone ? { status: { notIn: ["DONE", "CANCELLED"] } } : {}),
    },
  });
  if (!task) throw new Error(`Nie znaleziono zadania: "${searchQuery}"`);
  return task.id;
}

export async function resolveProjectIdForCreate(
  userId: string,
  projectName?: string,
  currentProjectId?: string
): Promise<string | null> {
  if (projectName) {
    const p = await prisma.taskProject.findFirst({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }], name: { contains: projectName, mode: "insensitive" } },
    });
    if (p) return p.id;
  }
  if (currentProjectId) {
    const p = await prisma.taskProject.findFirst({
      where: { id: currentProjectId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    });
    if (p) return p.id;
  }
  const inbox = await prisma.taskProject.findFirst({ where: { ownerId: userId, isInbox: true } });
  return inbox?.id ?? null;
}

export async function resolveNoteId(userId: string, params: Record<string, unknown>, searchQuery?: string): Promise<string> {
  const id = asStr(params.noteId);
  if (id) return id;
  const teamIds = await getUserTeamIds(userId);
  const note = await prisma.note.findFirst({
    where: {
      OR: teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }],
      AND: {
        OR: [
          { title: { contains: searchQuery ?? "", mode: "insensitive" } },
          { content: { contains: searchQuery ?? "", mode: "insensitive" } },
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!note) throw new Error(`Nie znaleziono notatki: "${searchQuery}"`);
  return note.id;
}

export async function resolveHealthEventId(userId: string, params: Record<string, unknown>, searchQuery?: string): Promise<string> {
  const id = asStr(params.eventId);
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];
  if (id) {
    const ev = await prisma.healthEvent.findFirst({ where: { OR: ownerOr, id } });
    if (ev) return ev.id;
  }
  const ev = await prisma.healthEvent.findFirst({
    where: { OR: ownerOr, title: { contains: searchQuery ?? "", mode: "insensitive" } },
    orderBy: { scheduledAt: "desc" },
  });
  if (!ev) throw new Error(`Nie znaleziono wpisu zdrowia: "${searchQuery}"`);
  return ev.id;
}

export async function resolveMedicationId(userId: string, params: Record<string, unknown>, searchQuery?: string): Promise<string> {
  const id = asStr(params.medicationId);
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];
  if (id) {
    const s = await prisma.medicationSchedule.findFirst({ where: { OR: ownerOr, id } });
    if (s) return s.id;
  }
  const s = await prisma.medicationSchedule.findFirst({
    where: { OR: ownerOr, name: { contains: searchQuery ?? asStr(params.name) ?? "", mode: "insensitive" } },
    orderBy: { active: "desc" },
  });
  if (!s) throw new Error(`Nie znaleziono leku/czynności: "${searchQuery ?? asStr(params.name) ?? ""}"`);
  return s.id;
}

export async function resolveDeckId(userId: string, params: Record<string, unknown>, deckName?: string): Promise<string> {
  const id = asStr(params.deckId);
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];
  if (id) {
    const d = await prisma.languageDeck.findFirst({ where: { OR: ownerOr, id } });
    if (d) return d.id;
  }
  const name = deckName ?? asStr(params.deckName);
  if (name) {
    const d = await prisma.languageDeck.findFirst({ where: { OR: ownerOr, name: { contains: name, mode: "insensitive" } } });
    if (d) return d.id;
  }
  const first = await prisma.languageDeck.findFirst({ where: { OR: ownerOr }, orderBy: { updatedAt: "desc" } });
  if (!first) throw new Error("Brak talii fiszek — utwórz najpierw talię");
  return first.id;
}

export async function ownerOrArr(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  return teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];
}

// Generyczny resolver „id z paramu LUB pierwszy pasujący po nazwie w zakresie użytkownika".
// `finder` dostaje warunek `where` i zwraca rekord {id} albo null. Bezpieczeństwo: zawsze
// zawężamy do własności użytkownika/zespołu, więc id z klienta nie pozwoli sięgnąć cudzych danych.
export async function resolveByName(
  finder: (where: Record<string, unknown>) => Promise<{ id: string } | null>,
  ownerOr: Record<string, unknown>[],
  idVal: string | undefined,
  nameField: string,
  query: string | undefined,
  label: string
): Promise<string> {
  if (idVal) {
    const byId = await finder({ OR: ownerOr, id: idVal });
    if (byId) return byId.id;
  }
  if (query) {
    const byName = await finder({ OR: ownerOr, [nameField]: { contains: query, mode: "insensitive" } });
    if (byName) return byName.id;
  }
  throw new Error(`Nie znaleziono: ${label} „${query ?? idVal ?? ""}"`);
}
