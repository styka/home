"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import type { ObszarProjektow } from "@/types";
import { wlasnoscOsobistaDoZapisu, filtrMoichRekordow } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";
import { idPoddrzewa } from "../lib/poddrzewoObszarow";

/**
 * 125: OBSZARY-KATEGORIE projektów — następca grup projektów, na tej samej tabeli ("TaskView",
 * model `ProjectArea`). Projekt wskazuje obszar przez `TaskProject.areaId` (1:N); obszary mogą się
 * zagnieżdżać (`parentId`). Kolumna `projectIds` to LEGACY danych migracji 0293 — nie czytać.
 */

const TERMINAL_STATUSES = ["DONE", "CANCELLED"];

function naTyp(r: { id: string; name: string; emoji: string; color: string | null; parentId: string | null; order: number }): ObszarProjektow {
  return { id: r.id, name: r.name, emoji: r.emoji, color: r.color, parentId: r.parentId, order: r.order };
}

/** Id projektów, do których użytkownik ma dostęp (właściciel lub członek). */
async function accessibleProjectIds(userId: string): Promise<Set<string>> {
  const projects = await prisma.taskProject.findMany({
    take: SUFIT_LISTY,
    where: { OR: [await filtrMoichRekordow(userId), { members: { some: { userId } } }] },
    select: { id: true },
  });
  return new Set(projects.map((p: { id: string }) => p.id));
}

/** Pełne drzewo obszarów przestrzeni + liczniki (projekty bezpośrednio; aktywne zadania w PODDRZEWIE). */
export async function getObszaryProjektow(): Promise<ObszarProjektow[]> {
  const user = await requireAuth();

  // paginacja: kompletny — drzewo obszarów i liczniki muszą objąć całość: ucięta lista gubi
  // gałęzie i zaniża liczniki poddrzewa (wzorzec 117/getProjectAreas).
  const [rows, projekty] = await Promise.all([
    prisma.projectArea.findMany({
      where: { ...(await filtrMoichRekordow(user.id)) },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, emoji: true, color: true, parentId: true, order: true },
    }),
    prisma.taskProject.findMany({
      take: SUFIT_LISTY,
      where: { OR: [await filtrMoichRekordow(user.id), { members: { some: { userId: user.id } } }] },
      select: { id: true, areaId: true },
    }),
  ]);
  if (rows.length === 0) return [];

  // Aktywne zadania per projekt — jedno zapytanie, potem suma po poddrzewie.
  const grouped = await prisma.task.groupBy({
    by: ["projectId"],
    where: {
      projectId: { in: projekty.map((p) => p.id) },
      parentTaskId: null,
      status: { notIn: TERMINAL_STATUSES },
    },
    _count: { _all: true },
  });
  const zadanProjektu = new Map<string, number>(
    grouped
      .filter((g): g is typeof g & { projectId: string } => g.projectId !== null)
      .map((g) => [g.projectId, g._count._all])
  );

  return rows.map((r) => {
    const zakres = idPoddrzewa(rows, r.id);
    const projektyPoddrzewa = projekty.filter((p) => p.areaId && zakres.has(p.areaId));
    return {
      ...naTyp(r),
      projectCount: projekty.filter((p) => p.areaId === r.id).length,
      activeCount: projektyPoddrzewa.reduce((sum, p) => sum + (zadanProjektu.get(p.id) ?? 0), 0),
    };
  });
}

/** Jeden obszar + zakres poddrzewa (id obszarów i id dostępnych projektów). Null, gdy nie mój. */
export async function getObszarProjektow(id: string): Promise<
  (ObszarProjektow & { poddrzewoObszarow: string[]; poddrzewoProjektow: string[] }) | null
> {
  const user = await requireAuth();
  const moje = await filtrMoichRekordow(user.id);
  const row = await prisma.projectArea.findFirst({
    where: { id, ...moje },
    select: { id: true, name: true, emoji: true, color: true, parentId: true, order: true },
  });
  if (!row) return null;

  // paginacja: kompletny — poddrzewo liczy się z pełnego drzewa przestrzeni (jak wyżej).
  const wszystkie = await prisma.projectArea.findMany({
    where: { ...moje },
    select: { id: true, parentId: true },
  });
  const zakres = idPoddrzewa(wszystkie, row.id);
  const dostepne = await accessibleProjectIds(user.id);
  const projekty = await prisma.taskProject.findMany({
    take: SUFIT_LISTY,
    where: { areaId: { in: Array.from(zakres) } },
    select: { id: true },
  });
  return {
    ...naTyp(row),
    poddrzewoObszarow: Array.from(zakres),
    poddrzewoProjektow: projekty.map((p) => p.id).filter((pid) => dostepne.has(pid)),
  };
}

export async function createObszarProjektow(data: {
  name: string;
  emoji?: string;
  color?: string | null;
  parentId?: string | null;
}): Promise<ObszarProjektow> {
  const user = await requireAuth();
  const name = data.name.trim();
  if (!name) throw new Error("Nazwa obszaru nie może być pusta");

  const moje = await filtrMoichRekordow(user.id);
  if (data.parentId) {
    const rodzic = await prisma.projectArea.findFirst({ where: { id: data.parentId, ...moje }, select: { id: true } });
    if (!rodzic) throw new Error("Obszar nadrzędny nie znaleziony");
  }

  const maxOrder = await prisma.projectArea.aggregate({ where: { ...moje }, _max: { order: true } });
  const row = await prisma.projectArea.create({
    data: {
      name,
      emoji: data.emoji?.trim() || "🗂",
      color: data.color ?? null,
      parentId: data.parentId ?? null,
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });
  revalidatePath("/tasks");
  return naTyp(row);
}

export async function updateObszarProjektow(
  id: string,
  patch: { name?: string; emoji?: string; color?: string | null; parentId?: string | null }
): Promise<ObszarProjektow> {
  const user = await requireAuth();
  const moje = await filtrMoichRekordow(user.id);
  const existing = await prisma.projectArea.findFirst({ where: { id, ...moje } });
  if (!existing) throw new Error("Obszar nie znaleziony");

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Nazwa obszaru nie może być pusta");
    data.name = name;
  }
  if (patch.emoji !== undefined) data.emoji = patch.emoji.trim() || "🗂";
  if (patch.color !== undefined) data.color = patch.color;
  if (patch.parentId !== undefined) {
    if (patch.parentId === id) throw new Error("Obszar nie może być swoim rodzicem");
    if (patch.parentId) {
      const rodzic = await prisma.projectArea.findFirst({ where: { id: patch.parentId, ...moje }, select: { id: true } });
      if (!rodzic) throw new Error("Obszar nadrzędny nie znaleziony");
      // Strażnik cyklu (wzorzec 117/moveArea): nowy rodzic nie może leżeć w poddrzewie obszaru.
      // paginacja: kompletny — wykrycie cyklu wymaga całego drzewa przestrzeni.
      const wszystkie = await prisma.projectArea.findMany({ where: { ...moje }, select: { id: true, parentId: true } });
      if (idPoddrzewa(wszystkie, id).has(patch.parentId)) {
        throw new Error("Nie można przenieść obszaru do jego własnego poddrzewa");
      }
    }
    data.parentId = patch.parentId;
  }

  const row = await prisma.projectArea.update({ where: { id }, data });
  revalidatePath("/tasks");
  return naTyp(row);
}

/** Twardy delete wiersza: FK SET NULL zdejmuje przypisania projektów i awansuje pod-obszary (AC-7). */
export async function deleteObszarProjektow(id: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.projectArea.findFirst({ where: { id, ...(await filtrMoichRekordow(user.id)) } });
  if (!existing) return;
  await prisma.projectArea.delete({ where: { id } });
  revalidatePath("/tasks");
}

/**
 * Atomowe „projekty tego obszaru = lista": wskazanym ustawia `areaId` (kradnąc z innego obszaru —
 * model 1:N), a tym, które były tu przypisane i zniknęły z listy, przypisanie zdejmuje.
 */
export async function ustawProjektyObszaru(areaId: string, projectIds: string[]): Promise<void> {
  const user = await requireAuth();
  const obszar = await prisma.projectArea.findFirst({ where: { id: areaId, ...(await filtrMoichRekordow(user.id)) }, select: { id: true } });
  if (!obszar) throw new Error("Obszar nie znaleziony");

  const dostepne = await accessibleProjectIds(user.id);
  const chciane = projectIds.filter((pid) => dostepne.has(pid));

  await prisma.$transaction([
    prisma.taskProject.updateMany({
      where: { areaId, id: { notIn: chciane } },
      data: { areaId: null },
    }),
    ...(chciane.length > 0
      ? [prisma.taskProject.updateMany({ where: { id: { in: chciane } }, data: { areaId } })]
      : []),
  ]);
  revalidatePath("/tasks");
}
