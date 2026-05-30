export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getHealthEvents } from "@/actions/health";
import { HealthHomePage } from "@/components/health/HealthHomePage";

export default async function HealthRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.HEALTH)) redirect("/");

  const events = await getHealthEvents();

  return <HealthHomePage events={events} />;
}
