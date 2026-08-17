import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 079 (zadanie 11, etap 4 część 3) — KASKADA PO PRZESTRZENI (migracja 0243).
 *
 * Do etapu 4 sprzątanie danych po usuniętym koncie/zespole robiła kaskada klucza obcego
 * `owner → User` / `ownerTeam → Team`. `DROP COLUMN` zabiera oba, a `workspaceId` nie miało
 * klucza obcego **w ogóle** — więc bez tej migracji usunięcie konta zostawiłoby jego dane
 * w bazie, nie zgłaszając niczego. Kompilator tego nie widzi, `tsc` tu nie sięga.
 *
 * Test sprawdza NOWĄ ścieżkę wprost, nie czekając na `DROP COLUMN`: kasuje samą przestrzeń
 * i patrzy, czy zabrała zasoby. Dopóki stare kolumny stoją, jest to jedyny sposób odróżnić
 * kaskadę po przestrzeni od kaskady po właścicielu — usunięcie konta uruchomiłoby obie naraz
 * i nie dałoby się powiedzieć, która zadziałała.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "usunięcie przestrzeni zabiera jej zasoby (klucz obcy 0243)",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import("../sync");

    const u = await prisma.user.create({ data: { email: `kp-${rnd()}@test.local` } });
    const inny = await prisma.user.create({ data: { email: `kp-i-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(u.id);
    await ensurePersonalWorkspace(inny.id);
    const zespol = await prisma.team.create({
      data: { name: `KP-${rnd()}`, ownerId: inny.id, members: { create: [{ userId: u.id, role: "MEMBER" }] } },
    });
    await syncTeamWorkspace(zespol.id);

    const osobista = (await prisma.workspace.findUnique({
      where: { personalUserId: u.id },
      select: { id: true },
    }))!;
    const zespolowa = (await prisma.workspace.findUnique({
      where: { teamId: zespol.id },
      select: { id: true },
    }))!;

    // Zasoby w obu przestrzeniach. `Contact` jest tu kluczowy: to jedyna tabela objęta etapem 4,
    // która NIE miała klucza obcego do konta (Z-370), więc dla niej 0243 jest nową zdolnością,
    // a nie odtworzeniem starej.
    const mojaNotatka = await prisma.note.create({ data: { title: `N-${rnd()}`, ownerId: u.id } });
    const mojKontakt = await prisma.contact.create({ data: { name: `K-${rnd()}`, ownerId: u.id } });
    const notatkaZespolu = await prisma.note.create({
      data: { title: `NZ-${rnd()}`, ownerTeamId: zespol.id },
    });
    const cudzaNotatka = await prisma.note.create({ data: { title: `NC-${rnd()}`, ownerId: inny.id } });

    try {
      await t.test("kasowanie przestrzeni osobistej zabiera jej zasoby i tylko jej", async () => {
        // Kasujemy SAMĄ przestrzeń, bez ruszania konta — inaczej zadziałałaby też stara kaskada
        // po `ownerId` i test nie odróżniłby jednej od drugiej.
        await prisma.workspace.delete({ where: { id: osobista.id } });
        assert.equal(await prisma.note.count({ where: { id: mojaNotatka.id } }), 0, "notatka");
        assert.equal(await prisma.contact.count({ where: { id: mojKontakt.id } }), 0, "kontakt (Z-370: dotąd bez FK)");
        assert.equal(await prisma.user.count({ where: { id: u.id } }), 1, "konto NIE znika razem z przestrzenią");
        assert.equal(await prisma.note.count({ where: { id: notatkaZespolu.id } }), 1, "przestrzeń zespołu nietknięta");
        assert.equal(await prisma.note.count({ where: { id: cudzaNotatka.id } }), 1, "cudza przestrzeń nietknięta");
      });

      await t.test("kasowanie zespołu zabiera jego przestrzeń, a przestrzeń — jego zasoby", async () => {
        await prisma.team.delete({ where: { id: zespol.id } });
        assert.equal(await prisma.workspace.count({ where: { id: zespolowa.id } }), 0, "przestrzeń zespołu");
        assert.equal(await prisma.note.count({ where: { id: notatkaZespolu.id } }), 0, "zasób zespołu");
        assert.equal(await prisma.note.count({ where: { id: cudzaNotatka.id } }), 1, "cudza przestrzeń nietknięta");
      });
    } finally {
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: [u.id, inny.id] } } }).catch(() => {});
    }
  },
);
