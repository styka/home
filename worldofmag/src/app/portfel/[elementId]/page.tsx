export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getElement } from "@/actions/portfel";
import { ElementDetailPage } from "@/components/portfel/ElementDetailPage";

interface Props {
  params: { elementId: string };
}

export default async function WalletElementPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.PORTFEL) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const element = await getElement(params.elementId).catch(() => null);
  if (!element) notFound();

  return <ElementDetailPage element={element} />;
}
