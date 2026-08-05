export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import qaModule from "@/modules/qa/module";
import { getModuleTree } from "@/modules/qa/contract";
import { QaModuleBrowser } from "@/modules/qa/ui/QaModuleBrowser";
import { QA_MODULES } from "@/lib/qaModules";

interface PageProps {
  params: { module: string };
}

export default async function QaModulePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, qaModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  if (!QA_MODULES.some((m) => m.slug === params.module)) {
    notFound();
  }

  const tree = await getModuleTree(params.module);
  return <QaModuleBrowser module={params.module} tree={tree} />;
}
