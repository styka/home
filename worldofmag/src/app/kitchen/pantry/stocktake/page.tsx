export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getPantry } from "@/modules/kitchen/actions/pantry";
import { StockTakeMode } from "@/modules/kitchen/ui/pantry/StockTakeMode";

export default async function StocktakePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const items = await getPantry();
  return <StockTakeMode items={items} />;
}
