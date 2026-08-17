import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 079 (zadanie 11, etap 4 część 3) — TABELA PRAWDY DLA SIATKI, KTÓRĄ USUWA `DROP COLUMN`.
 *
 * Etap 4 zabiera deklaracjom zasobów kolumny `ownerId`/`ownerTeamId`, więc `rolaZWlasnosci`
 * przestaje dostawać fakt „ten rekord należy osobiście do X". Do tej pory ten fakt był **siatką**
 * (075/077): gdy przestrzeni zasobu nie było w kontekście dostępu użytkownika, właściciel i tak
 * dostawał `manager`. Kontekst liczy przestrzenie z tabeli `WorkspaceMember`, więc brak jednego
 * wiersza członkostwa — rozjazd lustra rozpoznany w 056 — oznaczał **konto tracące dostęp do
 * własnych danych**. Dokładnie tej sytuacji ta siatka broniła.
 *
 * Trzy istniejące tabele prawdy (`truthTable`, `truthTableRemaining`, `truthTablePets`) tego
 * wiersza nie mają: ich fixture'y zawsze wołają `ensurePersonalWorkspace`, który przy okazji
 * naprawia członkostwo. Świeciłyby więc na zielono także wtedy, gdyby siatka zniknęła bez
 * zastępstwa — bo mierzą stan, w którym nie jest potrzebna.
 *
 * **Punkt odniesienia powstaje PRZED zmianą** (C-17) i jest niezależnym plikiem, a nie wynikiem
 * tej samej arytmetyki: macierz liczą DZISIEJSZE guardy modułów na prawdziwej bazie.
 *
 * Dwa wiersze i jeden z nich musi zostać **odmową** — inaczej dowód byłby jednostronny:
 * naprawa, która „na wszelki wypadek" przyznaje dostęp szerzej, przeszłaby niezauważona.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);
const BASELINE = path.join(
  process.cwd(),
  "..",
  "specs/079-etap-4-3-usuniecie-kolumn/baseline-lustro-zepsute.json",
);

type Decyzja = "dozwolone" | "odmowa";

async function decyzja(fn: () => Promise<unknown>): Promise<Decyzja> {
  try {
    await fn();
    return "dozwolone";
  } catch {
    return "odmowa";
  }
}

test(
  "dostęp właściciela przy zepsutym lustrze przestrzeni",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { assertProjectAccess } = await import("@/modules/tasks/actions/taskProjects");
    const { assertListAccess } = await import("@/modules/shopping/actions/lists");
    const { assertRecipeAccess } = await import("@/modules/kitchen/actions/recipes");
    const { assertCookbookAccess } = await import("@/modules/kitchen/actions/cookbooks");
    const { assertPetAccess } = await import("@/modules/pets/actions/pets");
    const { accessibleProjectIds } = await import("@/modules/tasks/lib/sharingGuard");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );

    const wlasciciel = await prisma.user.create({ data: { email: `bl-w-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `bl-x-${rnd()}@test.local` } });
    for (const u of [wlasciciel, obcy]) await ensurePersonalWorkspace(u.id);

    // Zespół, w którym właściciel NIE MA wiersza `TeamMember` — `Team.ownerId` jest niezależny
    // od tabeli członkostw (uwaga z `syncTeamWorkspace`). Lustro robi go właścicielem przestrzeni,
    // więc jego dostęp do zasobu zespołowego idzie WYŁĄCZNIE przez przestrzeń.
    const zespol = await prisma.team.create({ data: { name: `BL-${rnd()}`, ownerId: wlasciciel.id } });
    await syncTeamWorkspace(zespol.id);

    // Zasoby powstają, DOPÓKI lustro jest sprawne — wyzwalacz wyprowadza przestrzeń z właściciela.
    const projekt = await prisma.taskProject.create({
      data: { name: `P-${rnd()}`, ownerId: wlasciciel.id },
    });
    const lista = await prisma.shoppingList.create({
      data: { name: `L-${rnd()}`, ownerId: wlasciciel.id },
    });
    const przepis = await prisma.recipe.create({
      data: { title: `R-${rnd()}`, slug: `r-${rnd()}`, ownerId: wlasciciel.id },
    });
    const ksiazka = await prisma.cookbook.create({
      data: { name: `K-${rnd()}`, ownerId: wlasciciel.id },
    });
    const zwierze = await prisma.pet.create({
      data: { name: `Z-${rnd()}`, species: "gekon", ownerId: wlasciciel.id },
    });
    const listaZespolu = await prisma.shoppingList.create({
      data: { name: `LZ-${rnd()}`, ownerTeamId: zespol.id },
    });

    /**
     * ROZJAZD LUSTRA: kasujemy wiersze członkostwa właściciela. Przestrzenie zostają, zasoby
     * zostają, znika tylko dowód, że ta osoba do nich należy — czyli dokładnie to, co widzi
     * `getAccessContext`.
     */
    await prisma.workspaceMember.deleteMany({ where: { userId: wlasciciel.id } });

    const osoby: Record<string, string> = {
      "wlasciciel bez czlonkostwa w swojej przestrzeni": wlasciciel.id,
      obcy: obcy.id,
    };

    const operacje: Record<string, (u: string) => Promise<unknown>> = {
      "projekt wlasny": (u) => assertProjectAccess(projekt.id, u),
      "projekt wlasny: zarzadzanie": (u) => assertProjectAccess(projekt.id, u, "ADMIN"),
      "lista wlasna": (u) => assertListAccess(lista.id, u),
      "przepis wlasny": (u) => assertRecipeAccess(przepis.id, u, "edit"),
      "ksiazka wlasna": (u) => assertCookbookAccess(ksiazka.id, u),
      "zwierze wlasne": (u) => assertPetAccess(zwierze.id, u, true),
      // Wiersz, który MUSI zostać odmową. Właściciel zespołu bez wiersza `WorkspaceMember` nie ma
      // dziś dostępu do zasobu zespołowego: `ownerId` jest tam pusty, więc siatka go nie łapie,
      // a przestrzeni zespołu nie ma w jego kontekście. Naprawa siatki nie ma prawa tego zmienić —
      // to byłoby poszerzenie dostępu ukryte w usuwaniu kolumn.
      "lista zespolu (wlasciciel zespolu bez czlonkostwa)": (u) => assertListAccess(listaZespolu.id, u),
    };

    try {
      const macierz: Record<string, Record<string, Decyzja>> = {};
      for (const [kto, id] of Object.entries(osoby)) {
        macierz[kto] = {};
        for (const [co, f] of Object.entries(operacje)) macierz[kto][co] = await decyzja(() => f(id));
      }

      await t.test("macierz zgadza się z punktem odniesienia", () => {
        if (!fs.existsSync(BASELINE)) {
          fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
          fs.writeFileSync(BASELINE, JSON.stringify(macierz, null, 2) + "\n");
          console.log("  ℹ zapisano punkt odniesienia — stan PRZED usunięciem kolumn");
          return;
        }
        const wzorzec = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
        for (const kto of Object.keys(macierz)) {
          for (const co of Object.keys(macierz[kto])) {
            if (macierz[kto][co] !== wzorzec[kto]?.[co]) {
              console.log(`  RÓŻNICA: ${kto} × ${co}: ${wzorzec[kto]?.[co]} → ${macierz[kto][co]}`);
            }
          }
        }
        assert.deepEqual(macierz, wzorzec, "decyzje różnią się od punktu odniesienia — ZATRZYMANIE");
      });

      await t.test("właściciel nie traci własnych zasobów przez brak wiersza członkostwa", () => {
        for (const co of [
          "projekt wlasny",
          "projekt wlasny: zarzadzanie",
          "lista wlasna",
          "przepis wlasny",
          "ksiazka wlasna",
          "zwierze wlasne",
        ]) {
          assert.equal(
            macierz["wlasciciel bez czlonkostwa w swojej przestrzeni"][co],
            "dozwolone",
            `${co}: rozjazd lustra nie może odbierać dostępu do własnych danych`,
          );
        }
      });

      await t.test("siatka nie poszerza dostępu: obcy nadal nic nie może", () => {
        for (const co of Object.keys(operacje)) {
          assert.equal(macierz["obcy"][co], "odmowa", co);
        }
      });

      await t.test("właściciel zespołu bez członkostwa NADAL nie ma dostępu zespołowego", () => {
        assert.equal(
          macierz["wlasciciel bez czlonkostwa w swojej przestrzeni"][
            "lista zespolu (wlasciciel zespolu bez czlonkostwa)"
          ],
          "odmowa",
        );
      });

      await t.test("lista projektów pokazuje to samo, co przepuszcza guard", async () => {
        // Dostęp i lista mają być tym SAMYM zbiorem (zasada z 056). Gdyby siatkę naprawiono tylko
        // w `rolaZWlasnosci`, guard przepuszczałby projekt, którego lista nie pokazuje.
        const widoczne = await accessibleProjectIds(wlasciciel.id);
        assert.ok(widoczne.includes(projekt.id), "właściciel musi widzieć swój projekt na liście");
        const obceWidoczne = await accessibleProjectIds(obcy.id);
        assert.equal(obceWidoczne.includes(projekt.id), false);
      });
    } finally {
      await prisma.pet.deleteMany({ where: { id: zwierze.id } });
      await prisma.cookbook.deleteMany({ where: { id: ksiazka.id } });
      await prisma.recipe.deleteMany({ where: { id: przepis.id } });
      await prisma.shoppingList.deleteMany({ where: { id: { in: [lista.id, listaZespolu.id] } } });
      await prisma.taskProject.deleteMany({ where: { id: projekt.id } });
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      for (const u of [wlasciciel, obcy]) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
  },
);
