import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 060 — TABELA PRAWDY DOSTĘPU DO ZWIERZĄT.
 *
 * Ten przebieg przenosi rozstrzyganie dostępu z guardu modułu do platformy. Kompilator nie ma tu
 * nic do powiedzenia: `assertPetAccess` przed i po ma tę samą sygnaturę, a różnić się może każdą
 * pojedynczą odpowiedzią. Dlatego macierz **(relacja × operacja)** jest liczona i porównywana
 * z punktem odniesienia zapisanym **przed** przełączeniem (C-17).
 *
 * **Wiersz, dla którego ta tabela powstała:** „członek zespołu będącego właścicielem". Dzisiejszy
 * guard przy własności zespołowej wraca **bez sprawdzania, czy chodzi o edycję** — czyli członek
 * zespołu ma pełne prawa. Odwzorowanie „na logikę" dałoby mu `editor` albo `viewer` i **zabrałoby
 * uprawnienia**, których nikt nie kazał zabierać. Ten wiersz ma tego pilnować.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);
const BASELINE = path.join(process.cwd(), "..", "specs/060-deklaracja-zasobow-zwierzeta/baseline-dostep.json");

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
  "tabela prawdy dostępu do zwierząt: decyzje identyczne z punktem odniesienia",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { assertPetAccess } = await import("../actions/pets");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );

    const wlasciciel = await prisma.user.create({ data: { email: `tp-o-${rnd()}@test.local` } });
    const wZespole = await prisma.user.create({ data: { email: `tp-z-${rnd()}@test.local` } });
    const widz = await prisma.user.create({ data: { email: `tp-v-${rnd()}@test.local` } });
    const redaktor = await prisma.user.create({ data: { email: `tp-e-${rnd()}@test.local` } });
    const przezZespol = await prisma.user.create({ data: { email: `tp-tz-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `tp-x-${rnd()}@test.local` } });

    const zespolWlasciciel = await prisma.team.create({
      data: {
        name: `TPW-${rnd()}`,
        ownerId: wlasciciel.id,
        members: { create: [{ userId: wZespole.id, role: "MEMBER" }] },
      },
    });
    const zespolZUdostepnieniem = await prisma.team.create({
      data: {
        name: `TPU-${rnd()}`,
        ownerId: wlasciciel.id,
        members: { create: [{ userId: przezZespol.id, role: "MEMBER" }] },
      },
    });

    for (const u of [wlasciciel, wZespole, widz, redaktor, przezZespol, obcy]) {
      await ensurePersonalWorkspace(u.id);
    }
    await syncTeamWorkspace(zespolWlasciciel.id);
    await syncTeamWorkspace(zespolZUdostepnieniem.id);

    const moje = await prisma.pet.create({
      data: { name: `P-${rnd()}`, species: "kot", ownerId: wlasciciel.id },
    });
    const zespolowe = await prisma.pet.create({
      data: { name: `PZ-${rnd()}`, species: "pies", ownerTeamId: zespolWlasciciel.id },
    });
    await prisma.petShare.createMany({
      data: [
        { petId: moje.id, userId: widz.id, role: "VIEWER" },
        { petId: moje.id, userId: redaktor.id, role: "EDITOR" },
        { petId: moje.id, teamId: zespolZUdostepnieniem.id, role: "EDITOR" },
      ],
    });

    const osoby: Record<string, string> = {
      wlasciciel: wlasciciel.id,
      "czlonek zespolu wlasciciela": wZespole.id,
      "udostepnione VIEWER": widz.id,
      "udostepnione EDITOR": redaktor.id,
      "udostepnione zespolowi": przezZespol.id,
      obcy: obcy.id,
    };

    const operacje: Record<string, (u: string) => Promise<unknown>> = {
      "zwierze wlasne: odczyt": (u) => assertPetAccess(moje.id, u),
      "zwierze wlasne: edycja": (u) => assertPetAccess(moje.id, u, true),
      "zwierze zespolowe: odczyt": (u) => assertPetAccess(zespolowe.id, u),
      "zwierze zespolowe: edycja": (u) => assertPetAccess(zespolowe.id, u, true),
    };

    try {
      const macierz: Record<string, Record<string, Decyzja>> = {};
      for (const [kto, id] of Object.entries(osoby)) {
        macierz[kto] = {};
        for (const [co, wykonaj] of Object.entries(operacje)) {
          macierz[kto][co] = await decyzja(() => wykonaj(id));
        }
      }

      await t.test("każda komórka jest jednoznaczna", () => {
        for (const wiersz of Object.values(macierz)) {
          for (const v of Object.values(wiersz)) {
            assert.ok(v === "dozwolone" || v === "odmowa");
          }
        }
      });

      await t.test("macierz zgadza się z punktem odniesienia", () => {
        if (!fs.existsSync(BASELINE)) {
          fs.writeFileSync(BASELINE, JSON.stringify(macierz, null, 2) + "\n");
          console.log("  ℹ zapisano punkt odniesienia — to jest stan PRZED przełączeniem");
          return;
        }
        const wzorzec = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
        for (const kto of Object.keys(macierz)) {
          for (const co of Object.keys(macierz[kto])) {
            if (macierz[kto][co] !== wzorzec[kto]?.[co]) console.log(`  RÓŻNICA: ${kto} × ${co}: ${wzorzec[kto]?.[co]} → ${macierz[kto][co]}`);
          }
        }
        assert.deepEqual(
          macierz,
          wzorzec,
          "decyzje o dostępie różnią się od punktu odniesienia — to jest ZATRZYMANIE, nie do nadpisania bez powodu",
        );
      });

      await t.test("056/060: właściciel zespołu widzi zwierzę swojego zespołu", () => {
        // Świadoma zmiana, nazwana w specu §3a: rozstrzyganie czyta przestrzeń, a lustro z 051
        // wpisuje właściciela zespołu jako `owner` mimo braku wiersza `TeamMember`. Ta sama
        // komórka co w 056, tylko ujawniona w drugim module.
        assert.equal(macierz["wlasciciel"]["zwierze zespolowe: odczyt"], "dozwolone");
        assert.equal(macierz["wlasciciel"]["zwierze zespolowe: edycja"], "dozwolone");
      });

      await t.test("członek zespołu właściciela ma PEŁNY dostęp, nie tylko odczyt", () => {
        // Sedno tego przebiegu: dzisiejszy guard przy własności zespołowej nie sprawdza `needEdit`.
        // Odwzorowanie „na logikę" (member → editor/viewer) zabrałoby uprawnienia.
        assert.equal(macierz["czlonek zespolu wlasciciela"]["zwierze zespolowe: odczyt"], "dozwolone");
        assert.equal(macierz["czlonek zespolu wlasciciela"]["zwierze zespolowe: edycja"], "dozwolone");
      });

      await t.test("VIEWER czyta, ale nie edytuje", () => {
        assert.equal(macierz["udostepnione VIEWER"]["zwierze wlasne: odczyt"], "dozwolone");
        assert.equal(macierz["udostepnione VIEWER"]["zwierze wlasne: edycja"], "odmowa");
      });

      await t.test("EDITOR czyta i edytuje", () => {
        assert.equal(macierz["udostepnione EDITOR"]["zwierze wlasne: odczyt"], "dozwolone");
        assert.equal(macierz["udostepnione EDITOR"]["zwierze wlasne: edycja"], "dozwolone");
      });

      await t.test("obcy nie może nic", () => {
        for (const v of Object.values(macierz["obcy"])) assert.equal(v, "odmowa");
      });
    } finally {
      await prisma.petShare.deleteMany({ where: { petId: { in: [moje.id, zespolowe.id] } } });
      await prisma.pet.deleteMany({ where: { id: { in: [moje.id, zespolowe.id] } } });
      for (const z of [zespolWlasciciel, zespolZUdostepnieniem]) {
        await prisma.team.delete({ where: { id: z.id } }).catch(() => {});
      }
      for (const u of [wlasciciel, wZespole, widz, redaktor, przezZespol, obcy]) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
  },
);
