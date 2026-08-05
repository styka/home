export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import flotaModule from "@/modules/flota/module";
import { getVehicles } from "@/modules/flota/actions/flota";
import { getMyTeams } from "@/actions/teams";
import { FlotaHomePage } from "@/modules/flota/ui/FlotaHomePage";

export default async function FlotaRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, flotaModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const [vehicles, teams] = await Promise.all([getVehicles(), getMyTeams().catch(() => [])]);
  return <FlotaHomePage vehicles={vehicles} teams={teams.map((t) => ({ id: t.id, name: t.name }))} />;
}
