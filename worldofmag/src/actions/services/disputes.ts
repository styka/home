"use server";

// Z-213/361: akcje modułu Usługi — spory/moderacja (wyodrębnione z actions/services.ts).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { notifyUser } from "@/actions/notifications";
import { loadRequestAccess } from "@/lib/services/access";
import type { ServiceDisputeDTO, DisputeStatus, ModerationDisputeDTO } from "@/lib/services";

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
