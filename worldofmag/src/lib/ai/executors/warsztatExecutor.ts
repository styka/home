// Z-010: handler akcji asystenta dla modułu Warsztaty (warsztat + wyposażenie).
import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import {
  createWorkshop, addWorkshopItem, updateWorkshop, deleteWorkshop,
  updateWorkshopItem, deleteWorkshopItem, adjustWorkshopItemQuantity,
  addWorkshopProject, updateWorkshopProject, deleteWorkshopProject,
} from "@/actions/warsztat";
import { asStr, resolveByName, ownerOrArr } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeWarsztatAction(action: AIAction, userId: string): Promise<string> {
  const { type, params, searchQuery } = action;
  const wsQuery = () => searchQuery ?? asStr(params.workshopName) ?? asStr(params.name);
  const resolveWorkshop = async () => {
    const teamOr = await ownerOrArr(userId);
    return resolveByName((w) => prisma.workshop.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.workshopId), "name", wsQuery(), "warsztat");
  };
  // Pozycja/projekt w obrębie warsztatów dostępnych użytkownikowi (po nazwie).
  const resolveWithinWorkshops = async (
    finder: (ids: string[], q: string) => Promise<{ id: string } | null>,
    idVal: string | undefined,
    directFinder: (id: string) => Promise<{ id: string } | null>,
    q: string | undefined,
    label: string
  ) => {
    if (idVal) { const r = await directFinder(idVal); if (r) return r.id; }
    const teamOr = await ownerOrArr(userId);
    const workshops = await prisma.workshop.findMany({ where: { OR: teamOr }, select: { id: true } });
    const ids = workshops.map((w) => w.id);
    const r = q ? await finder(ids, q) : null;
    if (!r) throw new Error(`Nie znaleziono: ${label} „${q ?? idVal ?? ""}"`);
    return r.id;
  };

  if (type === "create_workshop") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę warsztatu");
    const ws = await createWorkshop({
      name,
      type: asStr(params.type) ?? null,
      location: asStr(params.location) ?? null,
    });
    return `Utworzono warsztat „${ws.name}"`;
  }

  if (type === "add_workshop_item") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę pozycji");
    const wsName = asStr(params.workshopName) ?? searchQuery?.trim();
    const teamIds = await getUserTeamIds(userId);
    const ownerOr = [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }];
    const workshop = wsName
      ? await prisma.workshop.findFirst({
          where: { OR: ownerOr, name: { contains: wsName, mode: "insensitive" } },
          orderBy: { updatedAt: "desc" },
        })
      : await prisma.workshop.findFirst({ where: { OR: ownerOr }, orderBy: { updatedAt: "desc" } });
    if (!workshop) throw new Error(wsName ? `Nie znaleziono warsztatu „${wsName}"` : "Brak warsztatu — najpierw utwórz warsztat");
    const item = await addWorkshopItem(workshop.id, {
      name,
      kind: asStr(params.kind) ?? null,
      category: asStr(params.category) ?? null,
      quantity: params.quantity != null ? Number(params.quantity) : null,
      unit: asStr(params.unit) ?? null,
    });
    return `Dodano do warsztatu „${workshop.name}": ${item.name}`;
  }

  if (type === "update_workshop") {
    const id = await resolveWorkshop();
    await updateWorkshop(id, { name: asStr(params.newName) ?? asStr(params.name), type: asStr(params.type), location: asStr(params.location) });
    return `Zaktualizowano warsztat`;
  }
  if (type === "delete_workshop") {
    const id = await resolveWorkshop();
    await deleteWorkshop(id);
    return `Usunięto warsztat`;
  }

  const findItem = (ids: string[], q: string) =>
    prisma.workshopItem.findFirst({ where: { workshopId: { in: ids }, name: { contains: q, mode: "insensitive" } }, select: { id: true } });
  const findItemById = (id: string) => prisma.workshopItem.findFirst({ where: { id }, select: { id: true } });
  const resolveItem = () => resolveWithinWorkshops(findItem, asStr(params.itemId), findItemById, searchQuery ?? asStr(params.name), "pozycja wyposażenia");

  if (type === "update_workshop_item") {
    const id = await resolveItem();
    await updateWorkshopItem(id, { name: asStr(params.newName), kind: asStr(params.kind), category: asStr(params.category), unit: asStr(params.unit) });
    return `Zaktualizowano pozycję wyposażenia`;
  }
  if (type === "delete_workshop_item") {
    const id = await resolveItem();
    await deleteWorkshopItem(id);
    return `Usunięto pozycję wyposażenia`;
  }
  if (type === "adjust_workshop_item") {
    const id = await resolveItem();
    const delta = Number(params.delta);
    if (!Number.isFinite(delta) || delta === 0) throw new Error("Podaj zmianę ilości (delta ≠ 0)");
    await adjustWorkshopItemQuantity(id, delta);
    return `Zmieniono ilość o ${delta > 0 ? "+" : ""}${delta}`;
  }

  const findProject = (ids: string[], q: string) =>
    prisma.workshopProject.findFirst({ where: { workshopId: { in: ids }, name: { contains: q, mode: "insensitive" } }, select: { id: true } });
  const findProjectById = (id: string) => prisma.workshopProject.findFirst({ where: { id }, select: { id: true } });

  if (type === "add_workshop_project") {
    const wsId = await resolveWorkshop();
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę projektu");
    await addWorkshopProject(wsId, { name, description: asStr(params.description) ?? null, status: asStr(params.status) });
    return `Dodano projekt warsztatowy „${name}"`;
  }
  if (type === "update_workshop_project" || type === "delete_workshop_project") {
    const id = await resolveWithinWorkshops(findProject, asStr(params.projectId), findProjectById, searchQuery ?? asStr(params.name), "projekt warsztatowy");
    if (type === "delete_workshop_project") { await deleteWorkshopProject(id); return `Usunięto projekt warsztatowy`; }
    await updateWorkshopProject(id, { name: asStr(params.newName), description: asStr(params.description), status: asStr(params.status) });
    return `Zaktualizowano projekt warsztatowy`;
  }

  throw new Error(`Nieznany typ akcji warsztatów: ${type}`);
}
