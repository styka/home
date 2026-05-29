export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getVehicles } from "@/actions/flota";
import { getMyTeams } from "@/actions/teams";
import { FlotaHomePage } from "@/components/flota/FlotaHomePage";

export default async function FlotaRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.FLOTA) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const [vehicles, teams] = await Promise.all([getVehicles(), getMyTeams().catch(() => [])]);
  return <FlotaHomePage vehicles={vehicles} teams={teams.map((t) => ({ id: t.id, name: t.name }))} />;
}
