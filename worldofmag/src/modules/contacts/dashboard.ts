import { prisma } from "@/platform/db/prisma";
import { ownedByWhere } from "@/platform/auth/ownership";
import { SUFIT_LISTY } from "@/platform/pagination";
import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot, UpcomingBirthday } from "../home/contract";

/** „YYYY-MM-DD" w czasie lokalnym — ten sam format co klucz dnia kalendarza. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 115 (Z-INT-17): wkład Kontaktów do migawki pulpitu — urodziny w najbliższych 30 dniach.
 *
 * Ta sama konwencja co wkład do kalendarza (114): miesiąc/dzień czytane w UTC (urodziny są
 * zapisane jako północ UTC dnia kalendarzowego), rocznica liczona na południe czasu lokalnego,
 * 29 lutego w roku nieprzestępnym przelewa się na 1 marca.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "upcomingBirthdays">> = async (userId, ctx) => {
  try {
    const kontakty = await prisma.contact.findMany({
      take: SUFIT_LISTY,
      where: { ...(await ownedByWhere(userId)), birthday: { not: null } },
      select: { id: true, name: true, birthday: true },
    });

    const horyzont = new Date(ctx.todayStart.getTime() + 30 * 86_400_000);
    const upcomingBirthdays: UpcomingBirthday[] = [];
    for (const k of kontakty) {
      if (!k.birthday) continue;
      const m = k.birthday.getUTCMonth();
      const d = k.birthday.getUTCDate();
      for (const rok of [ctx.todayStart.getFullYear(), ctx.todayStart.getFullYear() + 1]) {
        const rocznica = new Date(rok, m, d, 12, 0, 0, 0);
        if (rocznica >= ctx.todayStart && rocznica < horyzont) {
          upcomingBirthdays.push({ id: k.id, name: k.name, date: isoDay(rocznica) });
          break;
        }
      }
    }
    upcomingBirthdays.sort((a, b) => a.date.localeCompare(b.date));
    return { upcomingBirthdays: upcomingBirthdays.slice(0, 4) };
  } catch {
    return { upcomingBirthdays: [] };
  }
};

export default wklad;
