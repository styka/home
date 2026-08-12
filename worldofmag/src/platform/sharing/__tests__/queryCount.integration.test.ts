import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 052 — KOSZT SPRAWDZENIA DOSTĘPU W ZAPYTANIACH (rozdz. 8.9, wymagania 1, 2 i 4).
 *
 * `requireAccess` siedzi na ścieżce **każdego** żądania, więc „ile to kosztuje" nie jest pytaniem
 * akademickim. Mierzymy licznikiem zdarzeń Prismy, a nie na oko.
 *
 * **Czego ten test NIE udaje.** Rozdz. 8.9 pkt 4 mówi „zero zapytań dla właściciela" i opiera to na
 * porównaniu `workspaceId` zasobu z przestrzeniami z sesji. Zasoby tej kolumny jeszcze nie mają —
 * to zadanie 11. Dziś więc mierzymy to, co da się dziś zmierzyć uczciwie: że **nowy mechanizm nie
 * jest droższy od guardu, który zastępuje**, i że nadania czyta jednym zapytaniem niezależnie od
 * długości łańcucha.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "koszt sprawdzenia dostępu: nowy mechanizm nie jest droższy, nadania idą jednym zapytaniem",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { resolveRole } = await import("@/platform/sharing/access");
    const resources = (await import("@/modules/tasks/sharing")).default;

    const wlasciciel = await prisma.user.create({ data: { email: `qc-${rnd()}@test.local` } });
    const projekt = await prisma.taskProject.create({
      data: { name: `QC-${rnd()}`, ownerId: wlasciciel.id },
    });
    const zadanie = await prisma.task.create({
      data: { title: `QC-${rnd()}`, projectId: projekt.id, createdById: wlasciciel.id },
    });

    // Mierzymy SZPIEGAMI na metodach klienta, którego mierzony kod faktycznie używa. Osobny
    // `PrismaClient` z nasłuchem `$on("query")` byłby wygodniejszy, ale liczyłby zapytania, których
    // `requireAccess` nie wykonuje — czyli dawałby pomiar czegoś innego niż mierzona ścieżka.
    const ctx = { teamIds: [], adminTeamIds: [], workspaceIds: [] };

    try {

      await t.test("właściciel rozstrzyga się BEZ pytania o nadania (rozdz. 8.9 pkt 4)", async () => {
        const doGrantow: string[] = [];
        const oryginalne = prisma.resourceGrant.findMany;
        (prisma.resourceGrant as unknown as { findMany: unknown }).findMany = ((...args: unknown[]) => {
          doGrantow.push("grant");
          return (oryginalne as (...a: unknown[]) => unknown).apply(prisma.resourceGrant, args);
        }) as typeof prisma.resourceGrant.findMany;

        try {
          const rola = await resolveRole(wlasciciel.id, { type: "tasks.task", id: zadanie.id }, resources, ctx);
          assert.equal(rola, "manager", "właściciel projektu musi wyjść jako manager przez dziedziczenie");
          // Właściciel rozstrzyga się na kroku 1 — do nadań w ogóle nie schodzimy.
          assert.equal(doGrantow.length, 0, "dla właściciela nie wolno pytać o nadania");
        } finally {
          (prisma.resourceGrant as unknown as { findMany: unknown }).findMany = oryginalne;
        }
      });

      await t.test("obcy: nadania czytane DOKŁADNIE raz, mimo dwóch ogniw łańcucha", async () => {
        const obcy = await prisma.user.create({ data: { email: `qc-o-${rnd()}@test.local` } });
        const doGrantow: string[] = [];
        const oryginalne = prisma.resourceGrant.findMany;
        (prisma.resourceGrant as unknown as { findMany: unknown }).findMany = ((...args: unknown[]) => {
          doGrantow.push("grant");
          return (oryginalne as (...a: unknown[]) => unknown).apply(prisma.resourceGrant, args);
        }) as typeof prisma.resourceGrant.findMany;
        try {
          const rola = await resolveRole(obcy.id, { type: "tasks.task", id: zadanie.id }, resources, ctx);
          assert.equal(rola, null);
          assert.equal(
            doGrantow.length,
            1,
            "łańcuch ma dwa ogniwa, a nadania mają być czytane JEDNYM zapytaniem (rozdz. 8.9 pkt 1)",
          );
        } finally {
          (prisma.resourceGrant as unknown as { findMany: unknown }).findMany = oryginalne;
          await prisma.user.deleteMany({ where: { id: obcy.id } });
        }
      });

      await t.test("koszt dla właściciela nie rośnie wobec dzisiejszego guardu", async () => {
        // Stary guard: 1 zapytanie (`taskProject.findUnique` z members).
        // Nowy: `task.findUnique` + `taskProject.findUnique` — czyli 2 na łańcuch zadanie→projekt,
        // ale stary `assertTaskAccess` też robił 2 (najpierw zadanie u wołającego, potem projekt).
        // Mierzymy to, co porównywalne: sprawdzenie dostępu do PROJEKTU.
        const doProjektu: string[] = [];
        const oryginalne = prisma.taskProject.findUnique;
        (prisma.taskProject as unknown as { findUnique: unknown }).findUnique = ((...args: unknown[]) => {
          doProjektu.push("project");
          return (oryginalne as (...a: unknown[]) => unknown).apply(prisma.taskProject, args);
        }) as typeof prisma.taskProject.findUnique;
        try {
          await resolveRole(wlasciciel.id, { type: "tasks.project", id: projekt.id }, resources, ctx);
          assert.equal(doProjektu.length, 1, "sprawdzenie dostępu do projektu = jedno zapytanie, jak dawniej");
        } finally {
          (prisma.taskProject as unknown as { findUnique: unknown }).findUnique = oryginalne;
        }
      });

    } finally {
      await prisma.task.deleteMany({ where: { id: zadanie.id } });
      await prisma.taskProject.deleteMany({ where: { id: projekt.id } });
      await prisma.user.deleteMany({ where: { id: wlasciciel.id } });
    }
  },
);
