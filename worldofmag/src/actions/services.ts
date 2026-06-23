"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { notifyUser } from "@/actions/notifications";
import { addEntry } from "@/actions/portfel";
import { loadRequestAccess } from "@/lib/services/access";
import { netAmount } from "@/lib/services/payment";
import { haversineKm } from "@/lib/serviceGeo";
import { REQUEST_STATUS_LABELS } from "@/lib/services";
import {
  PROVIDER_TRANSITIONS, PROVIDER_CARD_SELECT,
  toListingDTO, uniqueProviderSlug, requireOwnProvider,
  requireMyProvider, mapRequest, computeSlots,
} from "@/lib/services/helpers";
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
  ListingSort,
} from "@/lib/services";

// ─── Helpery: przeniesione do @/lib/services/helpers.ts (Z-213/361) ──────────

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

// M19: slug z nazwy (ASCII, myślniki). Wynik unikalny dzięki sufiksowi liczbowemu.
export async function upsertServiceProvider(data: {
  displayName: string;
  tagline?: string | null;
  bio?: string | null;
  area?: string | null;
  phone?: string | null;
  nip?: string | null;
  visible?: boolean;
}): Promise<void> {
  const user = await requireAuth();
  const displayName = data.displayName.trim();
  if (!displayName) throw new Error("Nazwa wykonawcy jest wymagana");

  const existing = await prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { id: true, slug: true } });
  // Slug nadajemy raz (przy tworzeniu lub gdy go brak) — stabilny link do udostępniania.
  const slug = existing?.slug ?? (await uniqueProviderSlug(displayName, existing?.id ?? null));

  const fields = {
    displayName,
    tagline: data.tagline?.trim() || null,
    bio: data.bio?.trim() || null,
    area: data.area?.trim() || null,
    phone: data.phone?.trim() || null,
    nip: data.nip?.trim() || null,
    visible: data.visible ?? true,
    slug,
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

/** M19: akceptuje id LUB slug (czytelny link do udostępniania). */
export async function getProviderPublic(idOrSlug: string) {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
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
    where: { userId_providerId: { userId: user.id, providerId: provider.id } },
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


export async function getMyRequests(): Promise<{ asClient: RequestDTO[]; asProvider: RequestDTO[] }> {
  const user = await requireAuth();
  const include = {
    listing: { select: { title: true, bookingEnabled: true, durationMin: true } },
    client: { select: { name: true } },
    provider: { select: { displayName: true } },
    staff: { select: { name: true } },
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

// loadRequestAccess przeniesione do `@/lib/services/access` (testowalne, Z-173/Z-360).

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


/** M12: zmiana terminu umówionego zlecenia (klient lub wykonawca). */
export async function rescheduleRequest(requestId: string, newStartISO: string): Promise<void> {
  const user = await requireAuth();
  const start = new Date(newStartISO);
  if (Number.isNaN(start.getTime())) throw new Error("Nieprawidłowy termin");
  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, title: true, status: true, clientId: true, listingId: true, staffId: true,
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
    const { slots } = await computeSlots(req.listingId, dateISO, { excludeRequestId: req.id, staffId: req.staffId });
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

