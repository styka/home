import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 076 (zadanie 11, etap 4 część 2) — USTALANIE PRZESTRZENI ZAPISU.
 *
 * Ten helper zastąpi `data: { ownerId: user.id }` w ~250 miejscach, więc jego pomyłka nie objawi
 * się jednym zepsutym ekranem, tylko rekordami zapisanymi w CUDZEJ przestrzeni — czyli wyciekiem,
 * którego nikt nie zauważy, dopóki ktoś nie zobaczy nie swoich danych.
 *
 * Trzy rzeczy do udowodnienia:
 *  1. zwraca przestrzeń TEGO użytkownika, nie pierwszą z brzegu;
 *  2. konto bez przestrzeni dostaje ją utworzoną (rozjazd lustra domykamy, nie zgłaszamy) —
 *     razem z wierszem członkostwa, bo sama przestrzeń bez roli to pułapka z 056;
 *  3. zapis zespołowy trafia do przestrzeni ZESPOŁU, a nie do przestrzeni osoby, która zapisuje.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("przestrzeń zapisu: własna, domykana i zespołowa", { skip: !HAS_DB && "brak DATABASE_URL" }, async (t) => {
  const { prisma } = await import("@/platform/db/prisma");
  const { przestrzenOsobista, przestrzenZespolu, przestrzenDoZapisu } = await import("../zapis");
  const { ensurePersonalWorkspace } = await import("../sync");

  const ja = await prisma.user.create({ data: { email: `zapis-ja-${rnd()}@test.local` } });
  const obcy = await prisma.user.create({ data: { email: `zapis-obcy-${rnd()}@test.local` } });
  await ensurePersonalWorkspace(ja.id);
  await ensurePersonalWorkspace(obcy.id);

  const bezPrzestrzeni = await prisma.user.create({ data: { email: `zapis-bez-${rnd()}@test.local` } });
  const zespol = await prisma.team.create({ data: { name: `Zespół ${rnd()}`, ownerId: ja.id } });

  try {
    await t.test("zwraca przestrzeń TEGO użytkownika", async () => {
      const moja = await przestrzenOsobista(ja.id);
      const cudza = await przestrzenOsobista(obcy.id);
      assert.notEqual(moja, cudza, "dwie osoby nie mogą dostać tej samej przestrzeni");

      const w = await prisma.workspace.findUniqueOrThrow({ where: { id: moja } });
      assert.equal(w.personalUserId, ja.id, "to musi być przestrzeń pytającego, nie dowolna");
      assert.equal(w.kind, "personal");
    });

    await t.test("konto bez przestrzeni dostaje ją utworzoną razem z rolą", async () => {
      const brak = await prisma.workspace.findUnique({ where: { personalUserId: bezPrzestrzeni.id } });
      assert.equal(brak, null, "fixture musi startować BEZ przestrzeni, inaczej test niczego nie mierzy");

      const id = await przestrzenOsobista(bezPrzestrzeni.id);
      const w = await prisma.workspace.findUniqueOrThrow({ where: { id } });
      assert.equal(w.personalUserId, bezPrzestrzeni.id);

      // Bez wiersza członkostwa przestrzeń istnieje, ale nie daje właścicielowi żadnej roli —
      // konto byłoby odcięte od własnych danych, tylko subtelniej (pułapka z 056).
      const czlonkostwo = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: id, userId: bezPrzestrzeni.id } },
      });
      assert.equal(czlonkostwo?.role, "owner");
    });

    await t.test("zapis zespołowy idzie do przestrzeni ZESPOŁU, nie zapisującego", async () => {
      const zespolowa = await przestrzenZespolu(zespol.id);
      const moja = await przestrzenOsobista(ja.id);
      assert.notEqual(zespolowa, moja, "rekord zespołu nie może wylądować w prywatnej przestrzeni");

      const w = await prisma.workspace.findUniqueOrThrow({ where: { id: zespolowa } });
      assert.equal(w.teamId, zespol.id);
      assert.equal(w.kind, "team");

      // `przestrzenDoZapisu` to jedyna rozgałęziona wersja — sprawdzamy OBA ramiona, bo pomyłka
      // w warunku dałaby rekordy zespołowe w prywatnej przestrzeni i odwrotnie.
      assert.equal(await przestrzenDoZapisu(ja.id, zespol.id), zespolowa);
      assert.equal(await przestrzenDoZapisu(ja.id, null), moja);
      assert.equal(await przestrzenDoZapisu(ja.id), moja);
    });
  } finally {
    await prisma.workspace.deleteMany({
      where: { OR: [{ personalUserId: { in: [ja.id, obcy.id, bezPrzestrzeni.id] } }, { teamId: zespol.id }] },
    });
    await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
    for (const u of [ja, obcy, bezPrzestrzeni]) {
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
  }
});
