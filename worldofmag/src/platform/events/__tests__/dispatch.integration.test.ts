import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 071 (zadanie 22) — DOSTARCZANIE ZDARZEŃ. Test na realnym Postgresie.
 *
 * **Najważniejszy jest test PODWÓJNEGO DOSTARCZENIA.** Rozdz. 9.4.4 wybiera gwarancję „co najmniej
 * raz" świadomie, więc ponowienie **nastąpi** — zawsze, gdy worker padnie po wykonaniu subskrybenta,
 * a przed oznaczeniem zdarzenia. Tego okna nie da się zamknąć; można je tylko uczynić nieszkodliwym.
 * Test, który dostarcza raz i sprawdza skutek, przepuściłby subskrybenta księgującego dwa razy.
 *
 * Sam **dowód idempotencji na prawdziwym subskrybencie** stoi w `src/modules/shopping/__tests__/`,
 * a nie tutaj — bo wymaga zaimportowania modułu, a platformie tego nie wolno (C-36). Tu zostaje
 * mechanizm: rozsyłka, izolacja błędu, brak odbiorcy, równoległość.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

async function zPrzestrzenia(fn: (userId: string, workspaceId: string) => Promise<void>) {
  const { prisma } = await import("@/platform/db/prisma");
  const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");
  const user = await prisma.user.create({
    data: { email: `dispatch-${rnd()}@test.local`, name: "Test rozsyłki" },
  });
  await ensurePersonalWorkspace(user.id);
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: user.id } });
  try {
    await fn(user.id, ws.id);
  } finally {
    await prisma.domainEvent.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}

async function zdarzenie(workspaceId: string, actorId: string | null = null) {
  const { prisma } = await import("@/platform/db/prisma");
  return prisma.domainEvent.create({
    data: {
      workspaceId,
      module: "shopping",
      type: "shopping.list.completed",
      actorId,
      payload: { nazwa: "Testowa", suma: 10 },
    },
  });
}

test(
  "dostarczenie: subskrybent wywołany, zdarzenie oznaczone jako dostarczone",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { setEventSubscriberResolver, obiegZdarzen } = await import("../dispatch");

    await zPrzestrzenia(async (userId, workspaceId) => {
      const z = await zdarzenie(workspaceId, userId);
      const wywolania: string[] = [];
      setEventSubscriberResolver(async () => [
        { id: "test", on: ["shopping.list.completed"], handle: async (e) => void wywolania.push(e.id) },
      ]);

      await obiegZdarzen();

      // Asercja zawężona do WŁASNEGO zdarzenia, a nie do całej listy wywołań. Obieg bierze
      // najstarsze niedostarczone z CAŁEJ bazy, więc równolegle działający plik testowy może mieć
      // swoje w tej samej partii. Globalne czyszczenie na wejściu (pierwsza wersja) rozwiązywało
      // to kosztem psucia sąsiada — czyli zamieniało jedną losową czerwień na drugą.
      assert.ok(wywolania.includes(z.id), "subskrybent dostał to zdarzenie");
      const po = await prisma.domainEvent.findUnique({ where: { id: z.id } });
      assert.ok(po?.deliveredAt, "oznaczone jako dostarczone");
    });
  }
);

test(
  "subskrybent rzuca: zdarzenie zostaje niedostarczone, pozostałe przechodzą",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { setEventSubscriberResolver, obiegZdarzen } = await import("../dispatch");

    await zPrzestrzenia(async (userId, workspaceId) => {
      const zly = await zdarzenie(workspaceId, userId);
      const dobry = await zdarzenie(workspaceId, userId);

      setEventSubscriberResolver(async () => [
        {
          id: "kapryśny",
          on: ["shopping.list.completed"],
          handle: async (e) => {
            if (e.id === zly.id) throw new Error("subskrybent padł");
          },
        },
      ]);

      const wynik = await obiegZdarzen();
      assert.equal(wynik.bledy, 1);

      const poZlym = await prisma.domainEvent.findUnique({ where: { id: zly.id } });
      const poDobrym = await prisma.domainEvent.findUnique({ where: { id: dobry.id } });
      assert.equal(poZlym?.deliveredAt, null, "wraca w kolejnym obiegu");
      assert.ok(poDobrym?.deliveredAt, "jeden zepsuty subskrybent nie zatrzymuje strumienia");
    });
  }
);

test(
  "zdarzenie BEZ subskrybentów jest dostarczone, a nie krąży w nieskończoność",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { setEventSubscriberResolver, obiegZdarzen } = await import("../dispatch");

    await zPrzestrzenia(async (userId, workspaceId) => {
      const z = await zdarzenie(workspaceId, userId);
      setEventSubscriberResolver(async () => []);

      await obiegZdarzen();

      const po = await prisma.domainEvent.findUnique({ where: { id: z.id } });
      assert.ok(po?.deliveredAt, "dostarczone mimo braku odbiorcy — inaczej zatkałoby obieg");
    });
  }
);

test(
  "DWA OBIEGI RÓWNOLEGLE nie biorą tego samego zdarzenia",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { setEventSubscriberResolver, obiegZdarzen } = await import("../dispatch");

    await zPrzestrzenia(async (userId, workspaceId) => {
      const ile = 6;
      const nasze = new Set<string>();
      for (let i = 0; i < ile; i++) nasze.add((await zdarzenie(workspaceId, userId)).id);

      // Liczymy WYWOŁANIA subskrybenta, nie zdarzenia w bazie: gdyby `SKIP LOCKED` nie działało,
      // oba obiegi wzięłyby tę samą partię i licznik wyszedłby większy niż liczba zdarzeń.
      const wywolania: string[] = [];
      setEventSubscriberResolver(async () => [
        {
          id: "liczacy",
          on: ["shopping.list.completed"],
          handle: async (e) => {
            wywolania.push(e.id);
            await new Promise((r) => setTimeout(r, 20));
          },
        },
      ]);

      await Promise.all([obiegZdarzen(), obiegZdarzen()]);

      // Liczymy tylko wywołania dla WŁASNYCH zdarzeń — obce z równoległego pliku nas nie dotyczą.
      const moje = wywolania.filter((id) => nasze.has(id));
      assert.equal(moje.length, ile, `oczekiwano ${ile} wywołań, było ${moje.length}`);
      assert.equal(new Set(moje).size, ile, "żadne zdarzenie nie zostało przetworzone dwa razy");
    });
  }
);
