import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { prisma } from "@/platform/db/prisma";

import { ownedWhereAsync } from "@/platform/auth/serverUtils";
/** 050: wkład Notatek — liczba przypiętych. Zapytanie przeniesione bez zmiany. */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "pinnedNotes">> = async (userId, ctx) => ({
  pinnedNotes: await prisma.note.count({
    where: {
      ...(await ownedWhereAsync(userId)),
      pinned: true,
    },
  }),
});

export default wklad;
