export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPantry, getExpiringSoon } from "@/actions/pantry";
import { PantryList } from "@/components/kitchen/pantry/PantryList";

export default async function KitchenPantryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [items, expiring] = await Promise.all([getPantry(), getExpiringSoon(3)]);

  return <PantryList items={items} expiringSoon={expiring} />;
}
