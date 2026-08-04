export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getModerationDisputes } from "@/actions/services/disputes";
import { ModerationPage } from "@/components/services/ModerationPage";

export default async function ServicesModerationPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/services");

  const disputes = await getModerationDisputes({ status: "OPEN" });
  return <ModerationPage disputes={disputes} viewParams={searchParams ?? {}} />;
}
