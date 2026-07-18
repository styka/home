"use server";

// 009-shopping-offline-sync — synchronizacja kolejki operacji offline na pozycjach Zakupów.
// Jedna, TOLERANCYJNA akcja: aplikuje operacje w kolejności `ts`, egzekwuje dostęp,
// rozwiązuje konflikty regułą „ostatni zapis wygrywa" (LWW), a operacji niewykonalnych
// (brak listy/pozycji/dostępu) NIE traktuje jako błędu — pomija je, żeby kolejka po stronie
// klienta nigdy się nie zablokowała (AC-6, AC-9).
//
// LWW jest liczone TYLKO przy pierwszym dotknięciu danej pozycji w tym przebiegu: kolejne
// nasze własne operacje (te same offline, np. NEEDED→IN_CART→DONE albo add→edit) muszą wygrać
// nad wcześniejszymi, mimo że każda z nich podbija `updatedAt`. Konflikt wykrywamy więc tylko
// względem stanu serwera SPRZED naszego batcha (zmiana innego klienta nowsza niż `op.ts`).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { assertListAccess } from "@/actions/lists";
import { categorize } from "@/lib/categorize";
import { upsertUserProduct } from "@/actions/products";
import { trackActivity } from "@/actions/activity";
import type { OfflineOp, SyncResult } from "@/lib/shopping/offlineTypes";

async function nextCategoryOrder(listId: string, category: string): Promise<number> {
  const agg = await prisma.item.aggregate({ where: { listId, category }, _max: { order: true } });
  return (agg._max.order ?? -1) + 1;
}

export async function syncShoppingMutations(ops: OfflineOp[]): Promise<SyncResult> {
  const user = await requireAuth();
  const applied: string[] = [];
  const skipped: string[] = [];
  const touchedLists = new Set<string>();
  const accessCache = new Map<string, boolean>();
  // Stan pozycji w obrębie tego przebiegu: "applied" = już ją zmieniliśmy (nasze kolejne ops
  // wygrywają bez LWW); "conflict" = serwer był nowszy przy pierwszym dotknięciu (wszystkie
  // nasze ops na niej przegrywają).
  const resolved = new Map<string, "applied" | "conflict">();

  // Odtwarzamy w kolejności wykonania offline.
  const sorted = [...ops].sort((a, b) => a.ts - b.ts);

  for (const op of sorted) {
    // Guard dostępu (cache per lista). Brak listy / brak dostępu → pomiń (nie rzucaj) — AC-9.
    let hasAccess = accessCache.get(op.listId);
    if (hasAccess === undefined) {
      try {
        await assertListAccess(op.listId, user.id);
        hasAccess = true;
      } catch {
        hasAccess = false;
      }
      accessCache.set(op.listId, hasAccess);
    }
    if (!hasAccess) {
      skipped.push(op.opId);
      continue;
    }

    try {
      if (op.type === "add") {
        const existing = await prisma.item.findUnique({ where: { id: op.itemId } });
        if (existing) {
          // Podwójna synchronizacja — pozycja już utworzona wcześniej. Idempotentnie: zrobione.
          applied.push(op.opId);
          resolved.set(op.itemId, "applied");
          touchedLists.add(op.listId);
          continue;
        }
        const name = (op.payload?.name ?? "").trim().toLowerCase();
        if (!name) { skipped.push(op.opId); continue; }
        const category = op.payload?.category?.trim() || categorize(name);
        const unit = op.payload?.unit ?? null;
        await prisma.item.create({
          data: {
            id: op.itemId,
            listId: op.listId,
            name,
            quantity: op.payload?.quantity ?? null,
            unit,
            category,
            status: op.payload?.status ?? "NEEDED",
            price: op.payload?.price ?? null,
            order: await nextCategoryOrder(op.listId, category),
          },
        });
        // Utrzymanie słowników jak w addItemStructured.
        await prisma.itemHistory.upsert({
          where: { name },
          update: { useCount: { increment: 1 }, category, unit: unit ?? undefined, updatedAt: new Date() },
          create: { name, category, unit },
        });
        await upsertUserProduct(name, unit, category);
        applied.push(op.opId);
        resolved.set(op.itemId, "applied");
        touchedLists.add(op.listId);
        continue;
      }

      // status / update / delete — jeśli już rozstrzygnięte jako konflikt, pomiń.
      if (resolved.get(op.itemId) === "conflict") {
        skipped.push(op.opId);
        continue;
      }

      const item = await prisma.item.findUnique({ where: { id: op.itemId } });
      if (!item || item.listId !== op.listId) {
        // Pozycja skasowana/przeniesiona na serwerze — dla delete cel i tak osiągnięty.
        if (op.type === "delete") applied.push(op.opId);
        else skipped.push(op.opId);
        continue;
      }

      // LWW tylko przy PIERWSZYM dotknięciu: jeśli serwer zmieniono później niż nasza operacja
      // offline (inny klient) — serwer wygrywa. (AC-6)
      if (resolved.get(op.itemId) !== "applied" && item.updatedAt.getTime() > op.ts) {
        resolved.set(op.itemId, "conflict");
        skipped.push(op.opId);
        continue;
      }

      if (op.type === "status") {
        if (op.payload?.status) {
          await prisma.item.update({ where: { id: op.itemId }, data: { status: op.payload.status } });
        }
      } else if (op.type === "update") {
        const data: {
          name?: string;
          quantity?: number | null;
          unit?: string | null;
          notes?: string | null;
          price?: number | null;
        } = {};
        const p = op.payload ?? {};
        if (p.name !== undefined) data.name = p.name.trim();
        if (p.quantity !== undefined) data.quantity = p.quantity;
        if (p.unit !== undefined) data.unit = p.unit;
        if (p.notes !== undefined) data.notes = p.notes;
        if (p.price !== undefined) data.price = p.price;
        if (Object.keys(data).length > 0) {
          await prisma.item.update({ where: { id: op.itemId }, data });
        }
      } else if (op.type === "delete") {
        await prisma.item.delete({ where: { id: op.itemId } });
      }
      applied.push(op.opId);
      resolved.set(op.itemId, "applied");
      touchedLists.add(op.listId);
    } catch {
      // Nieoczekiwany błąd pojedynczej operacji — pomiń, nie blokuj reszty kolejki (AC-9).
      skipped.push(op.opId);
    }
  }

  if (touchedLists.size > 0) {
    revalidatePath("/shopping");
    touchedLists.forEach((listId) => revalidatePath(`/shopping/${listId}`));
    void trackActivity("shopping", "offline_sync", { applied: applied.length, skipped: skipped.length });
  }

  return { applied, skipped };
}
