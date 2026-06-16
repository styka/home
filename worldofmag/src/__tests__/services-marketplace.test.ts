/**
 * Z-173 / Z-360 — testy ścieżki płatności, wycen i sporów (Marketplace).
 *
 * - `netAmount` (czysty): poprawne netto po rabacie (grosze → złotówki).
 * - `loadRequestAccess` (DB-gated): izolacja dwustronna — tylko klient i wykonawca
 *   mają dostęp do zlecenia; obcy odrzucony. To guard, na którym opierają się
 *   markPaymentPaid / bookClientExpense / sendQuote / respondToQuote / openDispute.
 *
 * Bez `DATABASE_URL` blok DB jest pomijany (test:unit zielony bez bazy).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { netAmount } from "@/lib/services/payment";

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-173: netAmount liczy netto po rabacie (grosze→PLN)", () => {
  assert.equal(netAmount({ amount: 10000, discount: 1500 }), 85);
  assert.equal(netAmount({ amount: 5000, discount: 0 }), 50);
  assert.equal(netAmount({ amount: 12345, discount: 345 }), 120);
});

test("Z-173/Z-360: loadRequestAccess — izolacja klient/wykonawca, obcy odrzucony", { skip: !HAS_DB && "brak DATABASE_URL" }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { loadRequestAccess } = await import("@/lib/services/access");

  const client = await prisma.user.create({ data: { email: `cli-${rnd()}@test.local`, name: "Client" } });
  const provUser = await prisma.user.create({ data: { email: `prov-${rnd()}@test.local`, name: "Provider" } });
  const stranger = await prisma.user.create({ data: { email: `str-${rnd()}@test.local`, name: "Stranger" } });

  try {
    const provider = await prisma.serviceProvider.create({ data: { userId: provUser.id, displayName: "P" } });
    const listing = await prisma.serviceListing.create({ data: { providerId: provider.id, title: "Usługa" } });
    const req = await prisma.serviceRequest.create({
      data: { clientId: client.id, providerId: provider.id, listingId: listing.id, title: "Zlecenie" },
    });

    await t.test("klient → rola 'client'", async () => {
      const { role } = await loadRequestAccess(req.id, client.id);
      assert.equal(role, "client");
    });
    await t.test("wykonawca → rola 'provider'", async () => {
      const { role } = await loadRequestAccess(req.id, provUser.id);
      assert.equal(role, "provider");
    });
    await t.test("obcy → odrzucony", async () => {
      await assert.rejects(() => loadRequestAccess(req.id, stranger.id), /Brak dostępu/);
    });
    await t.test("nieistniejące zlecenie → błąd", async () => {
      await assert.rejects(() => loadRequestAccess("nope-id", client.id), /nie istnieje/);
    });

    await prisma.serviceRequest.delete({ where: { id: req.id } });
    await prisma.serviceListing.delete({ where: { id: listing.id } });
    await prisma.serviceProvider.delete({ where: { id: provider.id } });
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [client.id, provUser.id, stranger.id] } } });
  }
});
