"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { notifyUser } from "@/actions/notifications";
import { addEntry } from "@/actions/portfel";
import { generateDaySlots, minutesOfDay, type AvailabilityRule, type BookedInterval } from "@/lib/serviceSlots";
import { haversineKm } from "@/lib/serviceGeo";
import { REQUEST_STATUS_LABELS } from "@/lib/services";
import type {
  RequestStatus,
  PriceModel,
  ServiceCategoryDTO,
  ListingDTO,
  RequestDTO,
  RequestThreadDTO,
  QuoteStatus,
  PaymentMethod,
  PaymentStatus,
  PromoKind,
  ServicePromoCodeDTO,
  ServiceDisputeDTO,
  DisputeStatus,
} from "@/lib/services";

// ─── Helpery ───────────────────────────────────────────────────────────────

/** Dozwolone przejścia statusu po stronie wykonawcy/klienta. */
const PROVIDER_TRANSITIONS: Partial<Record<RequestStatus, RequestStatus[]>> = {
  REQUESTED: ["ACCEPTED", "DECLINED"],
  ACCEPTED: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
};

function toListingDTO(l: {
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

// ─── Kategorie ─────────────────────────────────────────────────────────────

/** Kategorie usług widoczne dla użytkownika: systemowe + własne + zespołowe. */
export async function getServiceCategories(): Promise<ServiceCategoryDTO[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const cats = await prisma.serviceCategory.findMany({
    where: {
      OR: [
        { userId: null, teamId: null },
        { userId: user.id },
        ...(teamIds.length ? [{ teamId: { in: teamIds } }] : []),
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    isSystem: c.userId === null && c.teamId === null,
  }));
}

// ─── Profil wykonawcy ──────────────────────────────────────────────────────

export async function getMyProviderProfile() {
  const user = await requireAuth();
  return prisma.serviceProvider.findUnique({
    where: { userId: user.id },
    include: {
      listings: {
        orderBy: { createdAt: "desc" },
        include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      },
      images: { orderBy: { order: "asc" } },
      availability: { select: { id: true } },
    },
  });
}

export async function upsertServiceProvider(data: {
  displayName: string;
  bio?: string | null;
  area?: string | null;
  phone?: string | null;
  nip?: string | null;
  visible?: boolean;
}): Promise<void> {
  const user = await requireAuth();
  const displayName = data.displayName.trim();
  if (!displayName) throw new Error("Nazwa wykonawcy jest wymagana");

  const fields = {
    displayName,
    bio: data.bio?.trim() || null,
    area: data.area?.trim() || null,
    phone: data.phone?.trim() || null,
    nip: data.nip?.trim() || null,
    visible: data.visible ?? true,
  };

  await prisma.serviceProvider.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...fields },
    update: fields,
  });
  revalidatePath("/services/provider");
  revalidatePath("/services");
}

/** M5: ustawia (lub czyści) lokalizację wykonawcy — wołane z przeglądarkowej geolokalizacji. */
export async function setProviderLocation(lat: number | null, lon: number | null): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  if (lat != null && (lat < -90 || lat > 90)) throw new Error("Nieprawidłowa szerokość");
  if (lon != null && (lon < -180 || lon > 180)) throw new Error("Nieprawidłowa długość");
  await prisma.serviceProvider.update({ where: { id: provider.id }, data: { lat, lon } });
  revalidatePath("/services/provider");
  revalidatePath("/services");
}

// ─── Oferty ────────────────────────────────────────────────────────────────

async function requireOwnProvider(userId: string) {
  const provider = await prisma.serviceProvider.findUnique({ where: { userId } });
  if (!provider) throw new Error("Najpierw załóż profil wykonawcy");
  return provider;
}

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

// ─── Katalog (przeglądanie ofert) ──────────────────────────────────────────

export type ListingSort = "rating" | "priceAsc" | "priceDesc" | "newest" | "distance";

const PROVIDER_CARD_SELECT = { id: true, displayName: true, area: true, ratingAvg: true, ratingCount: true, verified: true, lat: true, lon: true } as const;

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

export async function getProviderPublic(providerId: string) {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findUnique({
    where: { id: providerId },
    include: {
      listings: {
        where: { active: true },
        include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      },
      requests: {
        where: { status: "COMPLETED", review: { isNot: null } },
        include: { review: true, client: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
      images: { orderBy: { order: "asc" } },
    },
  });
  if (!provider) return null;
  const fav = await prisma.serviceFavorite.findUnique({
    where: { userId_providerId: { userId: user.id, providerId } },
    select: { id: true },
  });
  return { ...provider, isFavorite: !!fav };
}

// ─── Zlecenia ──────────────────────────────────────────────────────────────

export async function createServiceRequest(data: {
  providerId: string;
  listingId?: string | null;
  title: string;
  description?: string | null;
  preferredAt?: string | null;
}): Promise<void> {
  const user = await requireAuth();
  const title = data.title.trim();
  if (!title) throw new Error("Tytuł zlecenia jest wymagany");

  const provider = await prisma.serviceProvider.findUnique({
    where: { id: data.providerId },
    select: { id: true, userId: true },
  });
  if (!provider) throw new Error("Wykonawca nie istnieje");
  if (provider.userId === user.id) throw new Error("Nie możesz zlecić usługi samemu sobie");

  const created = await prisma.serviceRequest.create({
    data: {
      clientId: user.id,
      providerId: provider.id,
      listingId: data.listingId || null,
      title,
      description: data.description?.trim() || null,
      preferredAt: data.preferredAt ? new Date(data.preferredAt) : null,
      status: "REQUESTED",
    },
  });
  // M6: powiadom wykonawcę o nowym zleceniu.
  await notifyUser({
    userId: provider.userId,
    module: "services",
    title: `Nowe zlecenie: ${title}`,
    href: "/services/requests",
    dedupeKey: `svc-req-${created.id}`,
  });
  revalidatePath("/services/requests");
}

/** Zmiana statusu przez wykonawcę (accept/decline/schedule/start/complete/cancel). */
export async function advanceRequestStatus(
  id: string,
  next: RequestStatus,
  opts?: { scheduledAt?: string | null }
): Promise<void> {
  const user = await requireAuth();
  const req = await prisma.serviceRequest.findUnique({
    where: { id },
    include: { provider: { select: { userId: true } } },
  });
  if (!req) throw new Error("Zlecenie nie istnieje");
  if (req.provider.userId !== user.id) throw new Error("Tylko wykonawca może zmienić status");

  const allowed = PROVIDER_TRANSITIONS[req.status as RequestStatus] ?? [];
  if (!allowed.includes(next)) throw new Error(`Niedozwolone przejście: ${req.status} → ${next}`);

  await prisma.serviceRequest.update({
    where: { id },
    data: {
      status: next,
      ...(next === "SCHEDULED" && opts?.scheduledAt ? { scheduledAt: new Date(opts.scheduledAt) } : {}),
    },
  });
  // M6: powiadom klienta o zmianie statusu jego zlecenia.
  await notifyUser({
    userId: req.clientId,
    module: "services",
    title: `Status zlecenia „${req.title}": ${REQUEST_STATUS_LABELS[next] ?? next}`,
    href: "/services/requests",
    dedupeKey: `svc-status-${id}-${next}`,
  });
  revalidatePath("/services/requests");
  revalidatePath("/services/provider");
}

/** Klient może anulować własne zlecenie, dopóki nie jest zakończone. */
export async function cancelMyRequest(id: string): Promise<void> {
  const user = await requireAuth();
  const req = await prisma.serviceRequest.findUnique({ where: { id }, select: { clientId: true, status: true } });
  if (!req || req.clientId !== user.id) throw new Error("Brak dostępu do zlecenia");
  if (req.status === "COMPLETED" || req.status === "CANCELLED")
    throw new Error("Zlecenia nie można już anulować");
  await prisma.serviceRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/services/requests");
}

function mapRequest(r: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  preferredAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
  listingId: string | null;
  listing: { title: string; bookingEnabled: boolean; durationMin: number | null } | null;
  client: { name: string | null };
  provider: { displayName: string };
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
    hasReview: r.review != null,
    rating: r.review?.rating ?? null,
  };
}

export async function getMyRequests(): Promise<{ asClient: RequestDTO[]; asProvider: RequestDTO[] }> {
  const user = await requireAuth();
  const include = {
    listing: { select: { title: true, bookingEnabled: true, durationMin: true } },
    client: { select: { name: true } },
    provider: { select: { displayName: true } },
    review: { select: { rating: true } },
  } as const;

  const [asClient, providerRecord] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { clientId: user.id },
      orderBy: { createdAt: "desc" },
      include,
    }),
    prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);

  const asProvider = providerRecord
    ? await prisma.serviceRequest.findMany({
        where: { providerId: providerRecord.id },
        orderBy: { createdAt: "desc" },
        include,
      })
    : [];

  return {
    asClient: asClient.map(mapRequest),
    asProvider: asProvider.map(mapRequest),
  };
}

// ─── Oceny ─────────────────────────────────────────────────────────────────

export async function addReview(requestId: string, rating: number, comment?: string): Promise<void> {
  const user = await requireAuth();
  const r = Math.round(rating);
  if (r < 1 || r > 5) throw new Error("Ocena musi być w zakresie 1–5");

  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { clientId: true, status: true, providerId: true, review: { select: { id: true } } },
  });
  if (!req || req.clientId !== user.id) throw new Error("Tylko klient może wystawić ocenę");
  if (req.status !== "COMPLETED") throw new Error("Ocena możliwa dopiero po zakończeniu zlecenia");
  if (req.review) throw new Error("To zlecenie ma już ocenę");

  await prisma.$transaction(async (tx) => {
    await tx.serviceReview.create({
      data: { requestId, authorId: user.id, rating: r, comment: comment?.trim() || null },
    });
    // Przelicz średnią ocen wykonawcy (denormalizacja dla szybkiego listowania).
    const agg = await tx.serviceReview.aggregate({
      where: { request: { providerId: req.providerId } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.serviceProvider.update({
      where: { id: req.providerId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count.rating },
    });
  });
  revalidatePath("/services/requests");
  revalidatePath("/services");
}

// ─── M1 czat + M3 wyceny (wątek zlecenia) ──────────────────────────────────

/** Ładuje zlecenie i ustala rolę bieżącego użytkownika (klient lub wykonawca). */
async function loadRequestAccess(requestId: string, userId: string) {
  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, title: true, status: true, clientId: true, providerId: true, provider: { select: { userId: true } } },
  });
  if (!req) throw new Error("Zlecenie nie istnieje");
  const isClient = req.clientId === userId;
  const isProvider = req.provider.userId === userId;
  if (!isClient && !isProvider) throw new Error("Brak dostępu do zlecenia");
  return { req, role: (isClient ? "client" : "provider") as "client" | "provider" };
}

/** Pełny wątek zlecenia: wiadomości + wyceny + rola. Oznacza wiadomości drugiej strony jako przeczytane. */
export async function getRequestThread(requestId: string): Promise<RequestThreadDTO> {
  const user = await requireAuth();
  const { req, role } = await loadRequestAccess(requestId, user.id);

  const [messages, quotes, payment] = await Promise.all([
    prisma.serviceMessage.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
      select: { id: true, body: true, senderId: true, createdAt: true, sender: { select: { name: true } } },
    }),
    prisma.serviceQuote.findMany({
      where: { requestId },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, currency: true, message: true, status: true, validUntil: true, createdAt: true },
    }),
    prisma.servicePayment.findUnique({ where: { requestId } }),
  ]);

  // Oznacz jako przeczytane wiadomości wysłane przez drugą stronę.
  await prisma.serviceMessage.updateMany({
    where: { requestId, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  return {
    requestId: req.id,
    title: req.title,
    status: req.status as RequestStatus,
    role,
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === user.id,
      senderName: m.sender?.name ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      amount: q.amount,
      currency: q.currency,
      message: q.message,
      status: q.status as QuoteStatus,
      validUntil: q.validUntil?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
    })),
    payment: payment
      ? {
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method as PaymentMethod,
          status: payment.status as PaymentStatus,
          promoCode: payment.promoCode,
          discount: payment.discount,
          invoiceNo: payment.invoiceNo,
          paidAt: payment.paidAt?.toISOString() ?? null,
        }
      : null,
  };
}

/** Wysyła wiadomość w wątku zlecenia (M1) i powiadamia drugą stronę (M6). */
export async function sendServiceMessage(requestId: string, body: string): Promise<void> {
  const user = await requireAuth();
  const text = body.trim();
  if (!text) throw new Error("Wiadomość jest pusta");
  const { req } = await loadRequestAccess(requestId, user.id);

  await prisma.serviceMessage.create({ data: { requestId, senderId: user.id, body: text } });

  const recipientUserId = req.clientId === user.id ? req.provider.userId : req.clientId;
  await notifyUser({
    userId: recipientUserId,
    module: "services",
    title: `Nowa wiadomość: ${req.title}`,
    body: text.length > 80 ? text.slice(0, 80) + "…" : text,
    href: "/services/requests",
    // brak dedupeKey — każda wiadomość to osobne powiadomienie
  });
  revalidatePath("/services/requests");
}

/** Wykonawca wysyła wycenę do zlecenia (M3). Kwota w groszach. Powiadamia klienta. */
export async function sendQuote(
  requestId: string,
  amountGrosze: number,
  message?: string | null,
  validUntil?: string | null
): Promise<void> {
  const user = await requireAuth();
  const { req, role } = await loadRequestAccess(requestId, user.id);
  if (role !== "provider") throw new Error("Tylko wykonawca może wysłać wycenę");
  if (!Number.isFinite(amountGrosze) || amountGrosze <= 0) throw new Error("Nieprawidłowa kwota wyceny");

  await prisma.serviceQuote.create({
    data: {
      requestId,
      providerId: req.providerId,
      amount: Math.round(amountGrosze),
      message: message?.trim() || null,
      validUntil: validUntil ? new Date(validUntil) : null,
      status: "SENT",
    },
  });
  await notifyUser({
    userId: req.clientId,
    module: "services",
    title: `Nowa wycena: ${req.title}`,
    href: "/services/requests",
    dedupeKey: null,
  });
  revalidatePath("/services/requests");
}

/** Klient akceptuje/odrzuca wycenę (M3). Akceptacja odrzuca pozostałe i przesuwa zlecenie do ACCEPTED. */
export async function respondToQuote(quoteId: string, accept: boolean): Promise<void> {
  const user = await requireAuth();
  const quote = await prisma.serviceQuote.findUnique({
    where: { id: quoteId },
    select: { id: true, requestId: true, status: true, provider: { select: { userId: true } } },
  });
  if (!quote) throw new Error("Wycena nie istnieje");
  const { req, role } = await loadRequestAccess(quote.requestId, user.id);
  if (role !== "client") throw new Error("Tylko klient może odpowiedzieć na wycenę");
  if (quote.status !== "SENT") throw new Error("Wycena została już rozpatrzona");

  if (accept) {
    await prisma.$transaction([
      prisma.serviceQuote.update({ where: { id: quoteId }, data: { status: "ACCEPTED" } }),
      prisma.serviceQuote.updateMany({
        where: { requestId: quote.requestId, id: { not: quoteId }, status: "SENT" },
        data: { status: "REJECTED" },
      }),
      ...(req.status === "REQUESTED"
        ? [prisma.serviceRequest.update({ where: { id: quote.requestId }, data: { status: "ACCEPTED" } })]
        : []),
    ]);
  } else {
    await prisma.serviceQuote.update({ where: { id: quoteId }, data: { status: "REJECTED" } });
  }

  await notifyUser({
    userId: quote.provider.userId,
    module: "services",
    title: `Wycena ${accept ? "zaakceptowana" : "odrzucona"}: ${req.title}`,
    href: "/services/requests",
    dedupeKey: null,
  });
  revalidatePath("/services/requests");
  revalidatePath("/services/provider");
}

// ─── M4 portfolio zdjęć wykonawcy ──────────────────────────────────────────

/** Dodaje zdjęcie do portfolio wykonawcy. url = data-URL (limit ~2MB) lub link. */
export async function addServiceImage(url: string, caption?: string | null): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  if (!url || (!url.startsWith("data:image/") && !url.startsWith("http"))) throw new Error("Nieprawidłowy obraz");
  if (url.length > 2_800_000) throw new Error("Zdjęcie jest za duże (max ~2MB)");
  const max = await prisma.serviceImage.aggregate({ where: { providerId: provider.id }, _max: { order: true } });
  await prisma.serviceImage.create({
    data: { providerId: provider.id, url, caption: caption?.trim() || null, order: (max._max.order ?? -1) + 1 },
  });
  revalidatePath("/services/provider");
}

export async function deleteServiceImage(id: string): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const img = await prisma.serviceImage.findUnique({ where: { id }, select: { providerId: true } });
  if (!img || img.providerId !== provider.id) throw new Error("Brak dostępu do zdjęcia");
  await prisma.serviceImage.delete({ where: { id } });
  revalidatePath("/services/provider");
}

// ─── M2 dostępność + rezerwacja slotów (Booksy) ─────────────────────────────

const BOOKED_STATUSES = ["SCHEDULED", "ACCEPTED", "IN_PROGRESS"];

/** Reguły dostępności bieżącego wykonawcy. */
export async function getMyAvailability(): Promise<AvailabilityRule[]> {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!provider) return [];
  const rows = await prisma.serviceAvailability.findMany({
    where: { providerId: provider.id },
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    select: { weekday: true, startMin: true, endMin: true },
  });
  return rows;
}

/** Zastępuje cały zestaw reguł dostępności wykonawcy. */
export async function setAvailability(rules: AvailabilityRule[]): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const clean = rules
    .filter((r) => r.weekday >= 0 && r.weekday <= 6 && r.startMin < r.endMin && r.startMin >= 0 && r.endMin <= 24 * 60)
    .map((r) => ({ providerId: provider.id, weekday: r.weekday, startMin: r.startMin, endMin: r.endMin }));
  await prisma.$transaction([
    prisma.serviceAvailability.deleteMany({ where: { providerId: provider.id } }),
    ...(clean.length ? [prisma.serviceAvailability.createMany({ data: clean })] : []),
  ]);
  revalidatePath("/services/provider");
}

async function computeSlots(listingId: string, dateISO: string, excludeRequestId?: string): Promise<{ listingTitle: string; providerUserId: string; slots: string[] }> {
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

  const [rules, bookedRows] = await Promise.all([
    prisma.serviceAvailability.findMany({ where: { providerId: listing.providerId, weekday }, select: { weekday: true, startMin: true, endMin: true } }),
    prisma.serviceRequest.findMany({
      where: {
        providerId: listing.providerId,
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

/** Wolne sloty (ISO) danej oferty na wskazany dzień ("YYYY-MM-DD"). */
export async function getAvailableSlots(listingId: string, dateISO: string, excludeRequestId?: string): Promise<string[]> {
  await requireAuth();
  const { slots } = await computeSlots(listingId, dateISO, excludeRequestId);
  return slots;
}

/** Klient rezerwuje wolny slot — tworzy zlecenie od razu w statusie SCHEDULED. */
export async function bookSlot(listingId: string, startISO: string): Promise<void> {
  const user = await requireAuth();
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) throw new Error("Nieprawidłowy termin");
  const dateISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const { listingTitle, providerUserId, slots } = await computeSlots(listingId, dateISO);
  if (providerUserId === user.id) throw new Error("Nie możesz zarezerwować własnej usługi");
  if (!slots.includes(start.toISOString())) throw new Error("Ten termin jest już zajęty — odśwież i wybierz inny");

  const listing = await prisma.serviceListing.findUnique({ where: { id: listingId }, select: { providerId: true } });
  if (!listing) throw new Error("Oferta nie istnieje");

  await prisma.serviceRequest.create({
    data: {
      clientId: user.id,
      providerId: listing.providerId,
      listingId,
      title: listingTitle,
      preferredAt: start,
      scheduledAt: start,
      status: "SCHEDULED",
    },
  });
  await notifyUser({
    userId: providerUserId,
    module: "services",
    title: `Nowa rezerwacja: ${listingTitle}`,
    body: start.toLocaleString("pl-PL"),
    href: "/services/provider",
    dedupeKey: null,
  });
  revalidatePath("/services/requests");
  revalidatePath("/services/provider");
}

/** M12: zmiana terminu umówionego zlecenia (klient lub wykonawca). */
export async function rescheduleRequest(requestId: string, newStartISO: string): Promise<void> {
  const user = await requireAuth();
  const start = new Date(newStartISO);
  if (Number.isNaN(start.getTime())) throw new Error("Nieprawidłowy termin");
  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, title: true, status: true, clientId: true, listingId: true,
      provider: { select: { userId: true } },
      listing: { select: { bookingEnabled: true, durationMin: true } },
    },
  });
  if (!req) throw new Error("Zlecenie nie istnieje");
  const isClient = req.clientId === user.id;
  const isProvider = req.provider.userId === user.id;
  if (!isClient && !isProvider) throw new Error("Brak dostępu do zlecenia");
  if (req.status !== "SCHEDULED") throw new Error("Termin można zmienić tylko dla umówionego zlecenia");

  // Dla ofert z rezerwacją — nowy termin musi być wolnym slotem (z pominięciem bieżącego zlecenia).
  if (req.listingId && req.listing?.bookingEnabled && req.listing.durationMin) {
    const dateISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const { slots } = await computeSlots(req.listingId, dateISO, req.id);
    if (!slots.includes(start.toISOString())) throw new Error("Wybrany termin jest zajęty — wybierz inny");
  }

  await prisma.serviceRequest.update({ where: { id: requestId }, data: { scheduledAt: start } });
  const recipientUserId = isClient ? req.provider.userId : req.clientId;
  await notifyUser({
    userId: recipientUserId,
    module: "services",
    title: `Zmieniono termin: ${req.title}`,
    body: start.toLocaleString("pl-PL"),
    href: isClient ? "/services/provider" : "/services/requests",
    dedupeKey: null,
  });
  revalidatePath("/services/requests");
  revalidatePath("/services/provider");
}

// ─── M7 weryfikacja wykonawcy (admin) ──────────────────────────────────────

/** Admin nadaje/odbiera weryfikację wykonawcy (badge zaufania). */
export async function setProviderVerified(providerId: string, verified: boolean): Promise<void> {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
  const provider = await prisma.serviceProvider.update({
    where: { id: providerId },
    data: { verified },
    select: { userId: true, displayName: true },
  });
  if (verified) {
    await notifyUser({
      userId: provider.userId,
      module: "services",
      title: "Twój profil wykonawcy został zweryfikowany ✓",
      href: "/services/provider",
      dedupeKey: `provider-verified-${providerId}`,
    });
  }
  revalidatePath("/services");
  revalidatePath(`/services/providers/${providerId}`);
}

// ─── M9 płatności + faktury + spięcie z Portfelem ───────────────────────────

/** Wykonawca ustawia kwotę/metodę płatności za zlecenie (nie zmienia statusu PAID). */
export async function setServicePayment(
  requestId: string,
  amountGrosze: number,
  method: PaymentMethod,
  invoiceNo?: string | null
): Promise<void> {
  const user = await requireAuth();
  const { role } = await loadRequestAccess(requestId, user.id);
  if (role !== "provider") throw new Error("Tylko wykonawca ustala płatność");
  if (!Number.isFinite(amountGrosze) || amountGrosze <= 0) throw new Error("Nieprawidłowa kwota");
  const amount = Math.round(amountGrosze);
  await prisma.servicePayment.upsert({
    where: { requestId },
    create: { requestId, amount, method, invoiceNo: invoiceNo?.trim() || null },
    update: { amount, method, invoiceNo: invoiceNo?.trim() || null },
  });
  revalidatePath("/services/requests");
  revalidatePath("/services/provider");
}

/**
 * Wykonawca oznacza płatność jako opłaconą. Opcjonalnie księguje przychód w
 * wybranym elemencie Portfela (spięcie z Portfelem — opt-in). Powiadamia klienta.
 */
export async function markPaymentPaid(requestId: string, walletElementId?: string | null): Promise<void> {
  const user = await requireAuth();
  const { req, role } = await loadRequestAccess(requestId, user.id);
  if (role !== "provider") throw new Error("Tylko wykonawca może oznaczyć płatność");
  const payment = await prisma.servicePayment.findUnique({ where: { requestId } });
  if (!payment) throw new Error("Najpierw ustaw kwotę płatności");
  if (payment.status === "PAID") throw new Error("Płatność jest już oznaczona jako opłacona");

  await prisma.servicePayment.update({ where: { requestId }, data: { status: "PAID", paidAt: new Date() } });

  if (walletElementId) {
    // Księgowanie przychodu wykonawcy — kwota NETTO (po rabacie M16). addEntry waliduje własność elementu.
    await addEntry(walletElementId, {
      kind: "income",
      amount: (payment.amount - payment.discount) / 100,
      category: "Usługi",
      note: `Płatność: ${req.title}`,
    });
  }

  await notifyUser({
    userId: req.clientId,
    module: "services",
    title: `Płatność rozliczona: ${req.title}`,
    href: "/services/requests",
    dedupeKey: `payment-paid-${requestId}`,
  });
  revalidatePath("/services/requests");
  revalidatePath("/services/provider");
}

/** Klient księguje swój wydatek za opłacone zlecenie w wybranym elemencie Portfela (opt-in). */
export async function bookClientExpense(requestId: string, walletElementId: string): Promise<void> {
  const user = await requireAuth();
  const { req, role } = await loadRequestAccess(requestId, user.id);
  if (role !== "client") throw new Error("Tylko klient może zaksięgować swój wydatek");
  const payment = await prisma.servicePayment.findUnique({ where: { requestId } });
  if (!payment || payment.status !== "PAID") throw new Error("Płatność nie jest jeszcze rozliczona");
  await addEntry(walletElementId, {
    kind: "expense",
    amount: (payment.amount - payment.discount) / 100,
    category: "Usługi",
    note: `Usługa: ${req.title}`,
  });
  revalidatePath("/services/requests");
}

// ─── M11 ulubieni wykonawcy ─────────────────────────────────────────────────

export async function toggleFavorite(providerId: string): Promise<{ favored: boolean }> {
  const user = await requireAuth();
  const existing = await prisma.serviceFavorite.findUnique({
    where: { userId_providerId: { userId: user.id, providerId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.serviceFavorite.delete({ where: { id: existing.id } });
    revalidatePath("/services");
    revalidatePath(`/services/providers/${providerId}`);
    return { favored: false };
  }
  await prisma.serviceFavorite.create({ data: { userId: user.id, providerId } });
  revalidatePath("/services");
  revalidatePath(`/services/providers/${providerId}`);
  return { favored: true };
}

export async function getMyFavoriteProviders(): Promise<{ id: string; displayName: string; area: string | null; ratingAvg: number; ratingCount: number; verified: boolean }[]> {
  const user = await requireAuth();
  const favs = await prisma.serviceFavorite.findMany({
    where: { userId: user.id, provider: { visible: true } },
    orderBy: { createdAt: "desc" },
    select: { provider: { select: { id: true, displayName: true, area: true, ratingAvg: true, ratingCount: true, verified: true } } },
  });
  return favs.map((f) => f.provider);
}

// ─── M13 statystyki wykonawcy ───────────────────────────────────────────────

export type ProviderStats = {
  total: number;
  completed: number;
  active: number;
  cancelled: number;
  conversionPct: number; // completed / (total - active)
  revenue: number; // grosze (suma opłaconych płatności)
  ratingAvg: number;
  ratingCount: number;
};

export async function getProviderStats(): Promise<ProviderStats | null> {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findUnique({
    where: { userId: user.id },
    select: { id: true, ratingAvg: true, ratingCount: true },
  });
  if (!provider) return null;

  const [grouped, paid] = await Promise.all([
    prisma.serviceRequest.groupBy({
      by: ["status"],
      where: { providerId: provider.id },
      _count: { _all: true },
    }),
    prisma.servicePayment.aggregate({
      where: { status: "PAID", request: { providerId: provider.id } },
      _sum: { amount: true },
    }),
  ]);

  const countOf = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const total = grouped.reduce((acc, g) => acc + g._count._all, 0);
  const completed = countOf("COMPLETED");
  const cancelled = countOf("CANCELLED") + countOf("DECLINED");
  const active = countOf("REQUESTED") + countOf("ACCEPTED") + countOf("SCHEDULED") + countOf("IN_PROGRESS");
  const settled = total - active; // zlecenia rozstrzygnięte
  const conversionPct = settled > 0 ? Math.round((completed / settled) * 100) : 0;

  return {
    total, completed, active, cancelled, conversionPct,
    revenue: paid._sum.amount ?? 0,
    ratingAvg: provider.ratingAvg, ratingCount: provider.ratingCount,
  };
}

// ─── M16 kody rabatowe wykonawcy ────────────────────────────────────────────

async function requireMyProvider(userId: string): Promise<{ id: string }> {
  const provider = await prisma.serviceProvider.findUnique({ where: { userId }, select: { id: true } });
  if (!provider) throw new Error("Najpierw utwórz profil wykonawcy");
  return provider;
}

export async function getMyPromoCodes(): Promise<ServicePromoCodeDTO[]> {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!provider) return [];
  const rows = await prisma.servicePromoCode.findMany({ where: { providerId: provider.id }, orderBy: { createdAt: "desc" } });
  return rows.map((c) => ({
    id: c.id, code: c.code, kind: c.kind as PromoKind, value: c.value,
    minAmount: c.minAmount, maxUses: c.maxUses, usedCount: c.usedCount, active: c.active,
    expiresAt: c.expiresAt?.toISOString() ?? null,
  }));
}

export async function createPromoCode(data: {
  code: string;
  kind: PromoKind;
  value: number; // percent (1-100) lub PLN (przeliczane na grosze)
  minAmount?: number | null; // PLN
  maxUses?: number | null;
  expiresAt?: string | null;
}): Promise<void> {
  const user = await requireAuth();
  const provider = await requireMyProvider(user.id);
  const code = data.code.trim().toUpperCase();
  if (!code || code.length > 32) throw new Error("Podaj kod (max 32 znaki)");
  const kind: PromoKind = data.kind === "amount" ? "amount" : "percent";
  let value = Math.round(data.value);
  if (kind === "percent") {
    if (value < 1 || value > 100) throw new Error("Procent musi być w zakresie 1–100");
  } else {
    value = Math.round(data.value * 100); // PLN → grosze
    if (value <= 0) throw new Error("Kwota rabatu musi być > 0");
  }
  await prisma.servicePromoCode.create({
    data: {
      providerId: provider.id,
      code,
      kind,
      value,
      minAmount: data.minAmount != null ? Math.round(data.minAmount * 100) : null,
      maxUses: data.maxUses != null && data.maxUses > 0 ? Math.round(data.maxUses) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  }).catch(() => { throw new Error("Taki kod już istnieje"); });
  revalidatePath("/services/provider");
}

export async function togglePromoCode(id: string): Promise<void> {
  const user = await requireAuth();
  const provider = await requireMyProvider(user.id);
  const code = await prisma.servicePromoCode.findFirst({ where: { id, providerId: provider.id } });
  if (!code) throw new Error("Kod nie istnieje");
  await prisma.servicePromoCode.update({ where: { id }, data: { active: !code.active } });
  revalidatePath("/services/provider");
}

export async function deletePromoCode(id: string): Promise<void> {
  const user = await requireAuth();
  const provider = await requireMyProvider(user.id);
  await prisma.servicePromoCode.deleteMany({ where: { id, providerId: provider.id } });
  revalidatePath("/services/provider");
}

/** Klient/wykonawca stosuje kod rabatowy do płatności zlecenia (M16). */
export async function applyPromoCode(requestId: string, rawCode: string): Promise<{ discount: number }> {
  const user = await requireAuth();
  const { req } = await loadRequestAccess(requestId, user.id);
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error("Podaj kod rabatowy");

  const payment = await prisma.servicePayment.findUnique({ where: { requestId } });
  if (!payment) throw new Error("Najpierw wykonawca musi ustalić kwotę");
  if (payment.status === "PAID") throw new Error("Płatność jest już rozliczona");

  const promo = await prisma.servicePromoCode.findUnique({
    where: { providerId_code: { providerId: req.providerId, code } },
  });
  if (!promo || !promo.active) throw new Error("Nieprawidłowy lub nieaktywny kod");
  if (promo.expiresAt && promo.expiresAt < new Date()) throw new Error("Kod wygasł");
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) throw new Error("Kod osiągnął limit użyć");
  if (promo.minAmount != null && payment.amount < promo.minAmount) {
    throw new Error(`Kod wymaga kwoty min. ${(promo.minAmount / 100).toFixed(2)} ${payment.currency}`);
  }

  let discount = promo.kind === "percent"
    ? Math.floor((payment.amount * promo.value) / 100)
    : promo.value;
  discount = Math.min(discount, payment.amount); // rabat nie większy niż kwota

  // Zmiana kodu na inny: cofnij zużycie poprzedniego.
  if (payment.promoCode && payment.promoCode !== code) {
    await prisma.servicePromoCode.updateMany({
      where: { providerId: req.providerId, code: payment.promoCode, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
  await prisma.$transaction([
    prisma.servicePayment.update({ where: { requestId }, data: { promoCode: code, discount } }),
    ...(payment.promoCode === code ? [] : [prisma.servicePromoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } })]),
  ]);
  revalidatePath("/services/requests");
  revalidatePath("/services/provider");
  return { discount };
}

/** Usuwa zastosowany kod rabatowy z płatności. */
export async function clearPromoCode(requestId: string): Promise<void> {
  const user = await requireAuth();
  const { req } = await loadRequestAccess(requestId, user.id);
  const payment = await prisma.servicePayment.findUnique({ where: { requestId } });
  if (!payment || !payment.promoCode) return;
  if (payment.status === "PAID") throw new Error("Płatność jest już rozliczona");
  await prisma.$transaction([
    prisma.servicePayment.update({ where: { requestId }, data: { promoCode: null, discount: 0 } }),
    prisma.servicePromoCode.updateMany({
      where: { providerId: req.providerId, code: payment.promoCode, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    }),
  ]);
  revalidatePath("/services/requests");
}

// ─── M17 spory / moderacja ──────────────────────────────────────────────────

/** Strona zlecenia (klient/wykonawca) zgłasza problem. Jeden OPEN na zlecenie. */
export async function openDispute(requestId: string, reason: string, description?: string | null): Promise<void> {
  const user = await requireAuth();
  const { req, role } = await loadRequestAccess(requestId, user.id);
  const r = reason.trim();
  if (!r) throw new Error("Podaj powód zgłoszenia");

  const existing = await prisma.serviceDispute.findFirst({ where: { requestId, status: "OPEN" } });
  if (existing) throw new Error("Do tego zlecenia jest już otwarte zgłoszenie");

  await prisma.serviceDispute.create({
    data: { requestId, openedById: user.id, reason: r.slice(0, 120), description: description?.trim() || null },
  });

  // Powiadom drugą stronę.
  const otherUserId = role === "client" ? req.provider.userId : req.clientId;
  await notifyUser({
    userId: otherUserId,
    module: "services",
    title: `Zgłoszono problem: ${req.title}`,
    href: "/services/requests",
    dedupeKey: `dispute-open-${requestId}-${Date.now()}`,
  });
  revalidatePath("/services/requests");
  revalidatePath("/services/moderation");
}

/** Spory powiązane ze zleceniem (widoczne dla obu stron). */
export async function getRequestDisputes(requestId: string): Promise<ServiceDisputeDTO[]> {
  const user = await requireAuth();
  await loadRequestAccess(requestId, user.id);
  const rows = await prisma.serviceDispute.findMany({ where: { requestId }, orderBy: { createdAt: "desc" } });
  return rows.map((d) => ({
    id: d.id, reason: d.reason, description: d.description, status: d.status as DisputeStatus,
    resolution: d.resolution, mine: d.openedById === user.id,
    createdAt: d.createdAt.toISOString(), resolvedAt: d.resolvedAt?.toISOString() ?? null,
  }));
}

export type ModerationDisputeDTO = {
  id: string;
  reason: string;
  description: string | null;
  status: DisputeStatus;
  resolution: string | null;
  requestId: string;
  requestTitle: string;
  clientName: string | null;
  providerName: string;
  createdAt: string;
};

/** Moderacja (admin): lista sporów. Domyślnie otwarte. */
export async function getModerationDisputes(filter?: { status?: DisputeStatus }): Promise<ModerationDisputeDTO[]> {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Brak uprawnień moderacji");
  const rows = await prisma.serviceDispute.findMany({
    where: { status: filter?.status ?? "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      request: {
        select: { id: true, title: true, client: { select: { name: true } }, provider: { select: { displayName: true } } },
      },
    },
  });
  return rows.map((d) => ({
    id: d.id, reason: d.reason, description: d.description, status: d.status as DisputeStatus,
    resolution: d.resolution, requestId: d.requestId, requestTitle: d.request.title,
    clientName: d.request.client?.name ?? null, providerName: d.request.provider.displayName,
    createdAt: d.createdAt.toISOString(),
  }));
}

/** Moderator rozstrzyga spór (RESOLVED|REJECTED) i powiadamia obie strony. */
export async function resolveDispute(id: string, status: "RESOLVED" | "REJECTED", resolution?: string | null): Promise<void> {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Brak uprawnień moderacji");
  const dispute = await prisma.serviceDispute.findUnique({
    where: { id },
    include: { request: { select: { title: true, clientId: true, provider: { select: { userId: true } } } } },
  });
  if (!dispute) throw new Error("Zgłoszenie nie istnieje");

  await prisma.serviceDispute.update({
    where: { id },
    data: { status, resolution: resolution?.trim() || null, resolvedAt: new Date() },
  });

  const label = status === "RESOLVED" ? "rozwiązane" : "odrzucone";
  for (const uid of [dispute.request.clientId, dispute.request.provider.userId]) {
    await notifyUser({
      userId: uid,
      module: "services",
      title: `Zgłoszenie ${label}: ${dispute.request.title}`,
      href: "/services/requests",
      dedupeKey: `dispute-${status}-${id}`,
    });
  }
  revalidatePath("/services/moderation");
  revalidatePath("/services/requests");
}
