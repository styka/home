export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getWalletElements } from "@/actions/portfel";
import { getFinanceSettings } from "@/actions/portfelAuto";
import { getCurrencySettings } from "@/actions/portfelCurrency";
import { PortfelSettingsPage } from "@/components/portfel/PortfelSettingsPage";

export default async function PortfelUstawieniaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.PORTFEL) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const [elements, settings, currency] = await Promise.all([
    getWalletElements(),
    getFinanceSettings(),
    getCurrencySettings(),
  ]);
  // tylko prywatne, aktywne konta jako cel auto-wydatków
  const accounts = elements
    .filter((e) => !e.archived && e.ownerId === session.user!.id)
    .map((e) => ({ id: e.id, name: e.name }));

  return <PortfelSettingsPage accounts={accounts} settings={settings} currency={currency} />;
}
