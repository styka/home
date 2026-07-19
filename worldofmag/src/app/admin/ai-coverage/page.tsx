export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getAiCoverage } from "@/lib/ai/coverage";
import { AiCoveragePage } from "@/components/admin/AiCoveragePage";

export default async function AdminAiCoveragePage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const coverage = getAiCoverage();
  return <AiCoveragePage coverage={coverage} />;
}
