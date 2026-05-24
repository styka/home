export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getModuleTree } from "@/actions/qa";
import { QaModuleBrowser } from "@/components/qa/QaModuleBrowser";
import { QA_MODULES } from "@/lib/qaModules";

interface PageProps {
  params: { module: string };
}

export default async function QaModulePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.QA) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  if (!QA_MODULES.some((m) => m.slug === params.module)) {
    notFound();
  }

  const tree = await getModuleTree(params.module);
  return <QaModuleBrowser module={params.module} tree={tree} />;
}
