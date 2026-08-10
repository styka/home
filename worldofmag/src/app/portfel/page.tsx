export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import portfelModule from "@/modules/portfel/module";
import { getWalletOverview } from "@/modules/portfel/actions/portfel";
import { getMyTeams } from "@/actions/teams";
import { PortfelHomePage } from "@/modules/portfel/ui/PortfelHomePage";

export default async function PortfelRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, portfelModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const [overview, teams] = await Promise.all([getWalletOverview(), getMyTeams().catch(() => [])]);
  return <PortfelHomePage overview={overview} teams={teams.map((t) => ({ id: t.id, name: t.name }))} />;
}
