"use server";

// Z-213/361: akcje modułu Usługi — oferty wykonawcy + katalog (przeglądanie).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { requireOwnProvider, toListingDTO, PROVIDER_CARD_SELECT } from "@/lib/services/helpers";
import { haversineKm } from "@/lib/serviceGeo";
import type { PriceModel, ListingDTO, ListingSort } from "@/lib/services";

export async function createListing(data: {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  priceModel?: PriceModel;
  priceAmount?: number | null;
  currency?: string;
  durationMin?: number | null;
  bookingEnabled?: boolean;
}): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const title = data.title.trim();
  if (!title) throw new Error("Tytuł oferty jest wymagany");

  const priceModel: PriceModel = data.priceModel ?? "quote";
  const bookingEnabled = data.bookingEnabled ?? false;
  await prisma.serviceListing.create({
    data: {
      providerId: provider.id,
      title,
      description: data.description?.trim() || null,
      categoryId: data.categoryId || null,
      priceModel,
      priceAmount: priceModel === "quote" ? null : data.priceAmount ?? null,
      currency: data.currency?.trim() || "PLN",
      durationMin: data.durationMin && data.durationMin > 0 ? Math.round(data.durationMin) : null,
      // rezerwacja wymaga czasu trwania
      bookingEnabled: bookingEnabled && !!data.durationMin && data.durationMin > 0,
    },
  });
  revalidatePath("/services/provider");
  revalidatePath("/services");
}

export async function updateListing(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    categoryId?: string | null;
    priceModel?: PriceModel;
    priceAmount?: number | null;
    currency?: string;
    active?: boolean;
    durationMin?: number | null;
    bookingEnabled?: boolean;
  }
): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const listing = await prisma.serviceListing.findUnique({ where: { id }, select: { providerId: true, durationMin: true } });
  if (!listing || listing.providerId !== provider.id) throw new Error("Brak dostępu do oferty");

  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("Tytuł oferty jest wymagany");
    data.title = t;
  }
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.categoryId !== undefined) data.categoryId = patch.categoryId || null;
  if (patch.priceModel !== undefined) data.priceModel = patch.priceModel;
  if (patch.priceAmount !== undefined) data.priceAmount = patch.priceAmount;
  if (patch.currency !== undefined) data.currency = patch.currency.trim() || "PLN";
  if (patch.active !== undefined) data.active = patch.active;
  if (patch.durationMin !== undefined) data.durationMin = patch.durationMin && patch.durationMin > 0 ? Math.round(patch.durationMin) : null;
  if (patch.bookingEnabled !== undefined) data.bookingEnabled = patch.bookingEnabled;
  // Wycena indywidualna nie ma kwoty.
  if (data.priceModel === "quote") data.priceAmount = null;
  // Rezerwacja wymaga czasu trwania — bez niego wyłącz.
  const effectiveDuration = data.durationMin !== undefined ? (data.durationMin as number | null) : listing.durationMin;
  if (!effectiveDuration) data.bookingEnabled = false;

  await prisma.serviceListing.update({ where: { id }, data });
  revalidatePath("/services/provider");
  revalidatePath("/services");
}

export async function deleteListing(id: string): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const listing = await prisma.serviceListing.findUnique({ where: { id }, select: { providerId: true } });
  if (!listing || listing.providerId !== provider.id) throw new Error("Brak dostępu do oferty");
  await prisma.serviceListing.delete({ where: { id } });
  revalidatePath("/services/provider");
  revalidatePath("/services");
}

export async function getListings(filters?: {
  categoryId?: string;
  query?: string;
  minPrice?: number | null; // grosze
  maxPrice?: number | null; // grosze
  minRating?: number | null; // 0..5
  bookingOnly?: boolean;
  verifiedOnly?: boolean;
  sort?: ListingSort;
  near?: { lat: number; lon: number; radiusKm?: number | null } | null;
}): Promise<ListingDTO[]> {
  await requireAuth();
  const q = filters?.query?.trim();
  const orderBy =
    filters?.sort === "priceAsc" ? [{ priceAmount: "asc" as const }, { createdAt: "desc" as const }]
    : filters?.sort === "priceDesc" ? [{ priceAmount: "desc" as const }, { createdAt: "desc" as const }]
    : filters?.sort === "newest" ? [{ createdAt: "desc" as const }]
    : [{ provider: { ratingAvg: "desc" as const } }, { createdAt: "desc" as const }];

  const priceFilter: Record<string, number> = {};
  if (filters?.minPrice != null) priceFilter.gte = filters.minPrice;
  if (filters?.maxPrice != null) priceFilter.lte = filters.maxPrice;
  const near = filters?.near ?? null;

  const listings = await prisma.serviceListing.findMany({
    where: {
      active: true,
      provider: {
        visible: true,
        ...(filters?.minRating ? { ratingAvg: { gte: filters.minRating } } : {}),
        ...(filters?.verifiedOnly ? { verified: true } : {}),
        // Gdy filtrujemy po odległości — pokazujemy tylko wykonawców z lokalizacją.
        ...(near ? { lat: { not: null }, lon: { not: null } } : {}),
      },
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.bookingOnly ? { bookingEnabled: true } : {}),
      ...(Object.keys(priceFilter).length ? { priceAmount: priceFilter } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { provider: { displayName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy,
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      provider: { select: PROVIDER_CARD_SELECT },
    },
    take: near ? 300 : 100,
  });

  let dtos = listings.map((l) => {
    const dist = near && l.provider.lat != null && l.provider.lon != null
      ? haversineKm(near.lat, near.lon, l.provider.lat, l.provider.lon)
      : null;
    return toListingDTO(l, dist);
  });

  if (near) {
    const radius = near.radiusKm ?? null;
    if (radius != null) dtos = dtos.filter((d) => d.distanceKm != null && d.distanceKm <= radius);
    if (filters?.sort === "distance") dtos.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    dtos = dtos.slice(0, 100);
  }
  return dtos;
}

export async function getListing(id: string): Promise<ListingDTO | null> {
  await requireAuth();
  const l = await prisma.serviceListing.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      provider: { select: PROVIDER_CARD_SELECT },
    },
  });
  return l ? toListingDTO(l) : null;
}
