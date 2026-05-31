export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getListings, getServiceCategories, getMyProviderProfile } from "@/actions/services";
import { ServicesCatalogPage } from "@/components/services/ServicesCatalogPage";

export default async function ServicesRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.SERVICES)) redirect("/");

  const [listings, categories, provider] = await Promise.all([
    getListings(),
    getServiceCategories(),
    getMyProviderProfile(),
  ]);

  return (
    <ServicesCatalogPage
      initialListings={listings}
      categories={categories}
      hasProviderProfile={provider != null}
    />
  );
}
