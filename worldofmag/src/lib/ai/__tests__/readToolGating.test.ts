import { test } from "node:test";
import assert from "node:assert/strict";

// Z-181 (kontrakt read-toolów agenta) + regresja Z-055/Z-270 (bramki prywatności):
// asystent czyta dane finansowe tylko gdy nie wyłączono (opt-out), a dane zdrowotne
// tylko po opt-in. DB-gated.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

function isNote(result: unknown): boolean {
  return Array.isArray(result) && result.length === 1 && typeof (result[0] as { note?: unknown })?.note === "string";
}

test("Z-181: bramki prywatności read-toolów (finanse opt-out, zdrowie opt-in) + izolacja", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { runReadTool } = await import("@/lib/ai/agentTools");

  const A = await prisma.user.create({ data: { email: `rtg-a-${rnd()}@test.local` } });
  const B = await prisma.user.create({ data: { email: `rtg-b-${rnd()}@test.local` } });
  const walletA = await prisma.walletElement.create({ data: { name: "Konto A", kind: "account", balance: 1000, ownerId: A.id } });
  await prisma.walletElement.create({ data: { name: "Konto B", kind: "account", balance: 9999, ownerId: B.id } });
  await prisma.healthEvent.create({ data: { title: "Wizyta A", kind: "VISIT", scheduledAt: new Date(), ownerId: A.id } });

  try {
    await t.test("list_wallet: domyślnie (brak FinanceSettings) zwraca własne konta, nie cudze", async () => {
      const res = (await runReadTool("list_wallet", {}, A.id)) as Array<{ id: string }>;
      assert.ok(Array.isArray(res) && !isNote(res), "domyślnie dane, nie nota");
      assert.ok(res.some((r) => r.id === walletA.id), "widać własne konto A");
      assert.ok(!res.some((r) => (r as { name?: string }).name === "Konto B"), "NIE widać konta B (izolacja)");
    });

    await t.test("list_wallet: po wyłączeniu aiAccessEnabled → nota zamiast danych (Z-055)", async () => {
      await prisma.financeSettings.create({ data: { userId: A.id, aiAccessEnabled: false } });
      const res = await runReadTool("list_wallet", {}, A.id);
      assert.ok(isNote(res), "zwraca notę o wyłączonym dostępie");
    });

    await t.test("list_health_events: bez opt-in → nota (Z-270)", async () => {
      const res = await runReadTool("list_health_events", {}, A.id);
      assert.ok(isNote(res), "domyślnie zdrowie zablokowane → nota");
    });

    await t.test("list_health_events: po opt-in → dane", async () => {
      await prisma.healthSettings.create({ data: { userId: A.id, aiOptIn: true } });
      const res = (await runReadTool("list_health_events", {}, A.id)) as Array<{ title: string }>;
      assert.ok(Array.isArray(res) && !isNote(res), "po opt-in dane, nie nota");
      assert.ok(res.some((r) => r.title === "Wizyta A"), "widać wizytę A");
    });
  } finally {
    await prisma.healthSettings.deleteMany({ where: { userId: { in: [A.id, B.id] } } });
    await prisma.financeSettings.deleteMany({ where: { userId: { in: [A.id, B.id] } } });
    await prisma.healthEvent.deleteMany({ where: { ownerId: { in: [A.id, B.id] } } });
    await prisma.walletElement.deleteMany({ where: { ownerId: { in: [A.id, B.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  }
});
