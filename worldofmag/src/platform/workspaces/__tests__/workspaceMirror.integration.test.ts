import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Faza 2 / zadanie 9 — TEST LUSTRA PRZESTRZENI.
 *
 * Przez okres przejściowy ta sama informacja („kto należy do zespołu") mieszka w dwóch miejscach:
 * w `Team`/`TeamMember` i w przestrzeni. Rozjazd między nimi nie objawia się niczym — nic jeszcze
 * przestrzeni nie czyta — i wyszedłby dopiero przy zadaniu 11, czyli najpóźniej jak się da.
 * Ten test jest jedyną rzeczą, która go zauważy wcześniej.
 *
 * **Test operuje na WŁASNYM fixture, nie na całej bazie.** Inne testy integracyjne tworzą
 * użytkowników wprost przez Prismę, z pominięciem zdarzenia `createUser`, więc globalna asercja
 * „każdy użytkownik w bazie ma przestrzeń" byłaby czerwona z cudzych powodów. Globalny niezmiennik
 * zapewnia migracja 0226 (konta istniejące) i wpięcia w akcje (konta nowe).
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "lustro przestrzeni: zespół i konto mają swoje odbicie, a rozjazd jest wykrywany",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace, syncTeamWorkspace, reconcileWorkspaces } = await import(
      "@/platform/workspaces/sync"
    );

    const wlasciciel = await prisma.user.create({ data: { email: `ws-o-${rnd()}@test.local` } });
    const czlonek = await prisma.user.create({ data: { email: `ws-m-${rnd()}@test.local` } });
    // PRZYPADEK BRZEGOWY: właściciel NIE dostaje wiersza `TeamMember`. Nic tego nie wymusza,
    // a odwzorowanie „po członkach" wygląda przy tym na kompletne i po cichu go gubi.
    const zespol = await prisma.team.create({
      data: {
        name: `Zespół-${rnd()}`,
        ownerId: wlasciciel.id,
        members: { create: [{ userId: czlonek.id, role: "MEMBER" }] },
      },
    });

    const sklad = async (workspaceId: string) => {
      const m = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true, role: true },
        orderBy: { userId: "asc" },
      });
      return new Map(m.map((x) => [x.userId, x.role]));
    };
    const przestrzenZespolu = async () =>
      prisma.workspace.findUnique({
        where: { teamId: zespol.id },
        select: { id: true, name: true, kind: true },
      });

    try {
      await t.test(
        "zespół dostaje przestrzeń, a jego właściciel jest w niej mimo braku wiersza członkostwa",
        async () => {
          const wynik = await syncTeamWorkspace(zespol.id);
          assert.ok(wynik.utworzone > 0, "pierwsze uzgodnienie musi coś utworzyć");

          const w = await przestrzenZespolu();
          assert.ok(w, "przestrzeń zespołu nie powstała");
          assert.equal(w!.kind, "team");
          assert.equal(w!.name, zespol.name);

          const s = await sklad(w!.id);
          assert.equal(s.get(wlasciciel.id), "owner", "właściciel zespołu MUSI być w przestrzeni");
          assert.equal(s.get(czlonek.id), "member");
          assert.equal(s.size, 2);
        },
      );

      await t.test("uzgodnienie jest idempotentne — druga próba nie zmienia niczego", async () => {
        assert.deepEqual(await syncTeamWorkspace(zespol.id), {
          utworzone: 0,
          zaktualizowane: 0,
          usuniete: 0,
        });
      });

      await t.test("konto dostaje przestrzeń osobistą, dokładnie jedną", async () => {
        const pierwsze = await ensurePersonalWorkspace(czlonek.id);
        assert.equal(pierwsze.utworzone, 1);
        assert.deepEqual(await ensurePersonalWorkspace(czlonek.id), {
          utworzone: 0,
          zaktualizowane: 0,
          usuniete: 0,
        });

        assert.equal(await prisma.workspace.count({ where: { personalUserId: czlonek.id } }), 1);
        const w = await prisma.workspace.findUnique({ where: { personalUserId: czlonek.id } });
        assert.equal(w!.kind, "personal");
        assert.equal((await sklad(w!.id)).get(czlonek.id), "owner");
      });

      await t.test("zmiana nazwy zespołu przechodzi do przestrzeni", async () => {
        const nowa = `Zespół-zmieniony-${rnd()}`;
        await prisma.team.update({ where: { id: zespol.id }, data: { name: nowa } });
        assert.equal((await syncTeamWorkspace(zespol.id)).zaktualizowane, 1);
        assert.equal((await przestrzenZespolu())!.name, nowa);
      });

      await t.test("awans członka na admina przechodzi do przestrzeni", async () => {
        await prisma.teamMember.update({
          where: { teamId_userId: { teamId: zespol.id, userId: czlonek.id } },
          data: { role: "ADMIN" },
        });
        await syncTeamWorkspace(zespol.id);
        assert.equal((await sklad((await przestrzenZespolu())!.id)).get(czlonek.id), "admin");
      });

      await t.test("usunięcie członka z zespołu usuwa go z przestrzeni", async () => {
        await prisma.teamMember.delete({
          where: { teamId_userId: { teamId: zespol.id, userId: czlonek.id } },
        });
        assert.equal((await syncTeamWorkspace(zespol.id)).usuniete, 1);
        const s = await sklad((await przestrzenZespolu())!.id);
        assert.equal(s.has(czlonek.id), false);
        assert.equal(s.get(wlasciciel.id), "owner");
      });

      // ── TEST NEGATYWNY ──────────────────────────────────────────────────────────────
      // Bez tego cała reszta dowodzi tylko, że uzgadnianie coś robi — nie że rozjazd
      // BYŁBY zauważony. Podkładamy rozjazd wprost i wymagamy, żeby wyszedł.
      await t.test("podłożony rozjazd jest wykrywany (test negatywny)", async () => {
        const w = await przestrzenZespolu();
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: w!.id } });
        const wykryte = await reconcileWorkspaces({ userIds: [], teamIds: [zespol.id] });
        assert.ok(
          wykryte.utworzone + wykryte.zaktualizowane + wykryte.usuniete > 0,
          "uzgodnienie po podłożonym rozjeździe MUSI zgłosić zmianę — inaczej rozjazd przeszedłby niezauważony",
        );
        // …i po naprawie znowu jest cicho.
        assert.deepEqual(await reconcileWorkspaces({ userIds: [], teamIds: [zespol.id] }), {
          utworzone: 0,
          zaktualizowane: 0,
          usuniete: 0,
        });
      });

      await t.test("usunięcie zespołu kasuje jego przestrzeń kaskadą, bez udziału kodu", async () => {
        await prisma.team.delete({ where: { id: zespol.id } });
        assert.equal(await przestrzenZespolu(), null);
        // Uzgodnienie nieistniejącego zespołu jest bezpieczne — nie rzuca i nic nie tworzy.
        assert.deepEqual(await syncTeamWorkspace(zespol.id), {
          utworzone: 0,
          zaktualizowane: 0,
          usuniete: 0,
        });
      });
    } finally {
      await prisma.team.deleteMany({ where: { id: zespol.id } });
      await prisma.user.deleteMany({ where: { id: { in: [wlasciciel.id, czlonek.id] } } });
    }
  },
);
