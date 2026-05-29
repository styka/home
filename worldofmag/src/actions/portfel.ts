"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { trackActivity } from "@/actions/activity";
import type { WalletElement, WalletEntry } from "@prisma/client";

export type ElementWithEntries = WalletElement & { entries: WalletEntry[] };

/** Saldo elementu wpływające na majątek netto (długi liczone na minus). */
function signedBalance(el: { kind: string; balance: number }): number {
  return el.kind === "debt" ? -el.balance : el.balance;
}

async function ownershipFilter(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  return { OR: [{ ownerId: userId }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])] };
}

async function assertElementAccess(elementId: string, userId: string): Promise<WalletElement> {
  const el = await prisma.walletElement.findUnique({ where: { id: elementId } });
  if (!el) throw new Error("Element portfela nie istnieje");
  if (el.ownerId === userId) return el;
  if (el.ownerTeamId) {
    const teamIds = await getUserTeamIds(userId);
    if (teamIds.includes(el.ownerTeamId)) return el;
  }
  throw new Error("Brak dostępu do elementu portfela");
}

export async function getWalletElements(): Promise<WalletElement[]> {
  const user = await requireAuth();
  const where = await ownershipFilter(user.id);
  return prisma.walletElement.findMany({ where, orderBy: [{ archived: "asc" }, { createdAt: "asc" }] });
}

export interface WalletOverview {
  elements: WalletElement[];
  totalNet: number;
  currency: string;
  series: { x: number; y: number; label: string }[]; // saldo całości w czasie
  monthlyRate: number; // tempo zmian majątku [waluta / miesiąc]
  projection6m: number; // prognoza majątku za 6 miesięcy
}

export async function getWalletOverview(): Promise<WalletOverview> {
  const user = await requireAuth();
  const where = await ownershipFilter(user.id);
  const elements = await prisma.walletElement.findMany({
    where,
    orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
    include: { entries: { orderBy: { date: "asc" } } },
  });

  const active = elements.filter((e) => !e.archived);
  const totalNet = active.reduce((s, e) => s + signedBalance(e), 0);
  const currency = active[0]?.currency ?? "PLN";

  // Szereg czasowy majątku: dla każdego znacznika czasu sumujemy ostatnie znane saldo
  // każdego elementu (funkcje schodkowe) — skala osobista, więc O(wpisy*elementy) wystarcza.
  const stamps = Array.from(
    new Set(active.flatMap((e) => e.entries.map((en) => new Date(en.date).getTime()))),
  ).sort((a, b) => a - b);

  const series = stamps.map((t) => {
    let total = 0;
    for (const el of active) {
      const past = el.entries.filter((en) => new Date(en.date).getTime() <= t);
      if (past.length === 0) continue;
      const bal = past[past.length - 1].balanceAfter;
      total += el.kind === "debt" ? -bal : bal;
    }
    return { x: t, y: total, label: new Date(t).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "2-digit" }) };
  });

  // Prognoza: regresja liniowa po (dni, majątek) → nachylenie na dzień.
  let monthlyRate = 0;
  let projection6m = totalNet;
  if (series.length >= 2) {
    const x0 = series[0].x;
    const day = 86_400_000;
    const pts = series.map((p) => ({ d: (p.x - x0) / day, y: p.y }));
    const n = pts.length;
    const sx = pts.reduce((s, p) => s + p.d, 0);
    const sy = pts.reduce((s, p) => s + p.y, 0);
    const sxx = pts.reduce((s, p) => s + p.d * p.d, 0);
    const sxy = pts.reduce((s, p) => s + p.d * p.y, 0);
    const denom = n * sxx - sx * sx;
    if (denom !== 0) {
      const slope = (n * sxy - sx * sy) / denom; // na dzień
      monthlyRate = slope * 30;
      projection6m = totalNet + slope * 182;
    }
  }

  return { elements, totalNet, currency, series, monthlyRate, projection6m };
}

export async function getElement(id: string): Promise<ElementWithEntries | null> {
  const user = await requireAuth();
  await assertElementAccess(id, user.id);
  return prisma.walletElement.findUnique({
    where: { id },
    include: { entries: { orderBy: { date: "desc" } } },
  });
}

export async function createElement(data: {
  name: string;
  kind?: string;
  currency?: string;
  initialBalance?: number;
  note?: string | null;
  ownerTeamId?: string | null;
}): Promise<WalletElement> {
  const user = await requireAuth();
  const name = data.name?.trim();
  if (!name) throw new Error("Nazwa elementu jest wymagana");

  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Brak dostępu do zespołu");
  }

  const initial = data.initialBalance ?? 0;
  const el = await prisma.walletElement.create({
    data: {
      name,
      kind: data.kind ?? "account",
      currency: data.currency ?? "PLN",
      balance: initial,
      note: data.note?.trim() || null,
      ownerId: data.ownerTeamId ? null : user.id,
      ownerTeamId: data.ownerTeamId ?? null,
      entries: {
        create: { balanceAfter: initial, delta: initial, kind: "adjustment", note: "Saldo początkowe" },
      },
    },
  });
  void trackActivity("portfel", "create_element", { name });
  revalidatePath("/portfel");
  return el;
}

/** Przychód lub rozchód: zmienia saldo o `amount` i zapisuje wpis historii. */
export async function addEntry(
  elementId: string,
  data: { kind: "income" | "expense"; amount: number; date?: Date | null; category?: string | null; note?: string | null },
): Promise<WalletEntry> {
  const user = await requireAuth();
  const el = await assertElementAccess(elementId, user.id);
  const amount = Math.abs(data.amount);
  if (!amount || isNaN(amount)) throw new Error("Podaj kwotę większą od zera");

  const delta = data.kind === "income" ? amount : -amount;
  const balanceAfter = el.balance + delta;

  const [entry] = await prisma.$transaction([
    prisma.walletEntry.create({
      data: {
        elementId,
        date: data.date ?? new Date(),
        balanceAfter,
        delta,
        kind: data.kind,
        category: data.category?.trim() || null,
        note: data.note?.trim() || null,
      },
    }),
    prisma.walletElement.update({ where: { id: elementId }, data: { balance: balanceAfter } }),
  ]);
  void trackActivity("portfel", "add_entry", { elementId, kind: data.kind, amount });
  revalidatePath("/portfel");
  revalidatePath(`/portfel/${elementId}`);
  return entry;
}

/** Korekta: ustawia saldo na wartość docelową, zapisując deltę jako wpis. */
export async function setBalance(
  elementId: string,
  data: { targetBalance: number; date?: Date | null; note?: string | null },
): Promise<WalletEntry> {
  const user = await requireAuth();
  const el = await assertElementAccess(elementId, user.id);
  const target = data.targetBalance;
  if (isNaN(target)) throw new Error("Nieprawidłowe saldo");
  const delta = target - el.balance;

  const [entry] = await prisma.$transaction([
    prisma.walletEntry.create({
      data: {
        elementId,
        date: data.date ?? new Date(),
        balanceAfter: target,
        delta,
        kind: "adjustment",
        note: data.note?.trim() || null,
      },
    }),
    prisma.walletElement.update({ where: { id: elementId }, data: { balance: target } }),
  ]);
  void trackActivity("portfel", "set_balance", { elementId, target });
  revalidatePath("/portfel");
  revalidatePath(`/portfel/${elementId}`);
  return entry;
}

export async function updateElement(
  id: string,
  patch: Partial<{ name: string; kind: string; currency: string; note: string | null }>,
): Promise<WalletElement> {
  const user = await requireAuth();
  await assertElementAccess(id, user.id);
  const el = await prisma.walletElement.update({ where: { id }, data: patch });
  revalidatePath("/portfel");
  revalidatePath(`/portfel/${id}`);
  return el;
}

export async function archiveElement(id: string, archived: boolean): Promise<void> {
  const user = await requireAuth();
  await assertElementAccess(id, user.id);
  await prisma.walletElement.update({ where: { id }, data: { archived } });
  revalidatePath("/portfel");
  revalidatePath(`/portfel/${id}`);
}

export async function deleteElement(id: string): Promise<void> {
  const user = await requireAuth();
  await assertElementAccess(id, user.id);
  await prisma.walletElement.delete({ where: { id } });
  revalidatePath("/portfel");
}
