export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getProviderPublic } from "@/actions/services";
import { ProviderPublicPage } from "@/components/services/ProviderPublicPage";

export default async function ProviderProfilePage({ params }: { params: { providerId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.SERVICES)) redirect("/");

  const provider = await getProviderPublic(params.providerId);
  if (!provider) notFound();
  const isAdmin = hasPermission(session, PERMISSIONS.ADMIN);

  return (
    <ProviderPublicPage
      isAdmin={isAdmin}
      provider={{
        id: provider.id,
        displayName: provider.displayName,
        bio: provider.bio,
        area: provider.area,
        ratingAvg: provider.ratingAvg,
        ratingCount: provider.ratingCount,
        verified: provider.verified,
        nip: provider.nip,
        isFavorite: provider.isFavorite,
        listings: provider.listings.map((l) => ({
          id: l.id,
          title: l.title,
          priceModel: l.priceModel as "fixed" | "hourly" | "quote",
          priceAmount: l.priceAmount,
          currency: l.currency,
          categoryIcon: l.category?.icon ?? "🛠️",
        })),
        images: provider.images.map((img) => ({ id: img.id, url: img.url, caption: img.caption })),
        reviews: provider.requests
          .filter((r) => r.review)
          .map((r) => ({
            id: r.review!.id,
            rating: r.review!.rating,
            comment: r.review!.comment,
            clientName: r.client.name ?? "Klient",
          })),
      }}
    />
  );
}
