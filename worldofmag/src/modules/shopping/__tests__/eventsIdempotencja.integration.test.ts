import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 071 (zadanie 22) — IDEMPOTENCJA SUBSKRYBENTA ZAKUPÓW, na realnym Postgresie.
 *
 * **Ten test mieszka w module, nie w platformie**, i to nie jest szczegół porządkowy: dowód wymaga
 * zaimportowania prawdziwego subskrybenta, a `src/platform/**` nie może importować `@/modules/*`
 * (C-36). Ta sama pomyłka wyszła w 069, gdy test QA sięgnął po slug Kuchni.
 *
 * **Dlaczego ten test w ogóle istnieje.** Rozdz. 9.4.4 daje gwarancję „co najmniej raz", więc
 * drugie dostarczenie tego samego zdarzenia **nastąpi** — zawsze, gdy worker padnie po wykonaniu
 * subskrybenta, a przed oznaczeniem zdarzenia. Bramka `check:subscribers` sprawdza tylko, czy
 * wzorzec idempotencji **jest w kodzie**; że działa — dowodzi wyłącznie ten test, bo mierzy SKUTEK.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

async function zPrzestrzenia(fn: (userId: string, workspaceId: string) => Promise<void>) {
  const { prisma } = await import("@/platform/db/prisma");
  const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");
  const user = await prisma.user.create({
    data: { email: `shop-events-${rnd()}@test.local`, name: "Test idempotencji" },
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
  "PODWÓJNE DOSTARCZENIE daje ten sam stan co pojedyncze — sedno gwarancji „co najmniej raz”",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const wklad = (await import("../events")).default;

    await zPrzestrzenia(async (userId: string, workspaceId: string) => {
      // Drugi członek przestrzeni — to jego powiadamia subskrybent.
      const drugi = await prisma.user.create({
        data: { email: `drugi-${rnd()}@test.local`, name: "Druga osoba" },
      });
      await prisma.workspaceMember.create({
        data: { workspaceId, userId: drugi.id, role: "member" },
      });
      try {
        const [subskrybent] = wklad.subscribers;
        const z = await zdarzenie(workspaceId, userId);
        const rekord = {
          id: z.id,
          workspaceId: z.workspaceId,
          module: "shopping" as const,
          type: "shopping.list.completed" as const,
          payload: z.payload,
          actorId: z.actorId,
          createdAt: z.createdAt,
        };

        // Wołamy subskrybenta WPROST, dwa razy — bo dokładnie to robi worker przy ponowieniu
        // (awaria po wykonaniu reakcji, przed oznaczeniem zdarzenia). Nie przez `obiegZdarzen`,
        // bo rezolwer subskrybentów jest stanem globalnym procesu: dwa pliki testowe biegnące
        // równolegle nadpisywałyby go sobie nawzajem i zestaw byłby losowo czerwony.
        await subskrybent.handle(rekord);
        const poPierwszym = await prisma.notification.findMany({ where: { userId: drugi.id } });
        assert.equal(poPierwszym.length, 1, "pierwsze dostarczenie tworzy jedno powiadomienie");

        await subskrybent.handle(rekord);

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
