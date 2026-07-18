"use client";

// Warstwa trwałości offline dla Zakupów (feature 009-shopping-offline-sync).
// Trzyma w localStorage dwie rzeczy:
//   1. SNAPSHOT — kopię aktywnych list zakupów z pozycjami (do odczytu offline),
//   2. QUEUE    — kolejkę operacji na pozycjach wykonanych bez sieci.
// Zero zależności (localStorage + JSON), zgodnie z wzorcem repo (try/catch wokół storage).
// Po każdej zmianie emitujemy zdarzenie `window` `wom:shopping-offline-changed`, żeby UI
// (widok listy + wskaźnik) odświeżało się reaktywnie.

import type { Item, ShoppingListWithItems } from "@/types";
import type { OfflineOp, OfflineSnapshot } from "./offlineTypes";

const SNAPSHOT_KEY = "wom_shopping_offline_lists";
const QUEUE_KEY = "wom_shopping_offline_queue";
export const OFFLINE_CHANGED_EVENT = "wom:shopping-offline-changed";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // brak miejsca / prywatny tryb — degradujemy łagodnie (zachowanie jak online-only)
  }
}

/** Powiadamia UI o zmianie snapshotu/kolejki. */
export function emitOfflineChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_CHANGED_EVENT));
}

/** Subskrypcja zmian snapshotu/kolejki. Zwraca funkcję odpinającą. */
export function onOfflineChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OFFLINE_CHANGED_EVENT, cb);
  return () => window.removeEventListener(OFFLINE_CHANGED_EVENT, cb);
}

// ─── Snapshot ───────────────────────────────────────────────────────────────

/** Zapisuje kopię wszystkich (aktywnych) list z pozycjami do pracy offline. */
export function saveSnapshot(lists: ShoppingListWithItems[]): void {
  const snapshot: OfflineSnapshot = { savedAt: Date.now(), lists };
  writeJSON(SNAPSHOT_KEY, snapshot);
  emitOfflineChanged();
}

export function getSnapshot(): OfflineSnapshot | null {
  return readJSON<OfflineSnapshot | null>(SNAPSHOT_KEY, null);
}

/**
 * Nadpisuje pojedynczą listę w snapshotcie (np. bieżąco otwartą, świeżo pobraną online),
 * nie ruszając pozostałych. Gdy snapshot nie istnieje — tworzy go z tą jedną listą.
 */
export function upsertListSnapshot(list: ShoppingListWithItems): void {
  const snap = getSnapshot() ?? { savedAt: Date.now(), lists: [] };
  const idx = snap.lists.findIndex((l) => l.id === list.id);
  if (idx >= 0) snap.lists[idx] = list;
  else snap.lists.push(list);
  snap.savedAt = Date.now();
  writeJSON(SNAPSHOT_KEY, snap);
  emitOfflineChanged();
}

// ─── Kolejka operacji ─────────────────────────────────────────────────────────

export function getQueue(): OfflineOp[] {
  return readJSON<OfflineOp[]>(QUEUE_KEY, []);
}

export function pendingCount(): number {
  return getQueue().length;
}

/** Dokłada operację do kolejki i stosuje ją optymistycznie do snapshotu. */
export function enqueue(op: OfflineOp): void {
  const queue = getQueue();
  queue.push(op);
  writeJSON(QUEUE_KEY, queue);
  applyOpToSnapshot(op);
  emitOfflineChanged();
}

/** Usuwa z kolejki operacje o podanych opId (po udanej synchronizacji). */
export function removeOps(opIds: string[]): void {
  if (opIds.length === 0) return;
  const drop = new Set(opIds);
  const queue = getQueue().filter((op) => !drop.has(op.opId));
  writeJSON(QUEUE_KEY, queue);
  emitOfflineChanged();
}

/**
 * Optymistycznie aplikuje operację do lokalnej kopii listy, żeby UI natychmiast
 * pokazało zmianę offline (odczyt spod tego samego snapshotu).
 */
export function applyOpToSnapshot(op: OfflineOp): void {
  const snap = getSnapshot();
  if (!snap) return;
  const list = snap.lists.find((l) => l.id === op.listId);
  if (!list) return;

  switch (op.type) {
    case "status": {
      const it = list.items.find((i) => i.id === op.itemId);
      if (it && op.payload?.status) it.status = op.payload.status;
      break;
    }
    case "add": {
      if (list.items.some((i) => i.id === op.itemId)) break; // idempotencja
      const now = new Date();
      const newItem: Item = {
        id: op.itemId,
        listId: op.listId,
        name: op.payload?.name ?? "",
        quantity: op.payload?.quantity ?? null,
        unit: op.payload?.unit ?? null,
        category: op.payload?.category?.trim() || "Inne",
        status: op.payload?.status ?? "NEEDED",
        notes: op.payload?.notes ?? null,
        price: op.payload?.price ?? null,
        priority: 0,
        order: 0,
        createdAt: now,
        updatedAt: now,
      };
      list.items.push(newItem);
      break;
    }
    case "update": {
      const it = list.items.find((i) => i.id === op.itemId);
      if (it && op.payload) {
        if (op.payload.name !== undefined) it.name = op.payload.name;
        if (op.payload.quantity !== undefined) it.quantity = op.payload.quantity;
        if (op.payload.unit !== undefined) it.unit = op.payload.unit;
        if (op.payload.notes !== undefined) it.notes = op.payload.notes;
        if (op.payload.price !== undefined) it.price = op.payload.price;
      }
      break;
    }
    case "delete": {
      list.items = list.items.filter((i) => i.id !== op.itemId);
      break;
    }
  }
  writeJSON(SNAPSHOT_KEY, snap);
}
