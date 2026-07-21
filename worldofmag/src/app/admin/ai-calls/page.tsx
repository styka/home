export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getRecentAiCalls } from "@/actions/llmConfig";
import { AiCallsPage } from "@/components/admin/AiCallsPage";

export default async function AdminAiCallsRoute() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const initial = await getRecentAiCalls({ limit: 100 });
  return <AiCallsPage initial={initial} />;
}
