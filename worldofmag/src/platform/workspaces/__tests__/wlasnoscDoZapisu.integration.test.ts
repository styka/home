import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrMoichRekordow, wlasnoscDoZapisu, wlasnoscOsobistaDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 078 (zadanie 11, etap 4 część 2) — FAZA PODWÓJNEGO ZAPISU JEST SPÓJNA.
 *
 * `wlasnoscDoZapisu` podaje przy zapisie **jednocześnie** `workspaceId` (bo wyzwalacz umrze razem
 * z kolumnami własnościowymi) i same kolumny własnościowe (bo baza ich jeszcze wymaga na 14
 * tabelach). Ryzyko tej fazy jest dokładnie jedno i jest ciche: **te dwie informacje mogą się
 * rozjechać**. Rekord powie „należę do zespołu", a przestrzeń wskaże prywatną szufladkę autora —
 * albo odwrotnie. Nic nie zapłonie: `tsc` widzi dwa poprawne stringi, ekran się wyrenderuje,
 * a rozjazd wyjdzie dopiero w etapie, w którym kolumny znikną i zostanie sama przestrzeń.
 *
 * **Dlaczego asercja porównuje się z WYZWALACZEM, a nie z powtórzoną arytmetyką.** Gdyby test
 * liczył oczekiwany `workspaceId` samodzielnie (`teamId ? przestrzeń zespołu : przestrzeń osobista`),
 * sprawdzałby, czy dwa kawałki tego samego rozumowania się zgadzają — czyli nic. Punktem odniesienia
 * musi być **niezależne** źródło prawdy, a takie istnieje i działa dziś na produkcji: wyzwalacz
 * `omnia_fill_workspace` z 0236/0238, który tę samą przestrzeń wyprowadza z kolumn własnościowych.
 * Test wykonuje więc dwa zapisy — jeden z przestrzenią podaną przez kod, drugi z przestrzenią
 * dorobioną przez wyzwalacz — i wymaga, by wypadły identycznie.
 *
 * Kontrola, że test nie jest fałszywie zielony (lekcja z 077): odwrócenie argumentów w
 * `wlasnoscDoZapisu` musi go zaczerwienić. Wymuszamy to przypadkiem zespołowym — tam prywatna
 * przestrzeń autora i przestrzeń zespołu to dwie RÓŻNE wartości, więc pomyłka ma gdzie się pokazać.
 * W przypadku osobistym oba źródła zwracają to samo z definicji i test przeszedłby nawet zepsuty.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "faza podwójnego zapisu: przestrzeń z kodu = przestrzeń z wyzwalacza",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { wlasnoscDoZapisu, wlasnoscOsobistaDoZapisu } = await import("../zapis");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import("../sync");

    const ja = await prisma.user.create({ data: { email: `wlasnosc-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(ja.id);
    const zespol = await prisma.team.create({ data: { name: `Zespół ${rnd()}`, ownerId: ja.id } });
    await syncTeamWorkspace(zespol.id);

    try {
      await t.test("zapis osobisty: kod zgadza się z wyzwalaczem", async () => {
        const wlasnosc = await wlasnoscDoZapisu(ja.id, null);

        const zKodu = await prisma.note.create({
          data: { title: `kod-${rnd()}`, content: "", ...wlasnosc },
        });
        // Ten zapis NIE podaje przestrzeni — wypełni ją wyzwalacz z kolumn własnościowych.
        const zWyzwalacza = await prisma.note.create({
          data: { title: `wyzw-${rnd()}`, content: "", ...(await wlasnoscDoZapisu(ja.id)) },
        });

        assert.equal(
          zKodu.workspaceId,
          zWyzwalacza.workspaceId,
          "kod i wyzwalacz muszą wskazać tę samą przestrzeń — inaczej faza podwójnego zapisu rozjeżdża dane"
        );
        assert.equal(wlasnosc.ownerId, ja.id, "kolumna właściciela musi zostać wypełniona, dopóki istnieje");
        assert.equal(wlasnosc.ownerTeamId, null);
      });

      await t.test("zapis zespołowy: kod zgadza się z wyzwalaczem", async () => {
        const wlasnosc = await wlasnoscDoZapisu(ja.id, zespol.id);

        const zKodu = await prisma.note.create({
          data: { title: `kod-${rnd()}`, content: "", ...wlasnosc },
        });
        const zWyzwalacza = await prisma.note.create({
          data: { title: `wyzw-${rnd()}`, content: "", ownerTeamId: zespol.id },
        });

        assert.equal(
          zKodu.workspaceId,
          zWyzwalacza.workspaceId,
          "rekord zespołowy musi trafić do przestrzeni ZESPOŁU — tu pomyłka jest widoczna, bo przestrzenie są różne"
        );
        assert.equal(wlasnosc.ownerId, null, "rekord zespołowy nie ma właściciela osobistego (kolumny wykluczają się)");
        assert.equal(wlasnosc.ownerTeamId, zespol.id);

        // To jest ta sonda: prywatna przestrzeń autora i przestrzeń zespołu MUSZĄ być różne,
        // inaczej powyższa asercja nie mogłaby wykryć odwrócenia argumentów.
        const prywatna = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: ja.id } });
        assert.notEqual(
          zKodu.workspaceId,
          prywatna.id,
          "gdyby to były te same przestrzenie, test przechodziłby także po zepsuciu kodu"
        );
      });

      await t.test("wariant osobisty daje właściciela typu string, nie null", async () => {
        const wlasnosc = await wlasnoscOsobistaDoZapisu(ja.id);
        // Tabele o `ownerId NOT NULL` (14 z 40) odrzucą zapis z `null`. Typ ma to wykluczyć,
        // ale sprawdzamy też wartość — typ znika w czasie działania, baza nie.
        assert.equal(wlasnosc.ownerId, ja.id);

        const zKodu = await prisma.weatherLocation.create({
          data: { label: `kod-${rnd()}`, lat: 52.2, lon: 21.0, ...wlasnosc },
        });
        const zWyzwalacza = await prisma.weatherLocation.create({
          data: { label: `wyzw-${rnd()}`, lat: 52.2, lon: 21.0, ...(await wlasnoscOsobistaDoZapisu(ja.id)) },
        });
        assert.equal(zKodu.workspaceId, zWyzwalacza.workspaceId);
      });
    } finally {
      await prisma.note.deleteMany({ where: { OR: [{ ownerId: ja.id }, { ownerTeamId: zespol.id }] } });
      await prisma.weatherLocation.deleteMany({ where: { ...(await filtrMoichRekordow(ja.id)) } });
      await prisma.workspaceMember.deleteMany({ where: { userId: ja.id } });
      await prisma.workspace.deleteMany({ where: { OR: [{ personalUserId: ja.id }, { teamId: zespol.id }] } });
      await prisma.team.deleteMany({ where: { id: zespol.id } });
      await prisma.user.deleteMany({ where: { id: ja.id } });
    }
  }
);
