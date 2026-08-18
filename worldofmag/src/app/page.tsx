export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { getRecentActivity } from "@/actions/activity";
import { getPendingInvitationsCount } from "@/actions/invitations";
import { getDashboardPrefs } from "@/actions/dashboardPrefs";
import { readFavoriteViews } from "@/actions/favoriteViews";
import { cachowanaMigawkaPulpitu } from "@/lib/cacheAgregatow";
import { HomePage } from "@/modules/home/ui/HomePage";

/**
 * 050 — TRASA PULPITU SKŁADA MIGAWKĘ Z KATALOGU MODUŁÓW.
 *
 * Wcześniej ten plik importował **osiem kontraktów modułów** i miał dziesięć gałęzi na uprawnienia.
 * Było to ostatnie miejsce w aplikacji, w którym dodanie modułu wymagało edycji cudzego pliku —
 * jedyny wyłom w odpowiedzi „jeden katalog plus jeden import w korzeniu kompozycji" (rozdz. 14).
 * Dziś moduł deklaruje swój wkład u siebie (`module.server.ts` → `dashboard`), a `HomePage`
 * dostaje dokładnie te same dane.
 *
 * **Co ZOSTAJE tutaj i dlaczego.** Nie wszystko na pulpicie należy do modułu:
 * - **aktywność, zaproszenia, preferencje, ulubione widoki** — dane KONTA; sięgają po sesję,
 *   a nie po dziedzinę modułu;
 * - **statystyki admina** — przekrój całej instalacji (użytkownicy, zespoły, raporty); nie ma
 *   modułu, którego byłyby własnością, a wciśnięcie ich w jakiś na siłę byłoby gorsze niż
 *   zostawienie ich w kompozycji z zapisanym powodem (spec §9).
 */
export default async function HomePageRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const userRoles: string[] = session.user.roles ?? [];
  const userPermissions: string[] = session.user.permissions ?? [];
  const isAdmin = userRoles.includes("ADMIN");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const teamIds = await getUserTeamIds(userId);

  // 085 (zadanie 29): migawka przez cache agregatów. Klucz niesie stempel przestrzeni (unieważnia
  // się sam, we wszystkich instancjach) i odcisk uprawnień — bez tego drugiego odebranie dostępu do
  // modułu zostawiłoby jego dane na pulpicie do wygaśnięcia wpisu.
  const snapshot = await cachowanaMigawkaPulpitu(userId, userPermissions, { now, todayStart, todayEnd, teamIds });

  // Dane KONTA, nie modułu — sięgają po sesję, więc zostają w trasie (plan §7.4).
  const [recentActivity, pendingInvitations] = await Promise.all([
    getRecentActivity(20),
    getPendingInvitationsCount(),
  ]);
  const recentActivityForUI = recentActivity.map((a) => ({
    module: a.module,
    action: a.action,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    metadata: (a.metadata as Record<string, unknown> | null) ?? null,
  }));
  const dashboardPrefs = await getDashboardPrefs();
  const favoriteViews = await readFavoriteViews(userId).catch(() => []);

  // Przekrój całej instalacji — poza jakimkolwiek modułem (patrz nagłówek).
  let adminStats: { userCount: number; teamCount: number; reportCount: number } | null = null;
  if (isAdmin) {
    const [userCount, teamCount, reportCount] = await Promise.all([
      prisma.user.count(),
      prisma.team.count(),
      prisma.report.count(),
    ]);
    adminStats = { userCount, teamCount, reportCount };
  }

  return (
    <HomePage
      dashboardPrefs={dashboardPrefs}
      favoriteViews={favoriteViews}
      userName={session.user.name ?? null}
      userRoles={userRoles}
      userPermissions={userPermissions}
      isAdmin={isAdmin}
      {...snapshot}
      adminStats={adminStats}
      recentActivity={recentActivityForUI}
      pendingInvitations={pendingInvitations}
    />
  );
}
