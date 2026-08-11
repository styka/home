import type { DashboardContributor, DashboardContext } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { prisma } from "@/platform/db/prisma";

/**
 * 050: wkład Raportów — ile raportów powstało w ostatnich siedmiu dniach.
 *
 * **Trasa liczyła to wprost z Prismy**, razem z filtrem dostępu — czyli sięgała po dane modułu
 * z pominięciem jego kontraktu. Przy okazji tej przebudowy sprzężenie znika.
 *
 * **Raporty nie mają uprawnienia modułowego** (`permission: null` — powierzchnia dostępna każdemu
 * zalogowanemu), więc korzeń kompozycji woła ten wkład zawsze. Potwierdził to zrzut „bez uprawnień"
 * z T-3: `recentReports` było tam jedynym niezerowym polem.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "recentReports">> = async (userId, ctx) => {
  const sevenDaysAgo = new Date(ctx.todayEnd);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return {
    recentReports: await prisma.report.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        OR: [
          { authorId: userId },
          { authorId: null },
          ...(ctx.teamIds.length > 0 ? [{ teamId: { in: ctx.teamIds } }] : []),
        ],
      },
    }),
  };
};

export default wklad;
