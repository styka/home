import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 058 — ZAKRES LIST PO PRZESTRZENIACH.
 *
 * **079: dowód zmienił kształt, bo stracił drugą stronę porównania.** Do etapu 4 test zestawiał
 * zbiory identyfikatorów zwrócone przez STARY warunek (para kolumn `ownerId`/`ownerTeamId`)
 * i NOWY (przestrzenie) — tak wygląda dowód równoważności przełączenia. Migracja 0244 usunęła
 * kolumny, więc starego warunku nie da się już nawet wyrazić: nie ma czego z czym porównywać,
 * a udawanie, że jest, sprowadzałoby się do porównania nowej reguły z jej własną kopią.
 *
 * Zostaje to, co nadal jest sprawdzalne i nadal może się zepsuć: **czy zakres pokazuje dokładnie
 * to, co powinien** — mój zasób i zasób zespołu, nigdy cudzy — oraz że niesie go PRZESTRZEŃ,
 * a nie coś, co przypadkiem daje ten sam wynik.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "058: zakres po przestrzeniach zwraca ten sam zbiór, co zakres po parze kolumn",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ownedOrAsync } = await import("../serverUtils");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );

    const ja = await prisma.user.create({ data: { email: `os-ja-${rnd()}@test.local` } });
    const kolega = await prisma.user.create({ data: { email: `os-kol-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `os-obc-${rnd()}@test.local` } });

    // Zespół, w którym JA mam wiersz członkostwa (żeby stary i nowy zakres były porównywalne).
    const zespol = await prisma.team.create({
      data: {
        name: `OS-${rnd()}`,
        ownerId: kolega.id,
        members: { create: [{ userId: ja.id, role: "MEMBER" }] },
      },
    });

    await ensurePersonalWorkspace(ja.id);
    await ensurePersonalWorkspace(kolega.id);
    await ensurePersonalWorkspace(obcy.id);
    await syncTeamWorkspace(zespol.id);

    // Zasoby: mój, zespołowy, cudzy — plus SIEROTA (bez przestrzeni), której właścicielem jestem ja.
    const moj = await prisma.habit.create({ data: { name: `h-moj-${rnd()}`, ...(await wlasnoscDoZapisu(ja.id)) } });
    const zespolowy = await prisma.habit.create({
      data: { name: `h-zesp-${rnd()}`, ...(await wlasnoscDoZapisu(kolega.id, zespol.id)) },
    });
    const cudzy = await prisma.habit.create({ data: { name: `h-obc-${rnd()}`, ...(await wlasnoscDoZapisu(obcy.id)) } });
    // 075: SIEROTY JUŻ NIE DA SIĘ ZROBIĆ. Etap 4 zaostrzył `Habit.workspaceId` do NOT NULL, więc
    // wcześniejsze `update({ workspaceId: null })` jest odrzucane przez bazę. Test przestał więc
    // sprawdzać gałąź awaryjną, a zaczął sprawdzać niezmiennik, który ją unieważnił — to mocniejsze
    // zdanie: zamiast „obchodzimy brak przestrzeni" mówimy „brak przestrzeni jest niemożliwy".
    const wszystkie = [moj.id, zespolowy.id, cudzy.id];

    /** Zbiór identyfikatorów widocznych danym warunkiem — ograniczony do fixture. */
    async function widoczne(or: Record<string, unknown>[]): Promise<string[]> {
      const r = await prisma.habit.findMany({
        where: { AND: [{ id: { in: wszystkie } }, { OR: or }] },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      return r.map((x) => x.id);
    }

    try {
      await t.test("zakres pokazuje mój zasób i zasób zespołu, nigdy cudzy", async () => {
        const nowy = await widoczne(await ownedOrAsync(ja.id));
        assert.deepEqual(
          nowy,
          [moj.id, zespolowy.id].sort(),
          "zakres list po przestrzeniach ma pokazywać dokładnie te dwa rekordy",
        );
        assert.ok(!nowy.includes(cudzy.id), "cudzy zasób nie może być widoczny");
      });

      await t.test("rekord BEZ przestrzeni jest niemożliwy — baza go odrzuca (075)", async () => {
        // Następca dawnego testu „sierota pozostaje widoczna dla właściciela". Tamten zabezpieczał
        // gałąź awaryjną; ta asercja zabezpiecza powód, dla którego gałąź zniknęła. Bez niej
        // cofnięcie `NOT NULL` przeszłoby niezauważone, a wraz z nim wróciłyby rekordy poza
        // kontrolą dostępu opartą na przestrzeniach.
        // SUROWYM SQL-em, nie przez Prismę — i to jest cały sens tej asercji. Typy Prismy też
        // zabraniają teraz `workspaceId: null` (błąd kompilacji), ale typ chroni wyłącznie kod
        // przechodzący przez klienta. Wyzwalacz z 055 wybrano właśnie dlatego, że zapis potrafi
        // przyjść z surowego SQL-a, z seeda albo z zapisu zagnieżdżonego. Tu sprawdzamy tę samą
        // drogę: czy niezmiennika pilnuje BAZA, a nie tylko TypeScript.
        await assert.rejects(
          () => prisma.$executeRawUnsafe(`UPDATE "Habit" SET "workspaceId" = NULL WHERE "id" = $1`, moj.id),
          /null/i,
          "zaostrzenie z etapu 4 musi blokować wyzerowanie przestrzeni także spoza Prismy",
        );
      });

      await t.test("obcy nie widzi niczego z tego fixture", async () => {
        const nowy = await widoczne(await ownedOrAsync(obcy.id));
        assert.deepEqual(nowy, [cudzy.id]);
      });

      await t.test("nowa gałąź NAPRAWDĘ działa — nie niesie jej własność (kontrola z 056)", async () => {
        // 079: kontrola przestawiona na dzisiejsze środki po raz drugi. Mierzy to samo, co od 056:
        // że wynik niesie ZAKRES PO PRZESTRZENIACH, a nie coś, co przypadkiem daje tę samą listę.
        // Rozróżniamy to zasobem zespołowym — leży w innej przestrzeni niż moja osobista, więc
        // zawężenie do samej osobistej musi go zgubić.
        const mojaPrzestrzen = await prisma.workspace.findUniqueOrThrow({
          where: { personalUserId: ja.id },
          select: { id: true },
        });
        const zespolowyRekord = await prisma.habit.findUniqueOrThrow({
          where: { id: zespolowy.id },
          select: { workspaceId: true },
        });
        assert.notEqual(
          zespolowyRekord.workspaceId,
          mojaPrzestrzen.id,
          "fixture zespołowy MUSI leżeć poza moją przestrzenią osobistą — inaczej test nie mierzy gałęzi zespołowej",
        );

        const tylkoOsobista = await widoczne([{ workspaceId: mojaPrzestrzen.id }]);
        assert.ok(
          !tylkoOsobista.includes(zespolowy.id),
          "sama przestrzeń osobista nie może wystarczyć — inaczej test nie mierzyłby zakresu zespołowego",
        );
        const pelny = await widoczne(await ownedOrAsync(ja.id));
        assert.ok(pelny.includes(zespolowy.id), "pełny zakres MUSI pokazać zasób zespołu");
      });
    } finally {
      await prisma.habit.deleteMany({ where: { id: { in: wszystkie } } });
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      for (const u of [ja, kolega, obcy]) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
  },
);
