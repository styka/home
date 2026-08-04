export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getModuleStats } from "@/modules/qa/contract";
import { QaHomePage } from "@/modules/qa/ui/QaHomePage";

export default async function QaRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.QA) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const stats = await getModuleStats();
  const totalScenarios = stats.reduce((sum, s) => sum + s.scenarioCount, 0);
  const totalEpics = stats.reduce((sum, s) => sum + s.epicCount, 0);
  const totalStories = stats.reduce((sum, s) => sum + s.storyCount, 0);
  const modulesCovered = stats.filter((s) => s.scenarioCount > 0).length;

  return (
    <QaHomePage
      stats={stats}
      totalScenarios={totalScenarios}
      totalEpics={totalEpics}
      totalStories={totalStories}
      modulesCovered={modulesCovered}
      isAdmin={hasPermission(session, PERMISSIONS.ADMIN)}
    />
  );
}
