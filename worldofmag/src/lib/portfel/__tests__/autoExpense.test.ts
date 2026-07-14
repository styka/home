import { test } from "node:test";
import assert from "node:assert/strict";

// Z-174: auto-księgowanie wydatków cross-module → Portfel (poprawność salda,
// idempotencja po (module, sourceId), odwracanie). DB-gated.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-174 bookAutoExpense: księguje, jest idempotentne, koryguje i odwraca saldo", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { bookAutoExpense, removeAutoExpense } = await import("@/lib/portfel/autoExpense");

  const user = await prisma.user.create({ data: { email: `ae-${rnd()}@test.local` } });
  const el = await prisma.walletElement.create({ data: { name: "Konto", ownerId: user.id, balance: 1000 } });
  await prisma.financeSettings.create({ data: { userId: user.id, autoExpenseElementId: el.id, autoExpenseEnabled: true } });
  const bal = async () => (await prisma.walletElement.findUnique({ where: { id: el.id } }))!.balance;
  const entries = (sourceId: string) => prisma.walletEntry.findMany({ where: { sourceModule: "flota", sourceId } });

  try {
    await t.test("księguje wydatek i obniża saldo", async () => {
      await bookAutoExpense(user.id, { module: "flota", sourceId: "s1", amount: 100, category: "Paliwo" });
      const e = await entries("s1");
      assert.equal(e.length, 1);
      assert.equal(e[0].delta, -100);
      assert.equal(e[0].kind, "expense");
      assert.equal(await bal(), 900);
    });

    await t.test("ponowne wywołanie tego samego źródła AKTUALIZUJE (brak duplikatu), koryguje saldo o różnicę", async () => {
      await bookAutoExpense(user.id, { module: "flota", sourceId: "s1", amount: 150, category: "Paliwo" });
      const e = await entries("s1");
      assert.equal(e.length, 1, "wciąż jeden wpis");
      assert.equal(e[0].delta, -150);
      assert.equal(await bal(), 850); // 900 + (-150 - (-100))
    });

    await t.test("removeAutoExpense usuwa wpis i odwraca saldo", async () => {
      await removeAutoExpense("flota", "s1");
      assert.equal((await entries("s1")).length, 0);
      assert.equal(await bal(), 1000);
    });

    await t.test("gdy auto-księgowanie wyłączone → nic; force wymusza", async () => {
      await prisma.financeSettings.update({ where: { userId: user.id }, data: { autoExpenseEnabled: false } });
      await bookAutoExpense(user.id, { module: "flota", sourceId: "s2", amount: 50, category: "x" });
      assert.equal((await entries("s2")).length, 0, "wyłączone — brak wpisu");
      await bookAutoExpense(user.id, { module: "flota", sourceId: "s3", amount: 50, category: "x", force: true });
      assert.equal((await entries("s3")).length, 1, "force wymusza mimo wyłączenia");
    });

    await t.test("kwota zerowa/NaN → nic", async () => {
      await bookAutoExpense(user.id, { module: "flota", sourceId: "s4", amount: 0, category: "x", force: true });
      assert.equal((await entries("s4")).length, 0);
    });
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});
