"use server";

// Z-213/361: akcje modułu Usługi — oceny + wątek zlecenia (czat M1 + wyceny M3).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { notifyUser } from "@/actions/notifications";
import { loadRequestAccess } from "@/lib/services/access";
import type { RequestStatus, RequestThreadDTO, QuoteStatus, PaymentMethod, PaymentStatus } from "@/lib/services";

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
