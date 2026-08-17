import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";

/**
 * 078/079 (zadanie 11, etap 4) — ZAPIS TRAFIA DO WŁAŚCIWEJ PRZESTRZENI.
 *
 * **Czym ten test był, a czym jest.** W fazie podwójnego zapisu (078) porównywał przestrzeń
 * policzoną przez KOD z przestrzenią dorobioną przez WYZWALACZ z kolumn własnościowych — dwa
 * niezależne źródła, więc rozjazd między nimi miał gdzie wyjść. Migracja 0244 usunęła te kolumny:
 * wyzwalacz nie ma z czego wyprowadzać, więc tamtego punktu odniesienia po prostu nie ma.
 *
 * **Niezależne źródło, które zostało: LUSTRO.** `Workspace.personalUserId` i `Workspace.teamId`
 * są wypełniane przez `platform/workspaces/sync` (zadanie 9) i nie przechodzą przez `zapis.ts`
 * ani przez kontekst dostępu. Czytamy je więc wprost i wymagamy, żeby `wlasnoscDoZapisu` wskazała
 * dokładnie tę przestrzeń. To nie jest powtórzenie tej samej arytmetyki: `zapis.ts` idzie przez
 * `getAccessContext` (cache, domykanie brakującej przestrzeni), lustro — przez klucze unikalne.
 *
 * **Sonda, bez której test byłby dekoracją** (lekcja z 077): w przypadku OSOBISTYM oba źródła
 * zwracają to samo z definicji, więc odwrócenie argumentów nie miałoby jak się pokazać. Dlatego
 * rozstrzyga przypadek ZESPOŁOWY — tam prywatna przestrzeń autora i przestrzeń zespołu to dwie
 * RÓŻNE wartości, a asercja `notEqual` niżej pilnuje, że naprawdę są różne.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "zapis trafia do przestrzeni wskazanej przez lustro",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { wlasnoscDoZapisu, wlasnoscOsobistaDoZapisu } = await import("../zapis");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import("../sync");

    const ja = await prisma.user.create({ data: { email: `wlasnosc-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(ja.id);
    const zespol = await prisma.team.create({ data: { name: `Zespół ${rnd()}`, ownerId: ja.id } });
    await syncTeamWorkspace(zespol.id);

    // Punkt odniesienia: lustro, czytane wprost.
    const prywatna = await prisma.workspace.findUniqueOrThrow({
      where: { personalUserId: ja.id },
      select: { id: true },
    });
    const zespolowa = await prisma.workspace.findUniqueOrThrow({
      where: { teamId: zespol.id },
      select: { id: true },
    });

    try {
      await t.test("prywatna i zespołowa przestrzeń to RÓŻNE wartości", () => {
        // Bez tego przypadek zespołowy niżej przechodziłby także po zepsuciu kodu.
        assert.notEqual(prywatna.id, zespolowa.id);
      });

      await t.test("zapis osobisty ląduje w przestrzeni osobistej", async () => {
        const wlasnosc = await wlasnoscDoZapisu(ja.id, null);
        assert.equal(wlasnosc.workspaceId, prywatna.id);

        const zapisany = await prisma.note.create({
          data: { title: `osob-${rnd()}`, content: "", ...wlasnosc },
        });
        assert.equal(zapisany.workspaceId, prywatna.id, "rekord musi trafić do przestrzeni pytającego");
      });

      await t.test("zapis zespołowy ląduje w przestrzeni ZESPOŁU, nie zapisującego", async () => {
        const wlasnosc = await wlasnoscDoZapisu(ja.id, zespol.id);
        assert.equal(wlasnosc.workspaceId, zespolowa.id);

        const zapisany = await prisma.note.create({
          data: { title: `zesp-${rnd()}`, content: "", ...wlasnosc },
        });
        assert.equal(zapisany.workspaceId, zespolowa.id);
        assert.notEqual(
          zapisany.workspaceId,
          prywatna.id,
          "pomyłka w argumencie wypisałaby dane zespołu do prywatnej szufladki autora"
        );
      });

      await t.test("wariant osobisty zapisuje tam samo co pełny", async () => {
        const wlasnosc = await wlasnoscOsobistaDoZapisu(ja.id);
        assert.equal(wlasnosc.workspaceId, prywatna.id);

        const zapisany = await prisma.weatherLocation.create({
          data: { label: `loc-${rnd()}`, lat: 52.2, lon: 21.0, ...wlasnosc },
        });
        assert.equal(zapisany.workspaceId, prywatna.id);
      });

      await t.test("konto bez przestrzeni dostaje ją razem z rolą, a nie odmowę", async () => {
        // Rekord bez przestrzeni jest niezapisywalny (`workspaceId` NOT NULL), więc `zapis.ts`
        // domyka brak zamiast rzucać — i musi przy tym utworzyć TAKŻE członkostwo, inaczej
        // przestrzeń istnieje, a dostępu nie daje (pułapka z 056).
        const nowy = await prisma.user.create({ data: { email: `swiezy-${rnd()}@test.local` } });
        try {
          const { workspaceId } = await wlasnoscDoZapisu(nowy.id);
          const czlonkostwo = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: nowy.id } },
            select: { role: true },
          });
          assert.equal(czlonkostwo?.role, "owner", "brak wiersza członkostwa = przestrzeń bez dostępu");
        } finally {
          await prisma.user.delete({ where: { id: nowy.id } }).catch(() => {});
        }
      });
    } finally {
      await prisma.note.deleteMany({
        where: { workspaceId: { in: [prywatna.id, zespolowa.id] } },
      });
      await prisma.weatherLocation.deleteMany({ where: { ...(await filtrMoichRekordow(ja.id)) } });
      await prisma.workspaceMember.deleteMany({ where: { userId: ja.id } });
      await prisma.workspace.deleteMany({
        where: { OR: [{ personalUserId: ja.id }, { teamId: zespol.id }] },
      });
      await prisma.team.deleteMany({ where: { id: zespol.id } });
      await prisma.user.deleteMany({ where: { id: ja.id } });
    }
  }
);
