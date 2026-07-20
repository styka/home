"use client";

// Wspólne API mutacji na pozycjach Zakupów (feature 009-shopping-offline-sync).
// Komponenty (ItemRow, QuickAddBar, ShoppingPage) wołają te funkcje zamiast bezpośrednio
// Server Actions. Decyzja online/offline zapada tutaj:
//   • ONLINE  → istniejąca Server Action (bez regresji — zachowanie jak dziś).
//   • OFFLINE → optymistyczna zmiana w snapshotcie + operacja do kolejki (replay po powrocie sieci).
// Dodatkowo: jeśli sieć padnie w trakcie żądania online, łapiemy błąd i degradujemy do kolejki.

import { updateItemStatus, updateItem, deleteItem, addItemStructured } from "@/actions/items";
import { categorize } from "@/lib/categorize";
import type { ItemStatus } from "@/types";
import { enqueue } from "./offlineStore";
import type { OfflineOp, OfflineOpPayload, OfflineOpType } from "./offlineTypes";

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `off_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function queueOp(type: OfflineOpType, listId: string, itemId: string, payload?: OfflineOpPayload): void {
  const op: OfflineOp = { opId: newId(), ts: Date.now(), type, listId, itemId, payload };
  enqueue(op);
}

/** Zmiana statusu pozycji. */
export async function mutSetStatus(listId: string, itemId: string, status: ItemStatus): Promise<void> {
  if (isOnline()) {
    try {
      await updateItemStatus(itemId, status);
      return;
    } catch (err) {
      if (isOnline()) throw err; // realny błąd, nie utrata sieci
    }
  }
  queueOp("status", listId, itemId, { status });
}

/** Dodanie nowej pozycji. Zwraca id (dla offline — id wygenerowane po stronie klienta). */
export async function mutAdd(
  listId: string,
  name: string,
  quantity: number | null,
  unit: string | null,
  category?: string,
): Promise<string> {
  if (isOnline()) {
    try {
      const item = await addItemStructured(listId, name, quantity, unit, category);
      return item.id;
    } catch (err) {
      if (isOnline()) throw err;
    }
  }
  const itemId = newId();
  const resolvedCategory = category?.trim() || categorize(name.trim());
  queueOp("add", listId, itemId, {
    name: name.trim().toLowerCase(),
    quantity,
    unit,
    category: resolvedCategory,
    status: "NEEDED",
  });
  return itemId;
}

/** Edycja pól pozycji (nazwa/ilość/jednostka/notatka/cena). */
export async function mutUpdate(
  listId: string,
  itemId: string,
  patch: Pick<OfflineOpPayload, "name" | "quantity" | "unit" | "notes" | "price">,
): Promise<void> {
  if (isOnline()) {
    try {
      await updateItem(itemId, patch);
      return;
    } catch (err) {
      if (isOnline()) throw err;
    }
  }
  queueOp("update", listId, itemId, patch);
}

/** Usunięcie pozycji. */
export async function mutRemove(listId: string, itemId: string): Promise<void> {
  if (isOnline()) {
    try {
      await deleteItem(itemId);
      return;
    } catch (err) {
      if (isOnline()) throw err;
    }
  }
  queueOp("delete", listId, itemId);
}
