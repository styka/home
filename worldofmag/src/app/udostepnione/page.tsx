export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getSharedByMe, getSharedWithMe } from "@/actions/sharing";
import { SharingPage } from "@/components/sharing/SharingPage";

export default async function SharingRoutePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [doMnie, odeMnie] = await Promise.all([getSharedWithMe(), getSharedByMe()]);
  return <SharingPage doMnie={doMnie} odeMnie={odeMnie} />;
}
