export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPantry } from "@/actions/pantry";
import { StockTakeMode } from "@/components/kitchen/pantry/StockTakeMode";

export default async function StocktakePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const items = await getPantry();
  return <StockTakeMode items={items} />;
}
