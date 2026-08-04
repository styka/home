export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getScenarioWithContext } from "@/modules/qa/contract";
import { ScenarioPage } from "@/modules/qa/ui/ScenarioPage";
import { markdownToHtml } from "@/lib/markdown";

interface PageProps {
  params: { slug: string };
}

export default async function ScenarioRoute({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.QA) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const scenario = await getScenarioWithContext(params.slug);
  if (!scenario) notFound();

  const contentHtml = markdownToHtml(scenario.content);
  return <ScenarioPage scenario={scenario} contentHtml={contentHtml} />;
}
