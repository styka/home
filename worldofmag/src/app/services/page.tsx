export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import servicesModule from "@/modules/services/module";
import { getListings, getServiceCategories, getMyProviderProfile } from "@/modules/services/actions/services";
import { getMyFavoriteProviders } from "@/modules/services/actions/parts/favorites";
import { ServicesCatalogPage } from "@/modules/services/ui/ServicesCatalogPage";

export default async function ServicesRootPage({ searchParams }: { searchParams?: { q?: string; cat?: string; sort?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, servicesModule.permission)) redirect("/");

  const [listings, categories, provider, favorites] = await Promise.all([
    getListings(),
    getServiceCategories(),
    getMyProviderProfile(),
    getMyFavoriteProviders(),
  ]);

  return (
    <ServicesCatalogPage
      initialListings={listings}
      categories={categories}
      hasProviderProfile={provider != null}
      favorites={favorites}
      viewParams={searchParams ?? {}}
    />
  );
}
