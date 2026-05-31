export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getListing, getMyProviderProfile } from "@/actions/services";
import { ListingDetailPage } from "@/components/services/ListingDetailPage";

export default async function ServiceListingPage({ params }: { params: { listingId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.SERVICES)) redirect("/");

  const [listing, myProvider] = await Promise.all([
    getListing(params.listingId),
    getMyProviderProfile(),
  ]);
  if (!listing) notFound();

  // Czy oglądający to ten sam wykonawca (nie może zlecić sobie).
  const isOwnListing = myProvider?.id === listing.provider.id;

  return <ListingDetailPage listing={listing} isOwnListing={isOwnListing} />;
}
