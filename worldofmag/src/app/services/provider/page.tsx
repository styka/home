export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getMyProviderProfile, getServiceCategories, getMyRequests } from "@/actions/services";
import { ProviderPanelPage } from "@/components/services/ProviderPanelPage";

export default async function ServicesProviderPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.SERVICES)) redirect("/");

  const [provider, categories, requests] = await Promise.all([
    getMyProviderProfile(),
    getServiceCategories(),
    getMyRequests(),
  ]);

  return (
    <ProviderPanelPage
      provider={
        provider
          ? {
              displayName: provider.displayName,
              bio: provider.bio,
              area: provider.area,
              phone: provider.phone,
              visible: provider.visible,
              ratingAvg: provider.ratingAvg,
              ratingCount: provider.ratingCount,
              listings: provider.listings.map((l) => ({
                id: l.id,
                title: l.title,
                description: l.description,
                priceModel: l.priceModel as "fixed" | "hourly" | "quote",
                priceAmount: l.priceAmount,
                currency: l.currency,
                active: l.active,
                category: l.category,
              })),
            }
          : null
      }
      categories={categories}
      incomingRequests={requests.asProvider}
    />
  );
}
