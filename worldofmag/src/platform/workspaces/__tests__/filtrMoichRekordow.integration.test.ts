import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";

/**
 * 078/079 (zadanie 11, etap 4) — „MOJE REKORDY" TO PRZESTRZEŃ OSOBISTA, I NIC WIĘCEJ.
 *
 * **079: pierwszy przypadek stracił drugą stronę porównania.** Do migracji 0244 test zestawiał
 * zbiór z reguły STAREJ (`ownerId = ja`) ze zbiorem z NOWEJ (przestrzeń osobista) — tak wygląda
 * dowód równoważności. Kolumny nie ma, więc starej reguły nie da się wyrazić; zostaje sprawdzenie
 * LICZNOŚCI wobec fixture'u zbudowanego ręcznie, co jest słabszym, ale nadal niezależnym punktem
 * odniesienia. Trzy pozostałe przypadki — puste konto, brak przecieku, węższy zakres niż zespołowy
 * — nie zależały od starej kolumny i zostają bez zmian; to one niosą właściwy ciężar dowodu.
 *
 * `filtrMoichRekordow` zastąpiło `where: { ...(await filtrMoichRekordow(userId)) }` w 52 miejscach na tabelach BEZ
 * współwłasności zespołowej. `tsc` potwierdza tylko, że nowy filtr jest poprawnym warunkiem Prismy
 * — nie, że **zwraca te same wiersze**. Pomyłka tutaj nie wywraca ekranu: pokazuje listę o jeden
 * rekord krótszą albo dłuższą, czego nikt nie zauważy bez porównania.
 *
 * Dowód jest więc porównaniem ZBIORÓW na prawdziwych danych — tym samym ruchem, którym 058
 * dowodziło przełączenia `ownedOrAsync` (`ownershipScopeSwitch.integration.test.ts`).
 *
 * Trzy rzeczy, które ten test musi rozstrzygnąć, a nie założyć:
 *  1. zbiory są równe dla właściciela z rekordami;
 *  2. zbiór jest PUSTY dla konta bez rekordów — filtr, który zwraca wszystko, też dałby „równość"
 *     na zbiorze jednoelementowym, więc bez tego przypadku dowód jest dziurawy;
 *  3. **filtr nie przecieka między kontami** — rekordy obcego nie mogą wejść do mojego zbioru.
 *     To jest właściwy tryb awarii (wyciek), a nie zgubiony wiersz.
 *
 * Dodatkowo: filtr jest tu WĘŻSZY niż `ownedOrAsync` z rozmysłem, więc test pilnuje także tego —
 * rekord w przestrzeni ZESPOŁU nie może wpaść w „moje rekordy" na tabeli, która współwłasności
 * zespołowej nie zna. Gdyby ktoś kiedyś zamienił tu `filtrMoichRekordow` na `ownedWhereAsync`,
 * ten przypadek jako jedyny zaświeci na czerwono.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "filtrMoichRekordow: ten sam zbiór co ownerId, bez przecieku między kontami",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { filtrMoichRekordow, wlasnoscOsobistaDoZapisu } = await import("../zapis");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import("../sync");

    const ja = await prisma.user.create({ data: { email: `filtr-ja-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `filtr-obcy-${rnd()}@test.local` } });
    const pusty = await prisma.user.create({ data: { email: `filtr-pusty-${rnd()}@test.local` } });
    for (const u of [ja, obcy, pusty]) await ensurePersonalWorkspace(u.id);

    const zespol = await prisma.team.create({ data: { name: `Zespół ${rnd()}`, ownerId: ja.id } });
    await syncTeamWorkspace(zespol.id);
    const zespolowa = await prisma.workspace.findUniqueOrThrow({ where: { teamId: zespol.id } });

    // Trzy moje lokalizacje, dwie obce. Zapisujemy przez helper zapisu, bo to jego wynik ma
    // odczytywać helper filtra — sprawdzamy parę, nie dwie niezależne funkcje.
    const moje = await wlasnoscOsobistaDoZapisu(ja.id);
    const cudze = await wlasnoscOsobistaDoZapisu(obcy.id);
    // Identyfikatory zapamiętane WPROST — po usunięciu `ownerId` to one są punktem odniesienia.
    const mojeId: string[] = [];
    const cudzeId: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await prisma.weatherLocation.create({ data: { label: `moja-${i}-${rnd()}`, lat: 52, lon: 21, ...moje } });
      mojeId.push(r.id);
    }
    for (let i = 0; i < 2; i++) {
      const r = await prisma.weatherLocation.create({ data: { label: `cudza-${i}-${rnd()}`, lat: 50, lon: 19, ...cudze } });
      cudzeId.push(r.id);
    }

    const ids = async (where: object) =>
      (await prisma.weatherLocation.findMany({ where, select: { id: true } }))
        .map((r) => r.id)
        .sort();

    try {
      await t.test("filtr zwraca dokładnie moje rekordy z fixture'u", async () => {
        const nowaRegula = await ids(await filtrMoichRekordow(ja.id));
        assert.deepEqual(
          nowaRegula,
          mojeId.sort(),
          "filtr musi zwrócić dokładnie te trzy rekordy, które fixture zapisał jako moje",
        );
      });

      await t.test("konto bez rekordów: zbiór pusty (filtr nie zwraca wszystkiego)", async () => {
        const nowaRegula = await ids(await filtrMoichRekordow(pusty.id));
        assert.deepEqual(nowaRegula, [], "filtr zwracający cudze rekordy zaświeci właśnie tutaj");
      });

      await t.test("brak przecieku: cudze rekordy nie wchodzą do mojego zbioru", async () => {
        const wMoim = new Set(await ids(await filtrMoichRekordow(ja.id)));
        assert.equal(cudzeId.length, 2);
        for (const id of cudzeId) {
          assert.equal(wMoim.has(id), false, "rekord obcego konta nie może trafić do mojego zbioru");
        }
      });

      await t.test("filtr jest WĘŻSZY niż zakres przestrzeni: zespół nie wchodzi", async () => {
        // Rekord w przestrzeni ZESPOŁU na tabeli, która współwłasności zespołowej nie zna.
        //
        // Tego stanu nie da się zbudować jednym `INSERT`-em i to nie przeoczenie, a skutek migracji
        // 0240: wyzwalacz odrzuca zapis, w którym podana przestrzeń przeczy kolumnom własnościowym —
        // także zapis surowym SQL-em, bo wyzwalacza nie omija nic (to był cały powód, dla którego
        // sprawdzenie stoi w bazie, a nie w kliencie Prismy). Budujemy więc rekord poprawnie
        // i PRZENOSIMY go osobnym `UPDATE`: wyzwalacz jest `BEFORE INSERT`, a przenoszenie zasobu
        // między przestrzeniami to świadomie osobna sprawa (etap 3 zadania 11).
        const wstawiony = await prisma.weatherLocation.create({
          data: { label: `zespolowa-${rnd()}`, lat: 52, lon: 21, ...(await wlasnoscOsobistaDoZapisu(ja.id)) },
        });
        const id = wstawiony.id;
        await prisma.weatherLocation.update({ where: { id }, data: { workspaceId: zespolowa.id } });

        const nowaRegula = new Set(await ids(await filtrMoichRekordow(ja.id)));
        assert.equal(
          nowaRegula.has(id),
          false,
          "filtr moich rekordów celowo obejmuje TYLKO przestrzeń osobistą — zamiana na ownedWhereAsync zaświeci tutaj"
        );

        const { ownedWhereAsync } = await import("@/platform/auth/serverUtils");
        const szerszy = new Set(await ids(await ownedWhereAsync(ja.id)));
        assert.equal(szerszy.has(id), true, "szerszy zakres ten sam wiersz WIDZI — czyli przypadek naprawdę różnicuje");
      });
    } finally {
      await prisma.weatherLocation.deleteMany({
        where: {
          workspaceId: {
            in: (
              await prisma.workspace.findMany({
                where: { personalUserId: { in: [ja.id, obcy.id, pusty.id] } },
                select: { id: true },
              })
            ).map((w) => w.id),
          },
        },
      });
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: [ja.id, obcy.id, pusty.id] } } });
      await prisma.workspace.deleteMany({
        where: { OR: [{ personalUserId: { in: [ja.id, obcy.id, pusty.id] } }, { teamId: zespol.id }] },
      });
      await prisma.team.deleteMany({ where: { id: zespol.id } });
      await prisma.user.deleteMany({ where: { id: { in: [ja.id, obcy.id, pusty.id] } } });
    }
  }
);
