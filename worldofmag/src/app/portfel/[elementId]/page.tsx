export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import portfelModule from "@/modules/portfel/module";
import { getElement } from "@/modules/portfel/actions/portfel";
import { ElementDetailPage } from "@/modules/portfel/ui/ElementDetailPage";

interface Props {
  params: { elementId: string };
}

export default async function WalletElementPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, portfelModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const element = await getElement(params.elementId).catch(() => null);
  if (!element) notFound();

  return <ElementDetailPage element={element} />;
}
