import { prisma } from "@/platform/db/prisma";
import type { ResourceCatalog } from "@/platform/sharing/types";

/**
 * 064 (zadanie 13, moduł 3 z 6) — DEKLARACJA ZASOBÓW ZAKUPÓW.
 *
 * `assertListAccess` ma dwa poziomy: właściciel albo członek zespołu-właściciela. Nie rozróżnia
 * odczytu od edycji — kto ma dostęp do listy, ten może wszystko. Odwzorowanie musi być **tak samo
 * płytkie**: `member: "manager"`, bo `editor` zabrałby prawa, których dziś nikt nie odbiera.
 */
export const resources: ResourceCatalog = {
  "shopping.list": {
    label: "Lista zakupów",
    operations: {
      "list.read": "viewer",
      "list.edit": "editor",
    },
    teamOwnership: { member: "manager", admin: "manager" },
    resolve: async (id) => {
      const l = await prisma.shoppingList.findUnique({
        where: { id },
        select: { workspaceId: true, ownerId: true, ownerTeamId: true },
      });
      if (!l) return null;
      return { workspaceId: l.workspaceId, ownerId: l.ownerId, ownerTeamId: l.ownerTeamId };
    },
  },
};

export default resources;
