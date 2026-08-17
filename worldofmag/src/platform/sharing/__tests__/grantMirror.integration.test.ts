import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 059 — TEST LUSTRA NADAŃ.
 *
 * Przez okres przejściowy „kto ma dostęp" mieszka w dwóch miejscach: w dawnych tabelach
 * (źródło prawdy) i w `ResourceGrant` (lustro). Rozjazd **nie objawia się niczym**, bo nadań nikt
 * jeszcze nie czyta — wyszedłby dopiero w etapie 2. Ten test jest jedyną rzeczą, która zauważy go
 * wcześniej. Ten sam układ i to samo uzasadnienie, co test lustra przestrzeni z 051.
 *
 * Sprawdzamy **obie strony**: że nadanie powstaje, że zmienia rolę razem ze źródłem i — co
 * najważniejsze — że **znika**. Nadanie, które przeżyło swoje źródło, jest cichym przyznaniem
 * dostępu i wyszłoby dopiero wtedy, gdy ktoś zauważy, że były współpracownik nadal widzi projekt.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "lustro nadań: członkostwo i udostępnienie mają odbicie, a usunięcie je zabiera",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );
    const {
      mirrorProjectMember,
      unmirrorProjectMember,
      mirrorTaskShare,
      unmirrorTaskShare,
      mirrorPetShare,
      unmirrorPetShare,
    } = await import("../grantMirror");

    const wlasciciel = await prisma.user.create({ data: { email: `gm-o-${rnd()}@test.local` } });
    const czlonek = await prisma.user.create({ data: { email: `gm-m-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(wlasciciel.id);
    await ensurePersonalWorkspace(czlonek.id);

    const zespol = await prisma.team.create({
      data: { name: `GM-${rnd()}`, ownerId: wlasciciel.id },
    });
    await syncTeamWorkspace(zespol.id);
    const przestrzenZespolu = await prisma.workspace.findUnique({
      where: { teamId: zespol.id },
      select: { id: true },
    });

    const projekt = await prisma.taskProject.create({
      data: { name: `P-${rnd()}`, ...(await wlasnoscDoZapisu(wlasciciel.id)) },
    });
    const zadanie = await prisma.task.create({
      data: { title: `T-${rnd()}`, projectId: projekt.id, createdById: wlasciciel.id },
    });

    const nadanie = (typ: string, id: string, podmiot: string, podmiotId: string) =>
      prisma.resourceGrant.findUnique({
        where: {
          resourceType_resourceId_subjectType_subjectId: {
            resourceType: typ,
            resourceId: id,
            subjectType: podmiot,
            subjectId: podmiotId,
          },
        },
        select: { role: true, workspaceId: true },
      });

    try {
      await t.test("członkostwo MEMBER → nadanie `editor` w przestrzeni projektu", async () => {
        await mirrorProjectMember(projekt.id, czlonek.id, "MEMBER", wlasciciel.id);
        const n = await nadanie("tasks.project", projekt.id, "user", czlonek.id);
        assert.equal(n?.role, "editor");
        const p = await prisma.taskProject.findUnique({
          where: { id: projekt.id },
          select: { workspaceId: true },
        });
        assert.equal(n?.workspaceId, p?.workspaceId, "nadanie żyje w przestrzeni ZASOBU");
      });

      await t.test("awans na ADMIN podnosi rolę w lustrze, nie dokłada drugiego wiersza", async () => {
        await mirrorProjectMember(projekt.id, czlonek.id, "ADMIN", wlasciciel.id);
        const n = await nadanie("tasks.project", projekt.id, "user", czlonek.id);
        assert.equal(n?.role, "manager");
        const ile = await prisma.resourceGrant.count({
          where: { resourceType: "tasks.project", resourceId: projekt.id },
        });
        assert.equal(ile, 1);
      });

      await t.test("degradacja z ADMIN na MEMBER OBNIŻA rolę", async () => {
        // Gdyby lustro tylko dokładało, degradacja zostawiłaby stare, wyższe nadanie —
        // czyli cichą odmowę odebrania uprawnień.
        await mirrorProjectMember(projekt.id, czlonek.id, "MEMBER", wlasciciel.id);
        const n = await nadanie("tasks.project", projekt.id, "user", czlonek.id);
        assert.equal(n?.role, "editor");
      });

      await t.test("usunięcie członkostwa zabiera nadanie", async () => {
        await unmirrorProjectMember(projekt.id, czlonek.id);
        assert.equal(await nadanie("tasks.project", projekt.id, "user", czlonek.id), null);
      });

      await t.test("udostępnienie zadania OSOBIE → nadanie `viewer`", async () => {
        await mirrorTaskShare(zadanie.id, { userId: czlonek.id }, "VIEWER", wlasciciel.id);
        const n = await nadanie("tasks.task", zadanie.id, "user", czlonek.id);
        assert.equal(n?.role, "viewer");
      });

      await t.test("udostępnienie ZESPOŁOWI → nadanie dla jego PRZESTRZENI", async () => {
        // To jest sens `subjectType: "workspace"`: dostęp dostaje przestrzeń, więc obejmuje
        // każdego jej członka — dokładnie tak, jak dziś działa `TaskShare.teamId`.
        await mirrorTaskShare(zadanie.id, { teamId: zespol.id }, "EDITOR", wlasciciel.id);
        const n = await nadanie("tasks.task", zadanie.id, "workspace", przestrzenZespolu!.id);
        assert.equal(n?.role, "editor");
      });

      await t.test("cofnięcie udostępnienia zespołowi zabiera nadanie przestrzeni", async () => {
        await unmirrorTaskShare(zadanie.id, { teamId: zespol.id });
        assert.equal(await nadanie("tasks.task", zadanie.id, "workspace", przestrzenZespolu!.id), null);
      });

      await t.test("zasób BEZ przestrzeni jest niemożliwy — baza go odrzuca (075)", async () => {
        // Dawniej: „zasób bez przestrzeni nie dostaje nadania i nie wywala zapisu" — obrona przed
        // sierotą. Etap 4 zaostrzył `TaskProject.workspaceId` do NOT NULL, więc sieroty nie da się
        // już utworzyć i obrona stała się bezprzedmiotowa. Sprawdzamy zatem jej przyczynę: gdyby
        // ktoś cofnął `NOT NULL`, `mirrorProjectMember` znów mogłoby dostać zasób bez przestrzeni,
        // a `ResourceGrant.workspaceId` jest wymagane — czyli wróciłby dokładnie ten problem.
        const projekt = await prisma.taskProject.create({
          data: { name: `S-${rnd()}`, ...(await wlasnoscDoZapisu(wlasciciel.id)) },
        });
        // Surowym SQL-em — typ Prismy też tego zabrania, ale typ nie chroni zapisów spoza klienta.
        await assert.rejects(
          () => prisma.$executeRawUnsafe(`UPDATE "TaskProject" SET "workspaceId" = NULL WHERE "id" = $1`, projekt.id),
          /null/i,
        );
        await prisma.taskProject.delete({ where: { id: projekt.id } });
      });

      await t.test("061: udostępnienie ZWIERZĘCIA osobie i zespołowi", async () => {
        const zwierze = await prisma.pet.create({
          data: { name: `Z-${rnd()}`, species: "kot", ...(await wlasnoscDoZapisu(wlasciciel.id)) },
        });
        try {
          await mirrorPetShare(zwierze.id, { userId: czlonek.id }, "EDITOR", wlasciciel.id);
          assert.equal((await nadanie("pets.pet", zwierze.id, "user", czlonek.id))?.role, "editor");

          await mirrorPetShare(zwierze.id, { teamId: zespol.id }, "VIEWER", wlasciciel.id);
          assert.equal(
            (await nadanie("pets.pet", zwierze.id, "workspace", przestrzenZespolu!.id))?.role,
            "viewer",
          );

          await unmirrorPetShare(zwierze.id, { userId: czlonek.id });
          assert.equal(await nadanie("pets.pet", zwierze.id, "user", czlonek.id), null);
        } finally {
          await prisma.resourceGrant.deleteMany({ where: { resourceId: zwierze.id } });
          await prisma.pet.delete({ where: { id: zwierze.id } });
        }
      });

      await t.test("rola spoza słownika nie tworzy nadania", async () => {
        // Cicha degradacja do `viewer` przyznałaby dostęp na podstawie danych, których
        // nie rozumiemy.
        await mirrorProjectMember(projekt.id, czlonek.id, "COŚ_NOWEGO", wlasciciel.id);
        assert.equal(await nadanie("tasks.project", projekt.id, "user", czlonek.id), null);
      });
    } finally {
      await prisma.resourceGrant.deleteMany({
        where: { resourceId: { in: [projekt.id, zadanie.id] } },
      });
      await prisma.task.deleteMany({ where: { id: zadanie.id } });
      await prisma.taskProject.deleteMany({ where: { id: projekt.id } });
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      for (const u of [wlasciciel, czlonek]) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
  },
);
