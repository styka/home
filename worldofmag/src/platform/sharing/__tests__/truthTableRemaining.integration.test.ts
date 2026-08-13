import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 064 — TABELE PRAWDY DLA POZOSTAŁYCH GUARDÓW PER-REKORD (zadanie 13).
 *
 * Jeden plik na trzy zasoby, bo wszystkie trzy przenosimy w jednym przebiegu i wszystkie trzy
 * mają ten sam kształt dowodu. Punkt odniesienia powstaje **przed** przełączeniem (C-17).
 *
 * **Przypadek, dla którego warto było to napisać:** przepis **publiczny**. `assertRecipeAccess`
 * ma trzeci wariant, którego nie ma żaden inny guard w aplikacji — `isPublic` daje dostęp
 * **tylko do odczytu**, i to obcemu. Odwzorowanie, które o tym zapomni, zabierze funkcję
 * (publiczne przepisy przestaną być publiczne), a odwzorowanie, które da `isPublic` rolę zbyt
 * wysoką, pozwoli obcemu edytować cudzy przepis.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);
const BASELINE = path.join(process.cwd(), "..", "specs/064-zadanie-13-domkniecie/baseline-dostep.json");

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
  "tabele prawdy: lista zakupów, przepis, książka kucharska",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { assertListAccess } = await import("@/modules/shopping/actions/lists");
    const { assertRecipeAccess } = await import("@/modules/kitchen/actions/recipes");
    const { assertCookbookAccess } = await import("@/modules/kitchen/actions/cookbooks");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );

    const wlasciciel = await prisma.user.create({ data: { email: `t13-o-${rnd()}@test.local` } });
    const czlonek = await prisma.user.create({ data: { email: `t13-c-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `t13-x-${rnd()}@test.local` } });

    const zespol = await prisma.team.create({
      data: {
        name: `T13-${rnd()}`,
        ownerId: wlasciciel.id,
        members: { create: [{ userId: czlonek.id, role: "MEMBER" }] },
      },
    });
    for (const u of [wlasciciel, czlonek, obcy]) await ensurePersonalWorkspace(u.id);
    await syncTeamWorkspace(zespol.id);

    const lista = await prisma.shoppingList.create({
      data: { name: `L-${rnd()}`, ownerId: wlasciciel.id },
    });
    const listaZespolu = await prisma.shoppingList.create({
      data: { name: `LZ-${rnd()}`, ownerTeamId: zespol.id },
    });
    const przepis = await prisma.recipe.create({
      data: { title: `R-${rnd()}`, slug: `r-${rnd()}`, ownerId: wlasciciel.id },
    });
    const przepisPubliczny = await prisma.recipe.create({
      data: { title: `RP-${rnd()}`, slug: `rp-${rnd()}`, ownerId: wlasciciel.id, isPublic: true },
    });
    const ksiazka = await prisma.cookbook.create({
      data: { name: `K-${rnd()}`, ownerTeamId: zespol.id },
    });

    const osoby: Record<string, string> = {
      wlasciciel: wlasciciel.id,
      "czlonek zespolu": czlonek.id,
      obcy: obcy.id,
    };

    const operacje: Record<string, (u: string) => Promise<unknown>> = {
      "lista wlasna": (u) => assertListAccess(lista.id, u),
      "lista zespolu": (u) => assertListAccess(listaZespolu.id, u),
      "przepis: odczyt": (u) => assertRecipeAccess(przepis.id, u, "read"),
      "przepis: edycja": (u) => assertRecipeAccess(przepis.id, u, "edit"),
      "przepis PUBLICZNY: odczyt": (u) => assertRecipeAccess(przepisPubliczny.id, u, "read"),
      "przepis PUBLICZNY: edycja": (u) => assertRecipeAccess(przepisPubliczny.id, u, "edit"),
      "ksiazka zespolu": (u) => assertCookbookAccess(ksiazka.id, u),
    };

    try {
      const macierz: Record<string, Record<string, Decyzja>> = {};
      for (const [kto, id] of Object.entries(osoby)) {
        macierz[kto] = {};
        for (const [co, f] of Object.entries(operacje)) macierz[kto][co] = await decyzja(() => f(id));
      }

      await t.test("macierz zgadza się z punktem odniesienia", () => {
        if (!fs.existsSync(BASELINE)) {
          fs.writeFileSync(BASELINE, JSON.stringify(macierz, null, 2) + "\n");
          console.log("  ℹ zapisano punkt odniesienia — stan PRZED przełączeniem");
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

      await t.test("przepis publiczny: obcy CZYTA, ale NIE edytuje", () => {
        // Jedyny w aplikacji przypadek dostępu bez żadnej relacji do zasobu. Odwzorowanie, które
        // o nim zapomni, zabierze funkcję; takie, które da mu za wysoką rolę — pozwoli obcemu
        // edytować cudzy przepis.
        assert.equal(macierz["obcy"]["przepis PUBLICZNY: odczyt"], "dozwolone");
        assert.equal(macierz["obcy"]["przepis PUBLICZNY: edycja"], "odmowa");
        assert.equal(macierz["obcy"]["przepis: odczyt"], "odmowa", "niepubliczny pozostaje zamknięty");
      });

      await t.test("członek zespołu ma dostęp do zasobów zespołu", () => {
        assert.equal(macierz["czlonek zespolu"]["lista zespolu"], "dozwolone");
        assert.equal(macierz["czlonek zespolu"]["ksiazka zespolu"], "dozwolone");
      });

      await t.test("obcy nie ma dostępu do niczego prywatnego", () => {
        for (const co of ["lista wlasna", "lista zespolu", "przepis: edycja", "ksiazka zespolu"]) {
          assert.equal(macierz["obcy"][co], "odmowa", co);
        }
      });
    } finally {
      await prisma.cookbook.deleteMany({ where: { id: ksiazka.id } });
      await prisma.recipe.deleteMany({ where: { id: { in: [przepis.id, przepisPubliczny.id] } } });
      await prisma.shoppingList.deleteMany({ where: { id: { in: [lista.id, listaZespolu.id] } } });
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      for (const u of [wlasciciel, czlonek, obcy]) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
  },
);
