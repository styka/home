export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getScenarioWithContext } from "@/actions/qa";
import { ScenarioPage } from "@/components/qa/ScenarioPage";
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
