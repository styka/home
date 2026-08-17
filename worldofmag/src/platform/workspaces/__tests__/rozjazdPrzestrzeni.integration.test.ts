import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 078/079 — WYZWALACZ ODRZUCA ROZJAZD PRZESTRZENI (migracja 0240).
 *
 * **Czym ten test był w 078, a czym jest teraz.** Powstał na czas fazy podwójnego zapisu, gdy ta
 * sama informacja o własności żyła w bazie dwa razy: w `workspaceId` i w kolumnach właścicielskich.
 * Migracja 0240 kazała bazie porównywać oba nośniki i odrzucać rozjazd — dzięki temu jedyny cichy
 * tryb awarii konwersji 250 miejsc zapisu (rekord w CUDZEJ przestrzeni) stał się głośnym błędem.
 *
 * **079: przedmiot skurczył się, ale nie zniknął.** Migracja 0244 usunęła kolumny własnościowe
 * z 40 tabel, więc dla nich nie ma już czego porównywać. Zostaje ich **pięć**
 * (`src/lib/db/workspace-nullable.json`) — tam `ownerId`/`ownerTeamId` żyją dalej, bo wiersz może
 * nie mieć właściciela, więc wyzwalacz nadal ma dwa nośniki i nadal musi pilnować ich zgodności.
 * Test przeniesiony na `NoteGroup`: ta sama reguła, tabela, na której wciąż obowiązuje.
 *
 * Cztery przypadki, każdy dobrany pod inny sposób, w jaki sprawdzenie mogłoby być bezużyteczne:
 *  1. rozjazd osobisty — cudza przestrzeń przy własnym `ownerId` → **odrzucone**;
 *  2. rozjazd zespołowy — przestrzeń osobista przy `ownerTeamId` → **odrzucone**;
 *  3. zapis zgodny → **przechodzi**, bo bramka blokująca też poprawne zapisy zostanie wyłączona
 *     przy pierwszym wdrożeniu i nikogo już nigdy nie obroni;
 *  4. właściciel bez przestrzeni → **przechodzi**, bo drugiego źródła prawdy nie ma i nie ma czego
 *     porównywać (reguła z 0238: wyzwalacz leczy brak, nie wymyśla właścicieli).
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "wyzwalacz 0240: rozjazd workspaceId ↔ kolumny własnościowe jest odrzucany",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import("../sync");

    const ja = await prisma.user.create({ data: { email: `rozjazd-ja-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `rozjazd-obcy-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(ja.id);
    await ensurePersonalWorkspace(obcy.id);
    const zespol = await prisma.team.create({ data: { name: `Zespół ${rnd()}`, ownerId: ja.id } });
    await syncTeamWorkspace(zespol.id);

    const moja = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: ja.id } });
    const cudza = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: obcy.id } });
    const zespolowa = await prisma.workspace.findUniqueOrThrow({ where: { teamId: zespol.id } });

    try {
      await t.test("rozjazd osobisty: mój rekord w cudzej przestrzeni → odrzucone", async () => {
        await assert.rejects(
          () =>
            prisma.noteGroup.create({
              data: { name: `rozjazd-${rnd()}`, ownerId: ja.id, workspaceId: cudza.id },
            }),
          /rozjazd przestrzeni/,
          "zapis rekordu do cudzej przestrzeni musi zostać odrzucony przez bazę"
        );
      });

      await t.test("rozjazd zespołowy: pominięty teamId → odrzucone", async () => {
        await assert.rejects(
          () =>
            prisma.noteGroup.create({
              data: { name: `rozjazd-${rnd()}`, ownerTeamId: zespol.id, workspaceId: moja.id },
            }),
          /rozjazd przestrzeni/
        );
      });

      await t.test("zapis zgodny przechodzi (bramka nie blokuje poprawnych zapisów)", async () => {
        const osobisty = await prisma.noteGroup.create({
          data: { name: `zgodny-${rnd()}`, ownerId: ja.id, workspaceId: moja.id },
        });
        assert.equal(osobisty.workspaceId, moja.id);

        const zespolowy = await prisma.noteGroup.create({
          data: { name: `zgodny-${rnd()}`, ownerTeamId: zespol.id, workspaceId: zespolowa.id },
        });
        assert.equal(zespolowy.workspaceId, zespolowa.id);
      });

      await t.test("właściciel bez przestrzeni: brak drugiego źródła → przechodzi", async () => {
        // `Job.ownerId` to zwykły tekst bez klucza obcego (jedna z pięciu tabel
        // z `workspace-nullable.json`), więc da się tu wpisać właściciela, który nie ma przestrzeni.
        const zadanie = await prisma.job.create({
          data: { type: "news.refresh", ownerId: `nieistniejacy-${rnd()}`, workspaceId: moja.id },
        });
        assert.equal(
          zadanie.workspaceId,
          moja.id,
          "gdy kolumny własnościowe na nic nie wskazują, podana przestrzeń zostaje bez pytania"
        );
      });
    } finally {
      await prisma.job.deleteMany({ where: { workspaceId: moja.id } });
      await prisma.noteGroup.deleteMany({
        where: { OR: [{ ownerId: ja.id }, { ownerTeamId: zespol.id }] },
      });
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: [ja.id, obcy.id] } } });
      await prisma.workspace.deleteMany({
        where: { id: { in: [moja.id, cudza.id, zespolowa.id] } },
      });
      await prisma.team.deleteMany({ where: { id: zespol.id } });
      await prisma.user.deleteMany({ where: { id: { in: [ja.id, obcy.id] } } });
    }
  }
);
