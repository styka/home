import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 058 — RÓWNOŚĆ ZBIORÓW PRZED I PO PRZEŁĄCZENIU ZAKRESU NA PRZESTRZENIE.
 *
 * 057 dowiodło, że stary i nowy **zapis** warunku dają ten sam kształt. Ten przebieg zmienia
 * **znaczenie**, więc dowód musi być inny: porównujemy **zbiory identyfikatorów** zwrócone przez
 * bazę dla starego warunku (para kolumn) i nowego (przestrzenie), na tym samym fixture.
 *
 * Trzy sytuacje, które muszą wyjść identycznie — i jedna, która ma się różnić w sposób
 * przewidziany przez spec (§4): właściciel zespołu **bez wiersza `TeamMember`**.
 *
 * Lekcja z 056 obowiązuje tu wprost: fixture **musi** mieć przestrzenie, inaczej nowa gałąź nie
 * ma na czym zadziałać i test dowiódłby wyłącznie tego, że działa gałąź awaryjna.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "058: zakres po przestrzeniach zwraca ten sam zbiór, co zakres po parze kolumn",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ownedOr, ownedOrAsync, getUserTeamIds } = await import("../serverUtils");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );

    const ja = await prisma.user.create({ data: { email: `os-ja-${rnd()}@test.local` } });
    const kolega = await prisma.user.create({ data: { email: `os-kol-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `os-obc-${rnd()}@test.local` } });

    // Zespół, w którym JA mam wiersz członkostwa (żeby stary i nowy zakres były porównywalne).
    const zespol = await prisma.team.create({
      data: {
        name: `OS-${rnd()}`,
        ownerId: kolega.id,
        members: { create: [{ userId: ja.id, role: "MEMBER" }] },
      },
    });

    await ensurePersonalWorkspace(ja.id);
    await ensurePersonalWorkspace(kolega.id);
    await ensurePersonalWorkspace(obcy.id);
    await syncTeamWorkspace(zespol.id);

    // Zasoby: mój, zespołowy, cudzy — plus SIEROTA (bez przestrzeni), której właścicielem jestem ja.
    const moj = await prisma.habit.create({ data: { name: `h-moj-${rnd()}`, ownerId: ja.id } });
    const zespolowy = await prisma.habit.create({
      data: { name: `h-zesp-${rnd()}`, ownerTeamId: zespol.id },
    });
    const cudzy = await prisma.habit.create({ data: { name: `h-obc-${rnd()}`, ownerId: obcy.id } });
    const sierota = await prisma.habit.create({ data: { name: `h-sier-${rnd()}`, ownerId: ja.id } });
    await prisma.habit.update({ where: { id: sierota.id }, data: { workspaceId: null } });

    const wszystkie = [moj.id, zespolowy.id, cudzy.id, sierota.id];

    /** Zbiór identyfikatorów widocznych danym warunkiem — ograniczony do fixture. */
    async function widoczne(or: Record<string, unknown>[]): Promise<string[]> {
      const r = await prisma.habit.findMany({
        where: { AND: [{ id: { in: wszystkie } }, { OR: or }] },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      return r.map((x) => x.id);
    }

    try {
      await t.test("zbiory są identyczne (AC-1, AC-2, AC-4)", async () => {
        const teamIds = await getUserTeamIds(ja.id);
        const stary = await widoczne(ownedOr(ja.id, teamIds));
        const nowy = await widoczne(await ownedOrAsync(ja.id));
        assert.deepEqual(nowy, stary, "przełączenie zakresu nie może zmienić zbioru rekordów");
        assert.ok(stary.includes(moj.id), "mój zasób");
        assert.ok(stary.includes(zespolowy.id), "zasób zespołu, w którym mam członkostwo");
        assert.ok(!stary.includes(cudzy.id), "cudzy zasób nie może być widoczny");
      });

      await t.test("sierota pozostaje widoczna dla właściciela (AC-3)", async () => {
        const nowy = await widoczne(await ownedOrAsync(ja.id));
        assert.ok(
          nowy.includes(sierota.id),
          "rekord bez przestrzeni musi być widoczny dla właściciela, dopóki kolumna jest nullowalna",
        );
      });

      await t.test("obcy nie widzi niczego z tego fixture", async () => {
        const nowy = await widoczne(await ownedOrAsync(obcy.id));
        assert.deepEqual(nowy, [cudzy.id]);
      });

      await t.test("nowa gałąź NAPRAWDĘ działa — nie tylko awaryjna (kontrola z 056)", async () => {
        // Gdyby gałąź po przestrzeniach nie działała, zbiór trzymałby się wyłącznie na gałęziach
        // awaryjnych — a te wymagają `workspaceId: null`. Zasób z wypełnioną przestrzenią wypadłby.
        const zPrzestrzenia = await prisma.habit.findFirst({
          where: { id: moj.id },
          select: { workspaceId: true },
        });
        assert.notEqual(zPrzestrzenia?.workspaceId, null, "fixture musi mieć wypełnioną przestrzeń");
        const tylkoAwaryjne = await widoczne([
          { workspaceId: null, ownerId: ja.id },
          { workspaceId: null, ownerTeamId: { in: await getUserTeamIds(ja.id) } },
        ]);
        assert.ok(
          !tylkoAwaryjne.includes(moj.id),
          "gdyby zbiory zgadzały się bez gałęzi po przestrzeniach, test nie mierzyłby zmiany",
        );
      });
    } finally {
      await prisma.habit.deleteMany({ where: { id: { in: wszystkie } } });
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      for (const u of [ja, kolega, obcy]) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
  },
);
