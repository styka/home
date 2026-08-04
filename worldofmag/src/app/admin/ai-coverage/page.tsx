export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getAiCoverage } from "@/lib/ai/coverage";
import { AiCoveragePage } from "@/components/admin/AiCoveragePage";

export default async function AdminAiCoveragePage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const coverage = getAiCoverage();
  return <AiCoveragePage coverage={coverage} />;
}
