import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getStores } from "@/modules/shopping/actions/stores";
import { StoresManager } from "@/modules/shopping/ui/StoresManager";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const stores = await getStores();
  return <StoresManager stores={stores} />;
}
