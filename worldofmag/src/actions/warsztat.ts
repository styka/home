"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { trackActivity } from "@/actions/activity";
import { getSuggestions } from "@/lib/warsztat/catalog";
import type { Workshop, WorkshopItem, WorkshopProject } from "@prisma/client";

export type WarsztatMode = "home" | "pro";

export type WorkshopWithCounts = Workshop & {
  _count: { items: number; projects: number };
};

export type WorkshopDetail = Workshop & {
  items: WorkshopItem[];
  projects: WorkshopProject[];
};

// ─── Dostęp ─────────────────────────────────────────────────────────────────

function ownershipOr(userId: string, teamIds: string[]) {
  return [
    { ownerId: userId },
    ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
  ];
}

/** Zwraca warsztat, jeśli użytkownik ma do niego dostęp (właściciel lub zespół). */
async function assertWorkshopAccess(workshopId: string, userId: string): Promise<Workshop> {
  const teamIds = await getUserTeamIds(userId);
  const ws = await prisma.workshop.findUnique({ where: { id: workshopId } });
  if (!ws) throw new Error("Warsztat nie istnieje");
  if (ws.ownerId === userId) return ws;
  if (ws.ownerTeamId && teamIds.includes(ws.ownerTeamId)) return ws;
  throw new Error("Brak dostępu do tego warsztatu");
}

/** Zwraca pozycję wyposażenia po sprawdzeniu dostępu do jej warsztatu. */
async function assertItemAccess(itemId: string, userId: string): Promise<WorkshopItem> {
  const item = await prisma.workshopItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Pozycja nie istnieje");
  await assertWorkshopAccess(item.workshopId, userId);
  return item;
}

function toDate(v: Date | string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Ustawienia / tryb Dom↔Pro ──────────────────────────────────────────────

export async function getWarsztatSettings(): Promise<{ mode: WarsztatMode }> {
  const user = await requireAuth();
  const s = await prisma.warsztatSettings.findUnique({ where: { userId: user.id } });
  return { mode: (s?.mode as WarsztatMode) || "home" };
}

export async function setWarsztatMode(mode: WarsztatMode): Promise<void> {
  const user = await requireAuth();
  if (mode !== "home" && mode !== "pro") throw new Error("Nieprawidłowy tryb");
  await prisma.warsztatSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, mode },
    update: { mode },
  });
  revalidatePath("/warsztaty");
}

// ─── Warsztaty ───────────────────────────────────────────────────────────────

export async function getWorkshops(): Promise<WorkshopWithCounts[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  return prisma.workshop.findMany({
    where: { OR: ownershipOr(user.id, teamIds) },
    include: { _count: { select: { items: true, projects: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getWorkshop(id: string): Promise<WorkshopDetail | null> {
  const user = await requireAuth();
  await assertWorkshopAccess(id, user.id);
  return prisma.workshop.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ kind: "asc" }, { name: "asc" }] },
      projects: { orderBy: { updatedAt: "desc" } },
    },
  });
}

export interface WorkshopInput {
  name: string;
  type?: string | null;
  description?: string | null;
  location?: string | null;
  teamId?: string | null;
}

export async function createWorkshop(data: WorkshopInput): Promise<Workshop> {
  const user = await requireAuth();
  if (!data.name?.trim()) throw new Error("Podaj nazwę warsztatu");
  if (data.teamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.teamId)) throw new Error("Nie jesteś członkiem tego zespołu");
  }
  const created = await prisma.workshop.create({
    data: {
      name: data.name.trim(),
      type: data.type?.trim() || "ogolny",
      description: data.description?.trim() || null,
      location: data.location?.trim() || null,
      ownerId: data.teamId ? null : user.id,
      ownerTeamId: data.teamId ?? null,
    },
  });
  void trackActivity("warsztaty", "create_workshop", { id: created.id, name: created.name });
  revalidatePath("/warsztaty");
  return created;
}

export async function updateWorkshop(
  id: string,
  patch: Partial<Omit<WorkshopInput, "teamId">>
): Promise<Workshop> {
  const user = await requireAuth();
  await assertWorkshopAccess(id, user.id);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.type !== undefined) data.type = patch.type?.trim() || "ogolny";
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.location !== undefined) data.location = patch.location?.trim() || null;
  const updated = await prisma.workshop.update({ where: { id }, data });
  revalidatePath("/warsztaty");
  revalidatePath(`/warsztaty/${id}`);
  return updated;
}

export async function deleteWorkshop(id: string): Promise<void> {
  const user = await requireAuth();
  await assertWorkshopAccess(id, user.id);
  await prisma.workshop.delete({ where: { id } });
  revalidatePath("/warsztaty");
}

// ─── Wyposażenie ──────────────────────────────────────────────────────────────

export interface WorkshopItemInput {
  name: string;
  kind?: string | null;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
  minQuantity?: number | null;
  condition?: string | null;
  status?: string | null;
  brand?: string | null;
  station?: string | null;
  assignedTo?: string | null;
  purchasePrice?: number | null;
  purchaseDate?: Date | string | null;
  lastServiceAt?: Date | string | null;
  nextServiceAt?: Date | string | null;
  suggestionKey?: string | null;
  notes?: string | null;
}

const KINDS = ["tool", "machine", "consumable", "safety", "material"];
const CONDITIONS = ["new", "good", "worn", "broken"];

export async function addWorkshopItem(workshopId: string, data: WorkshopItemInput): Promise<WorkshopItem> {
  const user = await requireAuth();
  await assertWorkshopAccess(workshopId, user.id);
  if (!data.name?.trim()) throw new Error("Podaj nazwę pozycji");
  const created = await prisma.workshopItem.create({
    data: {
      workshopId,
      name: data.name.trim(),
      kind: KINDS.includes(data.kind ?? "") ? data.kind! : "tool",
      category: data.category?.trim() || null,
      quantity: data.quantity ?? null,
      unit: data.unit?.trim() || null,
      minQuantity: data.minQuantity ?? null,
      condition: CONDITIONS.includes(data.condition ?? "") ? data.condition! : "good",
      status: data.status === "wishlist" ? "wishlist" : "owned",
      brand: data.brand?.trim() || null,
      station: data.station?.trim() || null,
      assignedTo: data.assignedTo?.trim() || null,
      purchasePrice: data.purchasePrice ?? null,
      purchaseDate: toDate(data.purchaseDate) ?? null,
      lastServiceAt: toDate(data.lastServiceAt) ?? null,
      nextServiceAt: toDate(data.nextServiceAt) ?? null,
      suggestionKey: data.suggestionKey?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
  void trackActivity("warsztaty", "add_workshop_item", { id: created.id, name: created.name });
  revalidatePath(`/warsztaty/${workshopId}`);
  revalidatePath("/warsztaty");
  return created;
}

export async function updateWorkshopItem(
  id: string,
  patch: Partial<WorkshopItemInput>
): Promise<WorkshopItem> {
  const user = await requireAuth();
  const item = await assertItemAccess(id, user.id);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.kind !== undefined) data.kind = KINDS.includes(patch.kind ?? "") ? patch.kind : "tool";
  if (patch.category !== undefined) data.category = patch.category?.trim() || null;
  if (patch.quantity !== undefined) data.quantity = patch.quantity;
  if (patch.unit !== undefined) data.unit = patch.unit?.trim() || null;
  if (patch.minQuantity !== undefined) data.minQuantity = patch.minQuantity;
  if (patch.condition !== undefined) data.condition = CONDITIONS.includes(patch.condition ?? "") ? patch.condition : "good";
  if (patch.status !== undefined) data.status = patch.status === "wishlist" ? "wishlist" : "owned";
  if (patch.brand !== undefined) data.brand = patch.brand?.trim() || null;
  if (patch.station !== undefined) data.station = patch.station?.trim() || null;
  if (patch.assignedTo !== undefined) data.assignedTo = patch.assignedTo?.trim() || null;
  if (patch.purchasePrice !== undefined) data.purchasePrice = patch.purchasePrice;
  if (patch.purchaseDate !== undefined) data.purchaseDate = toDate(patch.purchaseDate);
  if (patch.lastServiceAt !== undefined) data.lastServiceAt = toDate(patch.lastServiceAt);
  if (patch.nextServiceAt !== undefined) data.nextServiceAt = toDate(patch.nextServiceAt);
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  const updated = await prisma.workshopItem.update({ where: { id }, data });
  revalidatePath(`/warsztaty/${item.workshopId}`);
  revalidatePath("/warsztaty");
  return updated;
}

export async function deleteWorkshopItem(id: string): Promise<void> {
  const user = await requireAuth();
  const item = await assertItemAccess(id, user.id);
  await prisma.workshopItem.delete({ where: { id } });
  revalidatePath(`/warsztaty/${item.workshopId}`);
  revalidatePath("/warsztaty");
}

/** Zmiana ilości ze znakiem (np. zużycie materiału −1). Stan nie schodzi poniżej 0. */
export async function adjustWorkshopItemQuantity(id: string, delta: number): Promise<WorkshopItem> {
  const user = await requireAuth();
  const item = await assertItemAccess(id, user.id);
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Nieprawidłowa zmiana ilości");
  const next = Math.max(0, (item.quantity ?? 0) + delta);
  const updated = await prisma.workshopItem.update({ where: { id }, data: { quantity: next } });
  revalidatePath(`/warsztaty/${item.workshopId}`);
  return updated;
}

/**
 * Masowe dodanie pozycji z katalogu podpowiedzi (checklista „dodaj do
 * wyposażenia"). Pomija klucze już dodane do tego warsztatu (po suggestionKey).
 */
export async function addSuggestedItems(workshopId: string, keys: string[]): Promise<number> {
  const user = await requireAuth();
  const ws = await assertWorkshopAccess(workshopId, user.id);
  const suggestions = getSuggestions(ws.type);
  const wanted = suggestions.filter((s) => keys.includes(s.key));
  if (wanted.length === 0) return 0;

  const existing = await prisma.workshopItem.findMany({
    where: { workshopId, suggestionKey: { in: wanted.map((s) => s.key) } },
    select: { suggestionKey: true },
  });
  const have = new Set(existing.map((e) => e.suggestionKey));
  const toAdd = wanted.filter((s) => !have.has(s.key));
  if (toAdd.length === 0) return 0;

  await prisma.workshopItem.createMany({
    data: toAdd.map((s) => ({
      workshopId,
      name: s.name,
      kind: s.kind,
      category: s.category,
      suggestionKey: s.key,
      status: "owned",
    })),
  });
  void trackActivity("warsztaty", "add_suggested", { workshopId, count: toAdd.length });
  revalidatePath(`/warsztaty/${workshopId}`);
  revalidatePath("/warsztaty");
  return toAdd.length;
}

// ─── Przeglądy + materiały (agenda Pro) ──────────────────────────────────────

export interface MaintenanceOverview {
  due: Array<WorkshopItem & { workshopName: string; overdue: boolean }>;
  lowStock: Array<WorkshopItem & { workshopName: string }>;
}

export async function getMaintenanceOverview(): Promise<MaintenanceOverview> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const workshops = await prisma.workshop.findMany({
    where: { OR: ownershipOr(user.id, teamIds) },
    select: { id: true, name: true },
  });
  const nameById = new Map(workshops.map((w) => [w.id, w.name]));
  const ids = workshops.map((w) => w.id);
  if (ids.length === 0) return { due: [], lowStock: [] };

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 30); // przeglądy w najbliższych 30 dniach + zaległe

  const [dueItems, lowItems] = await Promise.all([
    prisma.workshopItem.findMany({
      where: { workshopId: { in: ids }, nextServiceAt: { not: null, lte: horizon } },
      orderBy: { nextServiceAt: "asc" },
    }),
    prisma.workshopItem.findMany({
      where: { workshopId: { in: ids }, minQuantity: { not: null } },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    due: dueItems.map((i) => ({
      ...i,
      workshopName: nameById.get(i.workshopId) ?? "",
      overdue: i.nextServiceAt != null && i.nextServiceAt < now,
    })),
    lowStock: lowItems
      .filter((i) => i.minQuantity != null && (i.quantity ?? 0) < i.minQuantity)
      .map((i) => ({ ...i, workshopName: nameById.get(i.workshopId) ?? "" })),
  };
}

// ─── Projekty / zlecenia (Pro) ────────────────────────────────────────────────

export interface WorkshopProjectInput {
  name: string;
  description?: string | null;
  status?: string | null;
  assignedTo?: string | null;
  dueAt?: Date | string | null;
}

const PROJECT_STATUSES = ["planned", "active", "done"];

export async function addWorkshopProject(workshopId: string, data: WorkshopProjectInput): Promise<WorkshopProject> {
  const user = await requireAuth();
  await assertWorkshopAccess(workshopId, user.id);
  if (!data.name?.trim()) throw new Error("Podaj nazwę projektu");
  const status = PROJECT_STATUSES.includes(data.status ?? "") ? data.status! : "planned";
  const created = await prisma.workshopProject.create({
    data: {
      workshopId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      status,
      assignedTo: data.assignedTo?.trim() || null,
      dueAt: toDate(data.dueAt) ?? null,
      startedAt: status === "active" ? new Date() : null,
      doneAt: status === "done" ? new Date() : null,
    },
  });
  revalidatePath(`/warsztaty/${workshopId}`);
  return created;
}

export async function updateWorkshopProject(
  id: string,
  patch: Partial<WorkshopProjectInput>
): Promise<WorkshopProject> {
  const user = await requireAuth();
  const project = await prisma.workshopProject.findUnique({ where: { id } });
  if (!project) throw new Error("Projekt nie istnieje");
  await assertWorkshopAccess(project.workshopId, user.id);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.assignedTo !== undefined) data.assignedTo = patch.assignedTo?.trim() || null;
  if (patch.dueAt !== undefined) data.dueAt = toDate(patch.dueAt);
  if (patch.status !== undefined) {
    const status = PROJECT_STATUSES.includes(patch.status ?? "") ? patch.status! : project.status;
    data.status = status;
    if (status === "active" && !project.startedAt) data.startedAt = new Date();
    if (status === "done") data.doneAt = new Date();
    if (status !== "done") data.doneAt = null;
  }
  const updated = await prisma.workshopProject.update({ where: { id }, data });
  revalidatePath(`/warsztaty/${project.workshopId}`);
  return updated;
}

export async function deleteWorkshopProject(id: string): Promise<void> {
  const user = await requireAuth();
  const project = await prisma.workshopProject.findUnique({ where: { id } });
  if (!project) throw new Error("Projekt nie istnieje");
  await assertWorkshopAccess(project.workshopId, user.id);
  await prisma.workshopProject.delete({ where: { id } });
  revalidatePath(`/warsztaty/${project.workshopId}`);
}
