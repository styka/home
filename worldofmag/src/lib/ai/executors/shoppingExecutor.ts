// Z-010: handler akcji asystenta dla modułu Zakupy (listy + pozycje).
// Scala oba dawne bloki `module === "shopping"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { addItem, updateItem, updateItemStatus, deleteItem, clearDoneItems, markAllInCart } from "@/actions/items";
import { createList, renameList, archiveList, deleteList } from "@/actions/lists";
import { asStr, undoAction, resolveOrCreateList, resolveListId, resolveItemId, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";
import type { ItemStatus } from "@/types";

export async function executeShoppingAction(action: AIAction, userId: string, activeListId?: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "add_item") {
    const rawText = (params.rawText as string) ?? "";
    const list = await resolveOrCreateList(userId, {
      listId: asStr(params.listId),
      listName: asStr(params.listName),
      activeListId,
    });
    const item = await addItem(list.id, rawText.trim() || "Produkt");
    const msg = `Dodano "${item.name}" do listy "${list.name}"`;
    const undo = undoAction("shopping", "delete_item", { itemId: item.id }, `Usuń "${item.name}" z listy "${list.name}"`);
    if (params.openAfter === true) {
      return { message: msg, undo, navigateTo: `/shopping/${list.id}`, navigateLabel: `Otwórz „${list.name}”` };
    }
    return { message: msg, undo };
  }

  if (type === "update_item_status") {
    const status = (asStr(params.status) ?? "DONE") as ItemStatus;
    const id = await resolveItemId(userId, params, searchQuery);
    const before = await prisma.item.findUnique({ where: { id }, select: { status: true } });
    const item = await updateItemStatus(id, status);
    const undo = before
      ? { ...undoAction("shopping", "update_item_status", { itemId: id, status: before.status }, `Przywróć status "${item.name}" → ${before.status}`), searchQuery: item.name }
      : undefined;
    return { message: `Zaktualizowano status "${item.name}" → ${status}`, undo };
  }

  if (type === "update_item") {
    const id = await resolveItemId(userId, params, searchQuery);
    const patch: Parameters<typeof updateItem>[1] = {};
    if (params.name !== undefined) patch.name = String(params.name);
    if (params.quantity !== undefined) {
      const q = asStr(params.quantity) ?? (params.quantity as number | null | undefined);
      patch.quantity = q == null || q === "" ? null : Number(q);
    }
    if (params.unit !== undefined) patch.unit = asStr(params.unit) ?? null;
    const item = await updateItem(id, patch);
    return `Zaktualizowano "${item.name}"`;
  }

  if (type === "delete_item") {
    const id = await resolveItemId(userId, params, searchQuery);
    const existing = await prisma.item.findUnique({ where: { id }, select: { name: true } });
    await deleteItem(id);
    return `Usunięto "${existing?.name ?? "produkt"}" z listy zakupów`;
  }

  if (type === "create_list") {
    const name = asStr(params.name) ?? "Nowa lista";
    const list = await createList(name);
    const msg = `Utworzono listę "${list.name}"`;
    const undo = undoAction("shopping", "delete_list", { listId: list.id }, `Usuń listę "${list.name}"`);
    if (params.openAfter === true) {
      return { message: msg, undo, navigateTo: `/shopping/${list.id}`, navigateLabel: `Otwórz „${list.name}”` };
    }
    return { message: msg, undo };
  }

  if (type === "rename_list") {
    const id = await resolveListId(userId, params, searchQuery, activeListId);
    const name = asStr(params.name) ?? "Lista";
    const before = await prisma.shoppingList.findUnique({ where: { id }, select: { name: true } });
    const list = await renameList(id, name);
    const undo = before
      ? { ...undoAction("shopping", "rename_list", { listId: id, name: before.name }, `Przywróć nazwę listy → "${before.name}"`), searchQuery: name }
      : undefined;
    return { message: `Zmieniono nazwę listy na "${list.name}"`, undo };
  }

  if (type === "archive_list") {
    const id = await resolveListId(userId, params, searchQuery, activeListId);
    await archiveList(id);
    return `Zarchiwizowano listę`;
  }

  if (type === "delete_list") {
    const id = await resolveListId(userId, params, searchQuery, activeListId);
    const meta = await prisma.shoppingList.findUnique({ where: { id }, select: { name: true, _count: { select: { items: true } } } });
    await deleteList(id);
    const n = meta?._count.items ?? 0;
    // Ostrzeżenie post-hoc: jawnie mówimy, ile pozycji zniknęło wraz z listą.
    return n > 0
      ? `Usunięto listę "${meta?.name ?? ""}" wraz z ${n} ${n === 1 ? "pozycją" : "pozycjami"}`
      : `Usunięto pustą listę "${meta?.name ?? ""}"`;
  }

  if (type === "clear_done_items") {
    const id = await resolveListId(userId, params, searchQuery, activeListId);
    await clearDoneItems(id);
    return `Wyczyszczono kupione pozycje z listy`;
  }

  if (type === "mark_all_in_cart") {
    const id = await resolveListId(userId, params, searchQuery, activeListId);
    await markAllInCart(id);
    return `Oznaczono wszystkie pozycje jako w koszyku`;
  }

  throw new Error(`Nieznany typ akcji zakupów: ${type}`);
}
