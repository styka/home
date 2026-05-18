import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStores } from "@/actions/stores";
import { StoresManager } from "@/components/shopping/StoresManager";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const stores = await getStores();
  return <StoresManager stores={stores} />;
}
