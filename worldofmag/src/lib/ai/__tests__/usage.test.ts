import { test } from "node:test";
import assert from "node:assert/strict";

// Z-130/Z-511/Z-174: testy egzekwowania budżetu AI (kod kosztowy z tej sesji).
// DB-gated — wymaga Postgresa (AiUsage/Subscription). Bez DATABASE_URL pomijane.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-130 budżet AI: free limit egzekwowany, premium większy, licznik rośnie", { skip: !HAS_DB && "brak DATABASE_URL" }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { checkAiBudget, recordAiUsage } = await import("@/lib/ai/usage");
  const { getActivePlan, PLANS } = await import("@/lib/plans");

  const A = await prisma.user.create({ data: { email: `usg-a-${rnd()}@test.local` } }); // free (brak subskrypcji)
  const B = await prisma.user.create({ data: { email: `usg-b-${rnd()}@test.local` } });
  await prisma.subscription.create({ data: { userId: B.id, planKey: "premium", status: "active" } });

  try {
    await t.test("plan: brak subskrypcji → free; subskrypcja premium → premium", async () => {
      assert.equal((await getActivePlan(A.id)).key, "free");
      assert.equal((await getActivePlan(B.id)).key, "premium");
    });

    await t.test("świeży user mieści się w budżecie", async () => {
      assert.equal((await checkAiBudget(A.id)).ok, true);
    });

    await t.test("przekroczenie dziennego budżetu tokenów (free) → zablokowane", async () => {
      await recordAiUsage(A.id, PLANS.free.aiDailyTokens); // dokładnie limit
      const r = await checkAiBudget(A.id);
      assert.equal(r.ok, false);
      if (!r.ok) assert.match(r.message, /darmowy/);
    });

    await t.test("premium ma wyższy limit — ta sama liczba tokenów mieści się", async () => {
      await recordAiUsage(B.id, PLANS.free.aiDailyTokens);
      assert.equal((await checkAiBudget(B.id)).ok, true);
    });

    await t.test("recordAiUsage zwiększa licznik zapytań", async () => {
      const C = await prisma.user.create({ data: { email: `usg-c-${rnd()}@test.local` } });
      await recordAiUsage(C.id, 10);
      await recordAiUsage(C.id, 5);
      const day = new Date().toISOString().slice(0, 10);
      const row = await prisma.aiUsage.findUnique({ where: { userId_day: { userId: C.id, day } } });
      assert.equal(row?.requests, 2);
      assert.equal(row?.tokens, 15);
      await prisma.user.delete({ where: { id: C.id } });
    });
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [A.id, B.id] } } }); // cascade AiUsage/Subscription
  }
});
