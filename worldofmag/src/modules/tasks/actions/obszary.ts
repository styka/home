"use server";

/**
 * 117: OBSZARY — drzewo porządkujące zadania wewnątrz projektu.
 *
 * Obszar jest treścią projektu jak zadanie, więc każdą operację strzeże `assertProjectAccess`
 * (rola MEMBER / `task.edit`), a własność rozstrzyga projekt — tabela nie ma własnej przestrzeni.
 * Usunięcie ma dwa tryby (decyzja właściciela): „scal do rodzica" i „usuń całe poddrzewo";
 * oba zapisują migawkę do kosza (moduł `"obszary"`), przywracanie w `lib/trash/przywracanie`.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { recordTrash } from "@/platform/trash/trash";
import { assertProjectAccess } from "./taskProjects";
import { czyRuchTworzyCykl, idPoddrzewa, type WezelObszaru } from "../lib/obszary";

export interface ObszarDTO extends WezelObszaru {
  projectId: string;
}

export type TrybUsunieciaObszaru = "scal" | "poddrzewo";

/** Wszystkie obszary projektu — płaska lista, drzewo składa `splaszczDrzewo` po stronie widoku. */
export async function getProjectAreas(projectId: string): Promise<ObszarDTO[]> {
  const user = await requireAuth();
  await assertProjectAccess(projectId, user.id);
  // paginacja: kompletny — drzewo obszarów projektu musi być całe: ucięta lista gubi sekcje,
  // a z nimi zadania przypisane do niedoczytanych obszarów.
  const rows = await prisma.taskArea.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, projectId: true, parentId: true, name: true, order: true },
  });
  return rows;
}

export async function createArea(
  projectId: string,
  name: string,
  parentId: string | null = null,
): Promise<ObszarDTO> {
  const user = await requireAuth();
  await assertProjectAccess(projectId, user.id);
  const nazwa = name.trim();
  if (!nazwa) throw new Error("Nazwa obszaru nie może być pusta");

  if (parentId) {
    const rodzic = await prisma.taskArea.findUnique({ where: { id: parentId }, select: { projectId: true } });
    if (!rodzic || rodzic.projectId !== projectId) throw new Error("Obszar nadrzędny nie należy do tego projektu");
  }

  // Na koniec rodzeństwa: max(order) + 1 (jak porządek list w innych modułach).
  const ostatni = await prisma.taskArea.findFirst({
    where: { projectId, parentId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const area = await prisma.taskArea.create({
    data: { projectId, parentId, name: nazwa, order: (ostatni?.order ?? 0) + 1 },
    select: { id: true, projectId: true, parentId: true, name: true, order: true },
  });
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${projectId}`);
  return area;
}

export async function renameArea(id: string, name: string): Promise<void> {
  const user = await requireAuth();
  const area = await prisma.taskArea.findUnique({ where: { id }, select: { projectId: true } });
  if (!area) throw new Error("Obszar nie istnieje");
  await assertProjectAccess(area.projectId, user.id);
  const nazwa = name.trim();
  if (!nazwa) throw new Error("Nazwa obszaru nie może być pusta");

  await prisma.taskArea.update({ where: { id }, data: { name: nazwa } });
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${area.projectId}`);
}

/**
 * Przeniesienie obszaru w drzewie (nowy rodzic i/lub porządek). Walidacja cyklu po stronie
 * serwera — UI też jej pilnuje, ale to serwer jest granicą (obszar nie może wylądować pod
 * własnym potomkiem, bo całe poddrzewo znikłoby z korzenia).
 */
export async function moveArea(
  id: string,
  cel: { parentId: string | null; order?: number },
): Promise<void> {
  const user = await requireAuth();
  const area = await prisma.taskArea.findUnique({ where: { id }, select: { projectId: true } });
  if (!area) throw new Error("Obszar nie istnieje");
  await assertProjectAccess(area.projectId, user.id);

  if (cel.parentId) {
    const rodzic = await prisma.taskArea.findUnique({ where: { id: cel.parentId }, select: { projectId: true } });
    if (!rodzic || rodzic.projectId !== area.projectId) throw new Error("Obszar nadrzędny nie należy do tego projektu");
  }

  // paginacja: kompletny — wykrycie cyklu wymaga całego drzewa projektu; niedoczytana gałąź
  // to niewykryty cykl.
  const wszystkie = await prisma.taskArea.findMany({
    where: { projectId: area.projectId },
    select: { id: true, parentId: true, name: true, order: true },
  });
  if (czyRuchTworzyCykl(wszystkie, id, cel.parentId)) {
    throw new Error("Nie można przenieść obszaru do jego własnego podobszaru");
  }

  await prisma.taskArea.update({
    where: { id },
    data: { parentId: cel.parentId, ...(cel.order !== undefined && { order: cel.order }) },
  });
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${area.projectId}`);
}

/**
 * Usunięcie obszaru — dwa tryby (decyzja właściciela, spec 117):
 * - `"scal"`: dzieci i zadania przechodzą do obszaru nadrzędnego (na szczycie — bez obszaru),
 *   kasowany jest jeden wiersz;
 * - `"poddrzewo"`: kaskada FK zdejmuje całą gałąź, zadania tracą przypisanie (`SetNull`).
 * Migawka do kosza niesie usuwane obszary ORAZ mapę przypisań zadań, bo `SetNull` nadpisuje
 * `areaId` zanim cokolwiek da się odtworzyć.
 */
export async function deleteArea(id: string, tryb: TrybUsunieciaObszaru): Promise<void> {
  const user = await requireAuth();
  const area = await prisma.taskArea.findUnique({ where: { id } });
  if (!area) return;
  await assertProjectAccess(area.projectId, user.id);

  // paginacja: kompletny — migawka i przepięcia muszą objąć całe poddrzewo.
  const wszystkie = await prisma.taskArea.findMany({
    where: { projectId: area.projectId },
    select: { id: true, projectId: true, parentId: true, name: true, order: true },
  });
  const usuwane =
    tryb === "poddrzewo" ? Array.from(idPoddrzewa(wszystkie, id)) : [id];
  const migawkaObszarow = wszystkie.filter((a) => usuwane.includes(a.id));

  // paginacja: kompletny — pełna mapa przypisań usuwanych obszarów; ucięta mapa = zadania,
  // których przywrócenie nie odda do obszaru.
  const przypisania = await prisma.task.findMany({
    where: { areaId: { in: usuwane } },
    select: { id: true, areaId: true },
  });

  await recordTrash(user.id, {
    module: "obszary",
    entityId: area.id,
    title: area.name,
    payload: {
      rodzaj: "obszary",
      tryb,
      projectId: area.projectId,
      areas: migawkaObszarow,
      // Recenzja 117 (ust. 2): w trybie „scal" pod-obszary przechodzą do dziadka i migawka
      // korzenia by o nich nie wiedziała — bez tej listy przywrócenie oddawałoby obszar
      // z zadaniami, ale jego dawne pod-obszary zostawałoby pod dziadkiem na zawsze.
      childIds: wszystkie.filter((a) => a.parentId === id).map((a) => a.id),
      taskAssignments: przypisania.map((t) => ({ taskId: t.id, areaId: t.areaId })),
    },
  });

  await prisma.$transaction(async (tx) => {
    if (tryb === "scal") {
      await tx.taskArea.updateMany({ where: { parentId: id }, data: { parentId: area.parentId } });
      await tx.task.updateMany({ where: { areaId: id }, data: { areaId: area.parentId } });
    }
    // W trybie „poddrzewo" kaskada FK (parentId) zdejmuje gałąź, a Task.areaId idzie na SetNull.
    await tx.taskArea.delete({ where: { id } });
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${area.projectId}`);
  revalidatePath("/trash");
}
