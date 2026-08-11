export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getRecentActivity } from "@/actions/activity";
import { getPendingInvitationsCount } from "@/actions/invitations";
import { getDashboardPrefs } from "@/actions/dashboardPrefs";
import { readFavoriteViews } from "@/actions/favoriteViews";
import { collectDashboardSnapshotLegacy } from "@/lib/dashboardLegacy";
import { HomePage } from "@/modules/home/ui/HomePage";

export default async function HomePageRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const userRoles: string[] = session.user.roles ?? [];
  const userPermissions: string[] = session.user.permissions ?? [];
  const isAdmin = userRoles.includes("ADMIN");

  const snapshot = await collectDashboardSnapshotLegacy(userId, userPermissions, isAdmin);
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

  return (
    <HomePage
      dashboardPrefs={dashboardPrefs}
      favoriteViews={favoriteViews}
      userName={session.user.name ?? null}
      userRoles={userRoles}
      userPermissions={userPermissions}
      isAdmin={isAdmin}
      {...snapshot}
      recentActivity={recentActivityForUI}
      pendingInvitations={pendingInvitations}
    />
  );
}
