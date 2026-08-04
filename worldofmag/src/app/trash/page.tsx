export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getTrash } from "@/actions/trash";
import { TrashPage } from "@/components/trash/TrashPage";

export default async function TrashRoutePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { items, retentionDays } = await getTrash();
  return <TrashPage items={items} retentionDays={retentionDays} />;
}
