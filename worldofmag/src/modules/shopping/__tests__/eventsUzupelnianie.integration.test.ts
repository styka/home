import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 080 (zadanie 25, rozdz. 9.5) — MAGAZYN → ZAKUPY NA REALNYM POSTGRESIE.
 *
 * Bramka `check:subscribers` sprawdza wyłącznie OBECNOŚĆ zadeklarowanego wzorca idempotencji.
 * Że wzorzec działa, dowodzi ten test — mierząc SKUTEK, czyli liczbę pozycji na liście.
 *
 * Pięć rzeczy do udowodnienia, bo pięć może pójść źle:
 *  1. brak poniżej minimum trafia na oznaczoną listę (inaczej automat po prostu nie działa,
 *     a użytkownik dowie się o tym dopiero w sklepie);
 *  2. **drugie dostarczenie nie dubluje** — gwarancja „co najmniej raz" z rozdz. 9.4.4;
 *  3. **drugi spadek tej samej pozycji też nie dubluje** — o to wprost poprosił właściciel przy
 *     decyzji o automacie, i to jest szersze niż punkt 2 (inne `event.id`, ta sama pozycja);
 *  4. stan POWYŻEJ minimum nie dopisuje niczego — inaczej lista zapełniłaby się przy każdym
 *     przyjęciu towaru;
 *  5. **bez oznaczonej listy nie dzieje się nic** — to decyzja właściciela, nie awaria; automat
 *     bez wskazanego celu musiałby zgadywać, na którą listę dopisać.
 *
 * Rozstrzygający jest punkt 5 w wariancie negatywnym: reakcja szuka listy w PRZESTRZENI ZDARZENIA,
 * więc oznaczenie listy w cudzej przestrzeni nie może jej wciągnąć.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

type Rekord = Parameters<
  Awaited<typeof import("../events")>["default"]["subscribers"][number]["handle"]
>[0];

function zdarzenieStanu(
  workspaceId: string,
  payload: Record<string, unknown>,
  actorId: string | null = null,
): Rekord {
  return {
    id: `zd-${rnd()}`,
    module: "magazynowanie",
    type: "magazynowanie.stan.zmieniony",
    actorId,
    createdAt: new Date("2026-04-01T09:00:00Z"),
    payload,
    workspaceId,
  } as Rekord;
}

test(
  "brak w Magazynie dopisuje się do oznaczonej listy — raz, mimo dwóch dostarczeń i dwóch spadków",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");
    const subskrybenci = (await import("../events")).default.subscribers;
    const uzupelnij = subskrybenci.find((s) => s.id === "shopping.uzupelnij-braki");
    assert.ok(uzupelnij, "subskrybent musi być wpięty we wkład modułu");

    const user = await prisma.user.create({ data: { email: `mz-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `mz-o-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(user.id);
    await ensurePersonalWorkspace(obcy.id);
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: user.id } });
    const wsObcego = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: obcy.id } });

    const lista = await prisma.shoppingList.create({
      data: { name: `Auto-${rnd()}`, ...(await wlasnoscDoZapisu(user.id)), autoReplenish: true },
    });
    const listaZwykla = await prisma.shoppingList.create({
      data: { name: `Zwykła-${rnd()}`, ...(await wlasnoscDoZapisu(user.id)) },
    });
    // Oznaczona lista w CUDZEJ przestrzeni — nie może przyciągnąć naszego zdarzenia.
    const listaObcego = await prisma.shoppingList.create({
      data: { name: `Obca-${rnd()}`, ...(await wlasnoscDoZapisu(obcy.id)), autoReplenish: true },
    });

    const pozycje = (listId: string) =>
      prisma.item.findMany({ where: { listId }, select: { id: true, name: true, quantity: true, unit: true } });

    const brakMleka = { itemId: `it-${rnd()}`, stanPo: 1, minimum: 4, nazwa: "Mleko", jednostka: "l", kategoria: "Nabiał" };

    try {
      await t.test("brak poniżej minimum ląduje na oznaczonej liście, z brakującą ilością", async () => {
        await uzupelnij!.handle(zdarzenieStanu(ws.id, brakMleka, user.id));
        const p = await pozycje(lista.id);
        assert.equal(p.length, 1);
        assert.equal(p[0].name, "Mleko");
        assert.equal(p[0].quantity, 4, "brakuje 3, ale minimum to 4 — ta sama arytmetyka co w przycisku ręcznym");
        assert.equal(p[0].unit, "l");
        assert.deepEqual(await pozycje(listaZwykla.id), [], "lista nieoznaczona zostaje pusta");
      });

      await t.test("drugie DOSTARCZENIE tego samego zdarzenia nie dubluje", async () => {
        const zd = zdarzenieStanu(ws.id, brakMleka, user.id);
        await uzupelnij!.handle(zd);
        await uzupelnij!.handle(zd);
        assert.equal((await pozycje(lista.id)).length, 1, "dostarczenie „co najmniej raz” nie może znaczyć „dwa razy na liście”");
      });

      await t.test("drugi SPADEK tej samej pozycji też nie dubluje (inne event.id)", async () => {
        // Tu klucz z `event.id` by NIE wystarczył — dlatego idempotencja jest „naturalna".
        await uzupelnij!.handle(zdarzenieStanu(ws.id, { ...brakMleka, stanPo: 0 }, user.id));
        assert.equal((await pozycje(lista.id)).length, 1);
      });

      await t.test("nazwa pisana inaczej to nadal ta sama pozycja", async () => {
        await uzupelnij!.handle(zdarzenieStanu(ws.id, { ...brakMleka, nazwa: "mleko" }, user.id));
        assert.equal((await pozycje(lista.id)).length, 1, "„Mleko” i „mleko” to dla użytkownika jedno");
      });

      await t.test("stan POWYŻEJ minimum nie dopisuje niczego", async () => {
        await uzupelnij!.handle(
          zdarzenieStanu(ws.id, { itemId: `it-${rnd()}`, stanPo: 9, minimum: 4, nazwa: "Ryż" }, user.id),
        );
        assert.equal((await pozycje(lista.id)).length, 1, "przyjęcie towaru nie jest brakiem");
      });

      await t.test("pozycja BEZ minimum nie dopisuje niczego", async () => {
        await uzupelnij!.handle(
          zdarzenieStanu(ws.id, { itemId: `it-${rnd()}`, stanPo: 0, minimum: null, nazwa: "Śrubki" }, user.id),
        );
        assert.equal((await pozycje(lista.id)).length, 1, "bez ustawionego minimum nie ma czego pilnować");
      });

      await t.test("bez oznaczonej listy w TEJ przestrzeni nie dzieje się nic", async () => {
        await prisma.shoppingList.update({ where: { id: lista.id }, data: { autoReplenish: false } });
        await uzupelnij!.handle(
          zdarzenieStanu(ws.id, { itemId: `it-${rnd()}`, stanPo: 0, minimum: 2, nazwa: "Chleb" }, user.id),
        );
        assert.equal((await pozycje(lista.id)).length, 1, "zdjęcie flagi wyłącza automat");
        assert.deepEqual(await pozycje(listaObcego.id), [], "oznaczona lista CUDZEJ przestrzeni nie łapie naszego zdarzenia");
      });

      await t.test("pozycja już KUPIONA nie blokuje kolejnego braku", async () => {
        // Klucz naturalny obejmuje status: gdy mleko zostało kupione, następny spadek ma je
        // dopisać ponownie. Bez warunku po statusie automat zamilkłby na zawsze po pierwszym razie.
        await prisma.shoppingList.update({ where: { id: lista.id }, data: { autoReplenish: true } });
        await prisma.item.updateMany({ where: { listId: lista.id }, data: { status: "DONE" } });
        await uzupelnij!.handle(zdarzenieStanu(ws.id, brakMleka, user.id));
        const p = await pozycje(lista.id);
        assert.equal(p.length, 2, "kupione mleko nie może zablokować kolejnego uzupełnienia");
      });
    } finally {
      await prisma.shoppingList.deleteMany({
        where: { id: { in: [lista.id, listaZwykla.id, listaObcego.id] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: [user.id, obcy.id] } } });
    }
  },
);
