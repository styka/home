import type { DashboardContributor, DashboardContext } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { prisma } from "@/platform/db/prisma";

/** 050: wkład Notatek — liczba przypiętych. Zapytanie przeniesione bez zmiany. */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "pinnedNotes">> = async (userId, ctx) => ({
  pinnedNotes: await prisma.note.count({
    where: {
      OR: [{ ownerId: userId }, ...(ctx.teamIds.length > 0 ? [{ ownerTeamId: { in: ctx.teamIds } }] : [])],
      pinned: true,
    },
  }),
});

export default wklad;
