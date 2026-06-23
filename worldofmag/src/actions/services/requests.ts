"use server";

// Z-213/361: akcje modułu Usługi — zlecenia (tworzenie, status, anulowanie, lista, zmiana terminu).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { notifyUser } from "@/actions/notifications";
import { REQUEST_STATUS_LABELS } from "@/lib/services";
import { PROVIDER_TRANSITIONS, mapRequest, computeSlots } from "@/lib/services/helpers";
import type { RequestStatus, RequestDTO } from "@/lib/services";

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
