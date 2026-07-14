// Z-010: handler akcji asystenta dla modułu Magazynowanie.
// Scala oba dawne bloki `module === "magazynowanie"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import { addStorageItem, adjustStorageQuantity, updateStorageItem, deleteStorageItem, transferStock } from "@/actions/storage";
import { asStr, undoAction, resolveByName, ownerOrArr, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeStorageAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "add_storage_item") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę pozycji");
    await addStorageItem({
      name,
      quantity: params.quantity != null ? Number(params.quantity) : null,
      unit: asStr(params.unit) ?? null,
      warehouse: asStr(params.warehouse) ?? null,
      location: asStr(params.location) ?? null,
      category: asStr(params.category) ?? null,
    });
    return `Dodano do magazynu: ${name}`;
  }

  if (type === "adjust_storage") {
    const delta = Number(params.delta);
    if (!delta || isNaN(delta)) throw new Error("Podaj zmianę ilości (np. -3)");
    const query = searchQuery?.trim();
    if (!query) throw new Error("Wskaż pozycję magazynową");
    const teamIds = await getUserTeamIds(userId);
    const item = await prisma.storageItem.findFirst({
      where: {
        OR: [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }],
        name: { contains: query, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!item) throw new Error(`Nie znaleziono pozycji „${query}" w magazynie`);
    const updated = await adjustStorageQuantity(item.id, delta, delta > 0 ? "przyjęcie" : "wydanie", "AI");
    // Odwrócenie = przeciwna korekta o tę samą wartość.
    const undo = { ...undoAction("magazynowanie", "adjust_storage", { delta: -delta }, `Cofnij korektę stanu — ${item.name}`), searchQuery: item.name };
    return { message: `${delta > 0 ? "Przyjęto" : "Wydano"} ${Math.abs(delta)} — ${item.name} (stan: ${updated.quantity ?? 0})`, undo };
  }

  const teamOr = await ownerOrArr(userId);
  const resolveStorage = () => resolveByName((w) => prisma.storageItem.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.itemId), "name", searchQuery ?? asStr(params.name), "pozycja magazynu");
  if (type === "update_storage_item") {
    const id = await resolveStorage();
    await updateStorageItem(id, { name: asStr(params.name), unit: asStr(params.unit), warehouse: asStr(params.warehouse), location: asStr(params.location) });
    return `Zaktualizowano pozycję magazynu`;
  }
  if (type === "delete_storage_item") {
    const id = await resolveStorage();
    await deleteStorageItem(id);
    return `Usunięto pozycję magazynu`;
  }
  if (type === "transfer_storage") {
    const id = await resolveStorage();
    await transferStock(id, asStr(params.toWarehouse) ?? null, asStr(params.toLocation) ?? null, Number(params.quantity ?? 0));
    return `Przeniesiono pozycję magazynu`;
  }

  throw new Error(`Nieznany typ akcji magazynu: ${type}`);
}
