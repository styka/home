export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import servicesModule from "@/modules/services/module";
import { getMyRequests } from "@/modules/services/actions/services";
import { MyRequestsPage } from "@/modules/services/ui/MyRequestsPage";

export default async function ServicesRequestsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, servicesModule.permission)) redirect("/");

  const { asClient, asProvider } = await getMyRequests();
  return <MyRequestsPage asClient={asClient} asProvider={asProvider} viewParams={searchParams ?? {}} />;
}
