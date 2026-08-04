export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getMyRequests } from "@/actions/services";
import { MyRequestsPage } from "@/components/services/MyRequestsPage";

export default async function ServicesRequestsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.SERVICES)) redirect("/");

  const { asClient, asProvider } = await getMyRequests();
  return <MyRequestsPage asClient={asClient} asProvider={asProvider} viewParams={searchParams ?? {}} />;
}
