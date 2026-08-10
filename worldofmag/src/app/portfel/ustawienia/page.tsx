export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import portfelModule from "@/modules/portfel/module";
import { getWalletElements } from "@/modules/portfel/actions/portfel";
import { getFinanceSettings } from "@/modules/portfel/actions/portfelAuto";
import { getCurrencySettings } from "@/modules/portfel/actions/portfelCurrency";
import { PortfelSettingsPage } from "@/modules/portfel/ui/PortfelSettingsPage";

export default async function PortfelUstawieniaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, portfelModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
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
