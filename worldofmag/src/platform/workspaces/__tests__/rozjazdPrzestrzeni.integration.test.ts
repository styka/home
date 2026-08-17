import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 078 (zadanie 11, etap 4 część 2) — WYZWALACZ ODRZUCA ROZJAZD PRZESTRZENI (migracja 0240).
 *
 * Konwersja 250 miejsc zapisu ma jeden tryb awarii i jest on cichy: miejsce zapisu przekazuje do
 * `wlasnoscDoZapisu` innego użytkownika albo pomija `teamId`, więc rekord dostaje `workspaceId`
 * niezgodny z własnym `ownerId`/`ownerTeamId`. Kompilator tego nie widzi (dwa poprawne stringi),
 * testy jednostkowe też nie, a objaw pojawia się dopiero wtedy, gdy ktoś zobaczy nie swoje dane.
 * Migracja 0240 zamienia tę usterkę w błąd zapisu. Ten test sprawdza, że faktycznie zamienia.
 *
 * Cztery przypadki, każdy dobrany pod inny sposób, w jaki sprawdzenie mogłoby być bezużyteczne:
 *  1. rozjazd osobisty — cudza przestrzeń przy własnym `ownerId` → **odrzucone**;
 *  2. rozjazd zespołowy — przestrzeń osobista przy `ownerTeamId` → **odrzucone**
 *     (to jest dokładnie skutek pominięcia `teamId` w wywołaniu helpera);
 *  3. zapis zgodny → **przechodzi**, bo bramka, która blokuje też poprawne zapisy, zostanie
 *     wyłączona przy pierwszym wdrożeniu i nikogo już nigdy nie obroni;
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
            prisma.note.create({
              data: { title: `rozjazd-${rnd()}`, ownerId: ja.id, workspaceId: cudza.id },
            }),
          /rozjazd przestrzeni/,
          "zapis rekordu do cudzej przestrzeni musi zostać odrzucony przez bazę"
        );
      });

      await t.test("rozjazd zespołowy: pominięty teamId → odrzucone", async () => {
        // Tak wygląda w praktyce pomyłka `wlasnoscDoZapisu(userId)` zamiast
        // `wlasnoscDoZapisu(userId, teamId)`: rekord należy do zespołu, a przestrzeń jest prywatna.
        await assert.rejects(
          () =>
            prisma.note.create({
              data: { title: `rozjazd-${rnd()}`, ownerTeamId: zespol.id, workspaceId: moja.id },
            }),
          /rozjazd przestrzeni/
        );
      });

      await t.test("zapis zgodny przechodzi (bramka nie blokuje poprawnych zapisów)", async () => {
        const osobisty = await prisma.note.create({
          data: { title: `zgodny-${rnd()}`, ownerId: ja.id, workspaceId: moja.id },
        });
        assert.equal(osobisty.workspaceId, moja.id);

        const zespolowy = await prisma.note.create({
          data: { title: `zgodny-${rnd()}`, ownerTeamId: zespol.id, workspaceId: zespolowa.id },
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
      await prisma.note.deleteMany({
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
