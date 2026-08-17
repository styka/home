import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 058 — RÓWNOŚĆ ZBIORÓW PRZED I PO PRZEŁĄCZENIU ZAKRESU NA PRZESTRZENIE.
 *
 * 057 dowiodło, że stary i nowy **zapis** warunku dają ten sam kształt. Ten przebieg zmienia
 * **znaczenie**, więc dowód musi być inny: porównujemy **zbiory identyfikatorów** zwrócone przez
 * bazę dla starego warunku (para kolumn) i nowego (przestrzenie), na tym samym fixture.
 *
 * Trzy sytuacje, które muszą wyjść identycznie — i jedna, która ma się różnić w sposób
 * przewidziany przez spec (§4): właściciel zespołu **bez wiersza `TeamMember`**.
 *
 * Lekcja z 056 obowiązuje tu wprost: fixture **musi** mieć przestrzenie, inaczej nowa gałąź nie
 * ma na czym zadziałać i test dowiódłby wyłącznie tego, że działa gałąź awaryjna.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "058: zakres po przestrzeniach zwraca ten sam zbiór, co zakres po parze kolumn",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ownedOr, ownedOrAsync, getUserTeamIds } = await import("../serverUtils");
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
    const moj = await prisma.habit.create({ data: { name: `h-moj-${rnd()}`, ownerId: ja.id } });
    const zespolowy = await prisma.habit.create({
      data: { name: `h-zesp-${rnd()}`, ownerTeamId: zespol.id },
    });
    const cudzy = await prisma.habit.create({ data: { name: `h-obc-${rnd()}`, ownerId: obcy.id } });
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
      await t.test("zbiory są identyczne (AC-1, AC-2, AC-4)", async () => {
        const teamIds = await getUserTeamIds(ja.id);
        const stary = await widoczne(ownedOr(ja.id, teamIds));
        const nowy = await widoczne(await ownedOrAsync(ja.id));
        assert.deepEqual(nowy, stary, "przełączenie zakresu nie może zmienić zbioru rekordów");
        assert.ok(stary.includes(moj.id), "mój zasób");
        assert.ok(stary.includes(zespolowy.id), "zasób zespołu, w którym mam członkostwo");
        assert.ok(!stary.includes(cudzy.id), "cudzy zasób nie może być widoczny");
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
        // 075: kontrola z 056 przestawiona na dzisiejsze środki. Tamta wersja wymuszała stare
        // gałęzie awaryjne (`workspaceId: null`), żeby pokazać, że to nie one dźwigają wynik.
        // Po etapie 4 tych gałęzi nie da się już nawet WYRAZIĆ — dla kolumny NOT NULL Prisma
        // odrzuca taki filtr. Mierzymy więc to samo od drugiej strony: zasób ZESPOŁOWY nie ma
        // `ownerId`, więc jedyną drogą do niego jest gałąź po przestrzeniach. Gdyby przestała
        // działać, wypadłby ze zbioru — i to jest ta sama informacja, co dawniej.
        const zespolowyRekord = await prisma.habit.findUniqueOrThrow({
          where: { id: zespolowy.id },
          select: { ownerId: true, workspaceId: true },
        });
        assert.equal(zespolowyRekord.ownerId, null, "fixture zespołowy nie może mieć właściciela-osoby");
        assert.notEqual(zespolowyRekord.workspaceId, null, "fixture zespołowy musi mieć przestrzeń");

        const tylkoWlasnosc = await widoczne([{ ownerId: ja.id }]);
        assert.ok(
          !tylkoWlasnosc.includes(zespolowy.id),
          "sama własność nie może wystarczyć — inaczej test nie mierzyłby gałęzi po przestrzeniach",
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
