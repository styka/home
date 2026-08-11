import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import type { DashboardSnapshot } from "@/modules/home/contract";
import { collectDashboardSnapshot } from "@/lib/dashboardSnapshot";

/**
 * 050/T-2 — MIGAWKA PULPITU WYODRĘBNIONA Z TRASY. **Czysta przenosina.**
 *
 * Powód jest jeden i konkretny: dopóki te obliczenia żyły w ciele komponentu trasy, nie dało się ich
 * **zawołać** — a bez tego nie ma jak zrzucić wyniku „przed" i porównać go z „po". 049 odłożyło
 * z tego powodu rozbicie pulpitu na wkłady modułowe: przenoszenie jedenastu bloków obliczeń, którego
 * jedynym sprawdzeniem byłby kompilator, to ryzyko cichej regresji na produkcji.
 *
 * Funkcja bierze `userId` i `permissions` **parametrem** — nie sięga po sesję, więc da się ją wywołać
 * ze skryptu (tak samo jak `collectCalendarEvents`). Treść jest przeniesiona 1:1: te same zapytania,
 * ta sama kolejność, te same `try/catch` i te same wartości domyślne.
 *
 * **Stan po T-8: wszystkie jedenaście wkładów MODUŁOWYCH pochodzi już z deklaracji.** Zostały tu
 * wyłącznie statystyki admina — dane przekrojowe, które nie należą do żadnego modułu (spis
 * użytkowników, zespołów i raportów całej instalacji). W T-10 znikną razem z tym plikiem, wracając
 * do trasy z zapisanym powodem.
 */
export async function collectDashboardSnapshotLegacy(
  userId: string,
  userPermissions: string[],
  isAdmin: boolean,
): Promise<DashboardSnapshot & { adminStats: { userCount: number; teamCount: number; reportCount: number } | null }> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const teamIds = await getUserTeamIds(userId);

  // 050: aktywność i zaproszenia WYPADŁY z tej funkcji — sięgają po sesję (`headers()`), więc
  // wywołane ze skryptu rzucają „headers was called outside a request scope". To dane konta, nie
  // modułu; zostają w trasie zgodnie z planem §7.4. Zrzut je wykrył od razu.

  // Statystyki admina — dane przekrojowe, poza jakimkolwiek modułem (patrz nagłówek).
  let adminStats: { userCount: number; teamCount: number; reportCount: number } | null = null;
  if (isAdmin) {
    const [userCount, teamCount, reportCount] = await Promise.all([
      prisma.user.count(),
      prisma.team.count(),
      prisma.report.count(),
    ]);
    adminStats = { userCount, teamCount, reportCount };
  }

  const zDeklaracji = await collectDashboardSnapshot(userId, userPermissions, { todayStart, todayEnd, teamIds });

  return { ...zDeklaracji, adminStats };
}
