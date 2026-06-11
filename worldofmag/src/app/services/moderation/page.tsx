export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getModerationDisputes } from "@/actions/services";
import { ModerationPage } from "@/components/services/ModerationPage";

export default async function ServicesModerationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/services");

  const disputes = await getModerationDisputes({ status: "OPEN" });
  return <ModerationPage disputes={disputes} />;
}
