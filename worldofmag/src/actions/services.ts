"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { notifyUser } from "@/actions/notifications";
import { REQUEST_STATUS_LABELS } from "@/lib/services";
import type {
  RequestStatus,
  PriceModel,
  ServiceCategoryDTO,
  ListingDTO,
  RequestDTO,
  RequestThreadDTO,
  QuoteStatus,
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
  category: { id: string; name: string; icon: string; color: string } | null;
  provider: { id: string; displayName: string; area: string | null; ratingAvg: number; ratingCount: number };
}): ListingDTO {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    priceModel: (l.priceModel as PriceModel) ?? "quote",
    priceAmount: l.priceAmount,
    currency: l.currency,
    active: l.active,
    category: l.category,
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
    },
  });
}

export async function upsertServiceProvider(data: {
  displayName: string;
  bio?: string | null;
  area?: string | null;
  phone?: string | null;
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
}): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const title = data.title.trim();
  if (!title) throw new Error("Tytuł oferty jest wymagany");

  const priceModel: PriceModel = data.priceModel ?? "quote";
  await prisma.serviceListing.create({
    data: {
      providerId: provider.id,
      title,
      description: data.description?.trim() || null,
      categoryId: data.categoryId || null,
      priceModel,
      priceAmount: priceModel === "quote" ? null : data.priceAmount ?? null,
      currency: data.currency?.trim() || "PLN",
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
  }
): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const listing = await prisma.serviceListing.findUnique({ where: { id }, select: { providerId: true } });
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
  // Wycena indywidualna nie ma kwoty.
  if (data.priceModel === "quote") data.priceAmount = null;

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
}): Promise<ListingDTO[]> {
  await requireAuth();
  const q = filters?.query?.trim();
  const listings = await prisma.serviceListing.findMany({
    where: {
      active: true,
      provider: { visible: true },
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
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
    orderBy: [{ provider: { ratingAvg: "desc" } }, { createdAt: "desc" }],
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      provider: { select: { id: true, displayName: true, area: true, ratingAvg: true, ratingCount: true } },
    },
    take: 100,
  });
  return listings.map(toListingDTO);
}

export async function getListing(id: string): Promise<ListingDTO | null> {
  await requireAuth();
  const l = await prisma.serviceListing.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      provider: { select: { id: true, displayName: true, area: true, ratingAvg: true, ratingCount: true } },
    },
  });
  return l ? toListingDTO(l) : null;
}

export async function getProviderPublic(providerId: string) {
  await requireAuth();
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
  return provider;
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
  listing: { title: string } | null;
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
    clientName: r.client.name ?? "Klient",
    providerName: r.provider.displayName,
    hasReview: r.review != null,
    rating: r.review?.rating ?? null,
  };
}

export async function getMyRequests(): Promise<{ asClient: RequestDTO[]; asProvider: RequestDTO[] }> {
  const user = await requireAuth();
  const include = {
    listing: { select: { title: true } },
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

  const [messages, quotes] = await Promise.all([
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
