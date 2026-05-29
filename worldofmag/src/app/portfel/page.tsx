export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getWalletOverview } from "@/actions/portfel";
import { getMyTeams } from "@/actions/teams";
import { PortfelHomePage } from "@/components/portfel/PortfelHomePage";

export default async function PortfelRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.PORTFEL) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const [overview, teams] = await Promise.all([getWalletOverview(), getMyTeams().catch(() => [])]);
  return <PortfelHomePage overview={overview} teams={teams.map((t) => ({ id: t.id, name: t.name }))} />;
}
