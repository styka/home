import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 073 (zadanie 25, rozdz. 9.5) — SUBSKRYBENT PORTFELA NA REALNYM POSTGRESIE.
 *
 * Trzy rzeczy do udowodnienia, bo trzy mogą pójść źle:
 *  1. reakcja w ogóle księguje (inaczej przepięcie z wywołania na zdarzenie **cicho gubi** wydatek —
 *     nikt tego nie zauważy, bo zakupy i tak się zamykają);
 *  2. drugie dostarczenie nie księguje po raz drugi (gwarancja „co najmniej raz", rozdz. 9.4.4);
 *  3. zakupy ZESPOŁOWE nie trafiają na prywatne konto sprawcy — to reguła, która przy tej zmianie
 *     przeniosła się z `completeShopping` do Portfela i najłatwiej ją zgubić po drodze.
 *
 * Bramka `check:subscribers` sprawdza tylko OBECNOŚĆ wzorca idempotencji. Że wzorzec działa,
 * dowodzi wyłącznie ten test, bo mierzy SKUTEK — saldo i liczbę wpisów.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

type Rekord = Parameters<
  Awaited<typeof import("../events")>["default"]["subscribers"][number]["handle"]
>[0];

function rekordZdarzenia(over: Partial<Rekord> & { workspaceId: string }): Rekord {
  return {
    id: `zd-${rnd()}`,
    module: "shopping",
    type: "shopping.list.completed",
    actorId: null,
    createdAt: new Date("2026-03-04T10:00:00Z"),
    payload: null,
    ...over,
  } as Rekord;
}

test(
  "Portfel księguje zakupy ze zdarzenia — raz, mimo dwóch dostarczeń",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");
    const [subskrybent] = (await import("../events")).default.subscribers;

    const user = await prisma.user.create({ data: { email: `pf-ev-${rnd()}@test.local`, name: "Kupujący" } });
    await ensurePersonalWorkspace(user.id);
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: user.id } });
    const el = await prisma.walletElement.create({ data: { name: "Konto", ownerId: user.id, balance: 1000 } });
    await prisma.financeSettings.create({
      data: { userId: user.id, autoExpenseElementId: el.id, autoExpenseEnabled: true },
    });

    const listId = `lista-${rnd()}`;
    const saldo = async () => (await prisma.walletElement.findUniqueOrThrow({ where: { id: el.id } })).balance;
    const wpisy = (src: string) => prisma.walletEntry.findMany({ where: { sourceModule: "shopping", sourceId: src } });

    try {
      const zd = rekordZdarzenia({
        workspaceId: ws.id,
        actorId: user.id,
        payload: { listId, nazwa: "Sobotnie", suma: 120, ksiegowac: true },
      });

      await t.test("pierwsze dostarczenie księguje wydatek", async () => {
        await subskrybent.handle(zd);
        const e = await wpisy(listId);
        assert.equal(e.length, 1, "powstał dokładnie jeden wpis");
        assert.equal(e[0].delta, -120);
        assert.equal(await saldo(), 880);
      });

      await t.test("DRUGIE dostarczenie tego samego zdarzenia nie zmienia niczego", async () => {
        await subskrybent.handle(zd);
        const e = await wpisy(listId);
        assert.equal(e.length, 1, "wciąż jeden wpis — nie dublet");
        assert.equal(e[0].delta, -120);
        assert.equal(await saldo(), 880, "saldo nie drgnęło po ponowieniu");
      });

      await t.test("bez życzenia użytkownika (`ksiegowac` fałsz) nie księguje nic", async () => {
        const inna = `lista-${rnd()}`;
        await subskrybent.handle(
          rekordZdarzenia({
            workspaceId: ws.id,
            actorId: user.id,
            payload: { listId: inna, nazwa: "Bez księgowania", suma: 50, ksiegowac: false },
          })
        );
        assert.equal((await wpisy(inna)).length, 0);
        assert.equal(await saldo(), 880);
      });

      await t.test("zakupy ZESPOŁOWE nie trafiają na prywatne konto sprawcy", async () => {
        // Reguła przeniesiona z `completeShopping` (dawne `list.ownerId === user.id`). Bez niej
        // wydatek z listy zespołowej obciążyłby prywatne konto tego, kto akurat kliknął.
        const team = await prisma.team.create({ data: { name: `Zespół ${rnd()}`, ownerId: user.id } });
        const wsZespolu = await prisma.workspace.create({
          data: { kind: "team", name: team.name, teamId: team.id },
        });
        const listaZespolu = `lista-${rnd()}`;
        try {
          await subskrybent.handle(
            rekordZdarzenia({
              workspaceId: wsZespolu.id,
              actorId: user.id,
              payload: { listId: listaZespolu, nazwa: "Firmowe", suma: 300, ksiegowac: true },
            })
          );
          assert.equal((await wpisy(listaZespolu)).length, 0, "brak wpisu z listy zespołowej");
          assert.equal(await saldo(), 880, "prywatne saldo nietknięte");
        } finally {
          await prisma.workspace.delete({ where: { id: wsZespolu.id } }).catch(() => {});
          await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
        }
      });
    } finally {
      await prisma.walletEntry.deleteMany({ where: { sourceModule: "shopping", sourceId: listId } });
      await prisma.financeSettings.deleteMany({ where: { userId: user.id } });
      await prisma.walletElement.deleteMany({ where: { ownerId: user.id } });
      await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  }
);
