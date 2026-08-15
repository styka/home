import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 071 (zadanie 22) — DOSTARCZANIE ZDARZEŃ. Test na realnym Postgresie.
 *
 * **Najważniejszy jest test PODWÓJNEGO DOSTARCZENIA.** Rozdz. 9.4.4 wybiera gwarancję „co najmniej
 * raz" świadomie, więc ponowienie **nastąpi** — zawsze, gdy worker padnie po wykonaniu subskrybenta,
 * a przed oznaczeniem zdarzenia. Tego okna nie da się zamknąć; można je tylko uczynić nieszkodliwym.
 * Test, który dostarcza raz i sprawdza skutek, przepuściłby subskrybenta księgującego dwa razy.
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
  // Obieg bierze NAJSTARSZE niedostarczone zdarzenia z całej bazy, więc pozostałości po innych
  // (albo przerwanych) testach trafiłyby do partii i psuły asercje o liczbie wywołań. Test bazy
  // jest jednorazowy, więc czyścimy je na wejściu — inaczej ten zestaw jest losowo czerwony.
  await prisma.domainEvent.deleteMany({ where: { deliveredAt: null } });
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

      assert.deepEqual(wywolania, [z.id], "subskrybent dostał dokładnie to zdarzenie");
      const po = await prisma.domainEvent.findUnique({ where: { id: z.id } });
      assert.ok(po?.deliveredAt, "oznaczone jako dostarczone");
    });
  }
);

test(
  "PODWÓJNE DOSTARCZENIE daje ten sam stan co pojedyncze — sedno gwarancji „co najmniej raz”",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { setEventSubscriberResolver, obiegZdarzen } = await import("../dispatch");
    const wklad = (await import("@/modules/shopping/events")).default;

    await zPrzestrzenia(async (userId, workspaceId) => {
      // Drugi członek przestrzeni — to jego powiadamia subskrybent.
      const drugi = await prisma.user.create({
        data: { email: `drugi-${rnd()}@test.local`, name: "Druga osoba" },
      });
      await prisma.workspaceMember.create({
        data: { workspaceId, userId: drugi.id, role: "member" },
      });
      try {
        setEventSubscriberResolver(async () => wklad.subscribers);

        const z = await zdarzenie(workspaceId, userId);
        await obiegZdarzen();
        const poPierwszym = await prisma.notification.findMany({ where: { userId: drugi.id } });
        assert.equal(poPierwszym.length, 1, "pierwsze dostarczenie tworzy jedno powiadomienie");

        // Symulacja ponowienia: worker padł po subskrybencie, przed oznaczeniem. Odkręcamy
        // `deliveredAt` i puszczamy obieg jeszcze raz — dokładnie to zrobiłby prawdziwy worker.
        await prisma.domainEvent.update({ where: { id: z.id }, data: { deliveredAt: null } });
        await obiegZdarzen();

        const poDrugim = await prisma.notification.findMany({ where: { userId: drugi.id } });
        assert.equal(poDrugim.length, 1, "DRUGIE dostarczenie nie tworzy drugiego powiadomienia");
        assert.equal(poDrugim[0].id, poPierwszym[0].id, "to ten sam wiersz, nie nowy");

        // SPRAWCA NIE DOSTAJE POWIADOMIENIA O WŁASNYM KLIKNIĘCIU. Bez tej asercji test przechodził
        // także po usunięciu warunku `NOT: { userId: actorId }` — wykrył to przebieg mutacyjny.
        const uSprawcy = await prisma.notification.findMany({ where: { userId } });
        assert.equal(uSprawcy.length, 0, "sprawca nie jest powiadamiany o tym, co sam zrobił");
      } finally {
        await prisma.notification.deleteMany({ where: { userId: drugi.id } });
        await prisma.workspaceMember.deleteMany({ where: { userId: drugi.id } });
        await prisma.user.delete({ where: { id: drugi.id } }).catch(() => {});
      }
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
      for (let i = 0; i < ile; i++) await zdarzenie(workspaceId, userId);

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

      assert.equal(wywolania.length, ile, `oczekiwano ${ile} wywołań, było ${wywolania.length}`);
      assert.equal(new Set(wywolania).size, ile, "żadne zdarzenie nie zostało przetworzone dwa razy");
    });
  }
);
