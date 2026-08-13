import { getExpiringStorage, getLowStock, getStorageAnalytics, getSuppliers } from "../contract";
import { getUserTeamIds, ownedWhereAsync } from "@/platform/auth/serverUtils";
import { prisma } from "@/platform/db/prisma";
import { clampLimit, asStr } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_storage_items: args { search?, warehouse?, lowStockOnly?, limit? } → [{ id, name, quantity, unit, warehouse, location, minQuantity }]. Pozycje magazynu (dom/firma). lowStockOnly=true zwraca tylko poniżej stanu minimalnego.",
  "- list_suppliers: args {} → [{ id, name, contact, email, phone }]. Dostawcy (magazyn Pro).",
  "- list_low_stock: args {} → [{ id, name, quantity, minQuantity, warehouse }]. Pozycje magazynu poniżej stanu minimalnego.",
  "- list_expiring_storage: args { days? } → [{ name, quantity, expiresAt, warehouse }]. Partie/pozycje magazynu z bliskim terminem (domyślnie 30 dni).",
  "- get_storage_analytics: args {} → { totalValue, deadStock, abc, … }. Analityka magazynu (wartość, dead-stock, ABC).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_storage_items: async (args, userId) => {
      const search = asStr(args.search);
      const warehouse = asStr(args.warehouse);
      const lowStockOnly = args.lowStockOnly === true || args.lowStockOnly === "true";
      const teamIds = await getUserTeamIds(userId);
      const items = await prisma.storageItem.findMany({
        where: {
          ...(await ownedWhereAsync(userId)),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          ...(warehouse ? { warehouse: { contains: warehouse, mode: "insensitive" } } : {}),
          ...(lowStockOnly ? { minQuantity: { not: null } } : {}),
        },
        orderBy: [{ warehouse: "asc" }, { name: "asc" }],
        take: clampLimit(args.limit),
      });
      const filtered = lowStockOnly
        ? items.filter((i) => i.minQuantity != null && (i.quantity ?? 0) < i.minQuantity)
        : items;
      return filtered.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        warehouse: i.warehouse,
        location: i.location,
        minQuantity: i.minQuantity,
      }));
  },
  list_suppliers: async (args, userId) => {
      const suppliers = await getSuppliers();
      return suppliers.map((s) => ({ id: s.id, name: s.name, contact: s.contact, email: s.email, phone: s.phone }));
  },
  list_low_stock: async (args, userId) => {
      const items = await getLowStock();
      return items.slice(0, clampLimit(args.limit)).map((i) => ({
        id: i.id, name: i.name, quantity: i.quantity, minQuantity: i.minQuantity, warehouse: i.warehouse,
      }));
  },
  list_expiring_storage: async (args, userId) => {
      const days = typeof args.days === "number" ? Math.max(1, Math.min(365, args.days)) : 30;
      return getExpiringStorage(days);
  },
  get_storage_analytics: async (args, userId) => {
      return getStorageAnalytics();
  },
};
