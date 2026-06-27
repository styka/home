// Z-213/361: wewnętrzne helpery modułu Usługi wyodrębnione z actions/services.ts
// (mappery DTO, slug, guardy własności profilu, liczenie wolnych slotów).
// To zwykły moduł serwerowy (NIE "use server") — używany przez akcje w
// actions/services(/*).ts. Trzymanie tu plumbingu pozwala plikom akcji być
// czystymi listami Server Actions.
import { prisma } from "@/lib/prisma";
import { generateDaySlots, minutesOfDay, type BookedInterval } from "@/lib/serviceSlots";
import type { RequestStatus, PriceModel, ListingDTO, RequestDTO } from "@/lib/services";

/** Dozwolone przejścia statusu po stronie wykonawcy/klienta. */
export const PROVIDER_TRANSITIONS: Partial<Record<RequestStatus, RequestStatus[]>> = {
  REQUESTED: ["ACCEPTED", "DECLINED"],
  ACCEPTED: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
};

export const PROVIDER_CARD_SELECT = { id: true, displayName: true, area: true, ratingAvg: true, ratingCount: true, verified: true, lat: true, lon: true } as const;

export const BOOKED_STATUSES = ["SCHEDULED", "ACCEPTED", "IN_PROGRESS"];

export function toListingDTO(l: {
  id: string;
  title: string;
  description: string | null;
  priceModel: string;
  priceAmount: number | null;
  currency: string;
  active: boolean;
  durationMin: number | null;
  bookingEnabled: boolean;
  category: { id: string; name: string; icon: string; color: string } | null;
  provider: { id: string; displayName: string; area: string | null; ratingAvg: number; ratingCount: number; verified: boolean; lat: number | null; lon: number | null };
}, distanceKm: number | null = null): ListingDTO {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    priceModel: (l.priceModel as PriceModel) ?? "quote",
    priceAmount: l.priceAmount,
    currency: l.currency,
    active: l.active,
    durationMin: l.durationMin,
    bookingEnabled: l.bookingEnabled,
    category: l.category,
    distanceKm,
    provider: l.provider,
  };
}

export function slugify(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // diakrytyki
    .toLowerCase()
    .replace(/ł/g, "l") // polskie ł nie rozkłada się w NFD — zmapuj ręcznie, inaczej staje się separatorem
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "wykonawca";
}

export async function uniqueProviderSlug(base: string, ownProviderId: string | null): Promise<string> {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await prisma.serviceProvider.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ownProviderId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function requireOwnProvider(userId: string) {
  const provider = await prisma.serviceProvider.findUnique({ where: { userId } });
  if (!provider) throw new Error("Najpierw załóż profil wykonawcy");
  return provider;
}

export async function requireMyProvider(userId: string): Promise<{ id: string }> {
  const provider = await prisma.serviceProvider.findUnique({ where: { userId }, select: { id: true } });
  if (!provider) throw new Error("Najpierw utwórz profil wykonawcy");
  return provider;
}

export function mapRequest(r: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  preferredAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
  listingId: string | null;
  staffId?: string | null;
  listing: { title: string; bookingEnabled: boolean; durationMin: number | null } | null;
  client: { name: string | null };
  provider: { displayName: string };
  staff?: { name: string } | null;
  review: { rating: number } | null;
}): RequestDTO {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status as RequestStatus,
    preferredAt: r.preferredAt ? r.preferredAt.toISOString() : null,
    scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    listingTitle: r.listing?.title ?? null,
    listingId: r.listingId,
    bookingEnabled: r.listing?.bookingEnabled ?? false,
    durationMin: r.listing?.durationMin ?? null,
    clientName: r.client.name ?? "Klient",
    providerName: r.provider.displayName,
    staffId: r.staffId ?? null,
    staffName: r.staff?.name ?? null,
    hasReview: r.review != null,
    rating: r.review?.rating ?? null,
  };
}

export async function computeSlots(listingId: string, dateISO: string, opts?: { excludeRequestId?: string; staffId?: string | null }): Promise<{ listingTitle: string; providerUserId: string; slots: string[] }> {
  const excludeRequestId = opts?.excludeRequestId;
  const staffId = opts?.staffId ?? null;
  const listing = await prisma.serviceListing.findUnique({
    where: { id: listingId },
    select: { id: true, title: true, durationMin: true, bookingEnabled: true, providerId: true, provider: { select: { userId: true } } },
  });
  if (!listing) throw new Error("Oferta nie istnieje");
  if (!listing.bookingEnabled || !listing.durationMin) {
    return { listingTitle: listing.title, providerUserId: listing.provider.userId, slots: [] };
  }
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) throw new Error("Nieprawidłowa data");
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  const weekday = dayStart.getDay();

  // M14: gdy wybrano pracownika — jego harmonogram i jego rezerwacje; inaczej poziom firmy (staffId null).
  const [rules, bookedRows] = await Promise.all([
    prisma.serviceAvailability.findMany({ where: { providerId: listing.providerId, staffId, weekday }, select: { weekday: true, startMin: true, endMin: true } }),
    prisma.serviceRequest.findMany({
      where: {
        providerId: listing.providerId,
        staffId,
        status: { in: BOOKED_STATUSES },
        scheduledAt: { gte: dayStart, lt: dayEnd },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
      select: { scheduledAt: true, listing: { select: { durationMin: true } } },
    }),
  ]);

  const booked: BookedInterval[] = bookedRows
    .filter((b) => b.scheduledAt)
    .map((b) => {
      const startMin = minutesOfDay(b.scheduledAt as Date);
      return { startMin, endMin: startMin + (b.listing?.durationMin ?? listing.durationMin!) };
    });

  const now = new Date();
  const isToday = now.getFullYear() === y && now.getMonth() === m - 1 && now.getDate() === d;
  const slotMins = generateDaySlots(rules, weekday, listing.durationMin, booked, isToday ? minutesOfDay(now) : null);
  const slots = slotMins.map((min) => new Date(y, m - 1, d, Math.floor(min / 60), min % 60, 0, 0).toISOString());
  return { listingTitle: listing.title, providerUserId: listing.provider.userId, slots };
}
