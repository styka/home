export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getPantry, getExpiringSoon } from "@/modules/kitchen/actions/pantry";
import { PantryList } from "@/modules/kitchen/ui/pantry/PantryList";

export default async function KitchenPantryPage({ searchParams }: { searchParams?: { q?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [items, expiring] = await Promise.all([getPantry(), getExpiringSoon(3)]);

  return <PantryList items={items} expiringSoon={expiring} viewParams={searchParams ?? {}} />;
}
