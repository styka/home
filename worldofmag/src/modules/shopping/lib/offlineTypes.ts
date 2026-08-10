// Typy współdzielone przez warstwę offline Zakupów (klient) i akcję synchronizującą
// (serwer). Zwykły moduł TS (bez "use server"), żeby import był bezpieczny po obu stronach.
//
// Feature: 009-shopping-offline-sync — kolejka operacji na POZYCJACH wykonanych bez sieci,
// odtwarzana po powrocie połączenia regułą „ostatni zapis wygrywa" (LWW wg `ts`).

import type { ItemStatus, ShoppingListWithItems } from "@/types";

/** Rodzaj operacji na pozycji, zakolejkowanej offline. Bez enumów Prisma (C-12) — union TS. */
export type OfflineOpType = "status" | "add" | "update" | "delete";

/** Ładunek operacji — pola zależne od `type`. */
export interface OfflineOpPayload {
  name?: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  price?: number | null;
  category?: string;
  status?: ItemStatus;
}

/**
 * Pojedyncza operacja w kolejce offline.
 * - `opId` — uuid operacji (idempotencja + usuwanie z kolejki po sync).
 * - `ts`   — czas wykonania offline (ms) — do reguły „ostatni zapis wygrywa".
 * - `itemId` — finalne id pozycji; dla `add` generowane po stronie klienta (crypto.randomUUID()),
 *   dzięki czemu kolejne operacje (status/update/delete) na tej samej pozycji nie wymagają remapowania.
 */
export interface OfflineOp {
  opId: string;
  ts: number;
  type: OfflineOpType;
  listId: string;
  itemId: string;
  payload?: OfflineOpPayload;
}

/** Wynik synchronizacji kolejki: identyfikatory operacji zastosowanych i pominiętych. */
export interface SyncResult {
  applied: string[];
  skipped: string[];
}

/** Lokalna kopia list zakupów (snapshot) trzymana w localStorage do pracy offline. */
export interface OfflineSnapshot {
  savedAt: number;
  lists: ShoppingListWithItems[];
}
