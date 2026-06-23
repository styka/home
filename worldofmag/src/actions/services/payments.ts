"use server";

// Z-213/361: akcje modułu Usługi — płatności/faktury + spięcie z Portfelem (M9).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { notifyUser } from "@/actions/notifications";
import { addEntry } from "@/actions/portfel";
import { loadRequestAccess } from "@/lib/services/access";
import { netAmount } from "@/lib/services/payment";
import type { PaymentMethod } from "@/lib/services";

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
      amount: netAmount(payment),
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
