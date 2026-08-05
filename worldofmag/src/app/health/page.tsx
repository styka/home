export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import healthModule from "@/modules/health/module";
import { getHealthEvents, getTestTrends } from "@/modules/health/actions/health";
import { HealthHomePage } from "@/modules/health/ui/HealthHomePage";

export default async function HealthRootPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, healthModule.permission)) redirect("/");

  const [events, trends] = await Promise.all([getHealthEvents(), getTestTrends()]);

  return <HealthHomePage events={events} trends={trends} viewParams={searchParams ?? {}} />;
}
