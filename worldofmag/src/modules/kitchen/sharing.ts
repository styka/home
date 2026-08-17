import { prisma } from "@/platform/db/prisma";
import type { ResourceCatalog } from "@/platform/sharing/types";

/**
 * 064 (zadanie 13, moduły 4–5 z 6) — DEKLARACJA ZASOBÓW KUCHNI.
 *
 * Przepis jest jedynym zasobem w aplikacji z dostępem **bez żadnej relacji**: `isPublic` pozwala
 * obcemu **czytać**, ale nie edytować. Wyrażamy to przez `publicRole` — pole faktów dołożone
 * w 064 właśnie po to, żeby nie trzeba było zostawiać Kuchni przy własnym guardzie.
 */
export const resources: ResourceCatalog = {
  "kitchen.recipe": {
    label: "Przepis",
    operations: {
      "recipe.read": "viewer",
      "recipe.edit": "editor",
    },
    teamOwnership: { member: "manager", admin: "manager" },
    resolve: async (id) => {
      // 079 (etap 4): własność wyraża wyłącznie przestrzeń; `isPublic` zostaje, bo publiczność
      // przepisu nie jest własnością i nigdy nią nie była.
      const r = await prisma.recipe.findUnique({
        where: { id },
        select: { workspaceId: true, isPublic: true },
      });
      if (!r) return null;
      return {
        workspaceId: r.workspaceId,
        // `viewer`, nie `editor`: publiczny znaczy „do czytania", nie „do zmieniania".
        publicRole: r.isPublic ? ("viewer" as const) : null,
      };
    },
  },

  "kitchen.cookbook": {
    label: "Książka kucharska",
    operations: {
      "cookbook.read": "viewer",
      "cookbook.edit": "editor",
    },
    teamOwnership: { member: "manager", admin: "manager" },
    resolve: async (id) => {
      const c = await prisma.cookbook.findUnique({
        where: { id },
        select: { workspaceId: true },
      });
      if (!c) return null;
      return { workspaceId: c.workspaceId };
    },
  },
};

export default resources;
