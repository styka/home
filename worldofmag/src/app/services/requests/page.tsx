export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getMyRequests } from "@/actions/services";
import { MyRequestsPage } from "@/components/services/MyRequestsPage";

export default async function ServicesRequestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.SERVICES)) redirect("/");

  const { asClient, asProvider } = await getMyRequests();
  return <MyRequestsPage asClient={asClient} asProvider={asProvider} />;
}
