import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 113 — TABELA PRAWDY DOSTĘPU DO ROŚLIN (AC-28, C-17).
 *
 * **Po co ta tabela w module, który powstaje od zera.** W Zwierzętach (060) chodziło o to, żeby
 * przełączenie guardu na platformę niczego nie zmieniło. Tu punktu odniesienia „sprzed" nie ma —
 * jest za to coś, czego kompilator nie sprawdzi ani razu: **dziedziczenie**. Roślina nie ma
 * własnego wiersza nadania; jej dostęp wynika z dostępu do PRZESTRZENI, przez pole `parent`
 * w deklaracji zasobu. Jedna literówka w typie rodzica (`rosliny.spaces` zamiast `rosliny.space`)
 * daje kod, który się kompiluje, buduje i **odmawia dostępu właścicielowi jego własnej rośliny**.
 *
 * **Czwarty podmiot — osoba z nadaniem — dołączył po drugiej recenzji i to nie jest kosmetyka.**
 * Tabela z trzema relacjami (właściciel / zespół / obcy) nie zawierała przypadku `ResourceGrant`
 * ani razu, więc przepuściła stan, w którym guard mówił „wolno", a listy pytały o WŁASNOŚĆ —
 * obdarowany wchodził do pustego widoku. Dlatego ten test sprawdza teraz dwie rzeczy, nie jedną:
 * decyzję guardu **i zakres list**.
 *
 * Macierz liczy więc (relacja × operacja) dla przestrzeni **i** rośliny w tej przestrzeni, i pilnuje
 * trzech rzeczy naraz: że właściciel może wszystko, że obcy nie może nic, i że **każda decyzja
 * o roślinie jest identyczna z decyzją o jej przestrzeni** — bo to jest dokładnie treść
 * dziedziczenia.
 *
 * Zapisany punkt odniesienia broni tego przed cichą zmianą w przyszłości: różnica w którejkolwiek
 * komórce jest ZATRZYMANIEM, a nie plikiem do nadpisania.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);
const BASELINE = path.join(process.cwd(), "..", "specs/113-modul-roslin/baseline-dostep.json");

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
  "tabela prawdy dostępu do roślin: dziedziczenie po przestrzeni działa w każdej komórce",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { assertSpaceAccess } = await import("../actions/przestrzenie");
    const { assertPlantAccess } = await import("../actions/rosliny");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import("@/platform/workspaces/sync");

    const wlasciciel = await prisma.user.create({ data: { email: `tr-o-${rnd()}@test.local` } });
    const wZespole = await prisma.user.create({ data: { email: `tr-z-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `tr-x-${rnd()}@test.local` } });
    // Czwarty podmiot: osoba, której właściciel UDOSTĘPNIŁ przestrzeń. To jest przypadek, którego
    // brak w tej tabeli przepuścił U-3 — guard mówił „wolno", a listy pytały o własność, więc
    // obdarowany wchodził do PUSTEGO widoku. Pusty widok wygląda jak awaria danych, nie jak brak
    // dostępu, więc jest gorszy od jawnej odmowy.
    const obdarowany = await prisma.user.create({ data: { email: `tr-n-${rnd()}@test.local` } });

    const zespol = await prisma.team.create({
      data: {
        name: `TRZ-${rnd()}`,
        ownerId: wlasciciel.id,
        members: { create: [{ userId: wZespole.id, role: "MEMBER" }] },
      },
    });

    for (const u of [wlasciciel, wZespole, obcy, obdarowany]) await ensurePersonalWorkspace(u.id);
    await syncTeamWorkspace(zespol.id);

    const przestrzenMoja = await prisma.plantSpace.create({
      data: { name: `PM-${rnd()}`, kind: "home", ...(await wlasnoscDoZapisu(wlasciciel.id)) },
    });
    const przestrzenZespolowa = await prisma.plantSpace.create({
      data: { name: `PZ-${rnd()}`, kind: "garden", ...(await wlasnoscDoZapisu(wlasciciel.id, zespol.id)) },
    });

    const roslinaMoja = await prisma.plant.create({
      data: {
        name: `RM-${rnd()}`,
        spaceId: przestrzenMoja.id,
        ...(await wlasnoscDoZapisu(wlasciciel.id)),
      },
    });
    const roslinaZespolowa = await prisma.plant.create({
      data: {
        name: `RZ-${rnd()}`,
        spaceId: przestrzenZespolowa.id,
        ...(await wlasnoscDoZapisu(wlasciciel.id, zespol.id)),
      },
    });

    // Nadanie na PRZESTRZEŃ prywatną właściciela, rola `editor`. Roślina nadania nie ma — i o to
    // chodzi: jej dostęp ma wyniknąć z `parent` w deklaracji zasobu.
    const przestrzenWorkspace = await prisma.plantSpace.findUnique({
      where: { id: przestrzenMoja.id },
      select: { workspaceId: true },
    });
    await prisma.resourceGrant.create({
      data: {
        workspaceId: przestrzenWorkspace!.workspaceId,
        resourceType: "rosliny.space",
        resourceId: przestrzenMoja.id,
        subjectType: "user",
        subjectId: obdarowany.id,
        role: "editor",
        createdById: wlasciciel.id,
      },
    });

    const osoby: Record<string, string> = {
      wlasciciel: wlasciciel.id,
      "czlonek zespolu wlasciciela": wZespole.id,
      "osoba z nadaniem na przestrzen wlasna": obdarowany.id,
      obcy: obcy.id,
    };

    const operacje: Record<string, (u: string) => Promise<unknown>> = {
      "przestrzen wlasna: odczyt": (u) => assertSpaceAccess(przestrzenMoja.id, u),
      "przestrzen wlasna: edycja": (u) => assertSpaceAccess(przestrzenMoja.id, u, true),
      "roslina wlasna: odczyt": (u) => assertPlantAccess(roslinaMoja.id, u),
      "roslina wlasna: edycja": (u) => assertPlantAccess(roslinaMoja.id, u, true),
      "przestrzen zespolowa: odczyt": (u) => assertSpaceAccess(przestrzenZespolowa.id, u),
      "przestrzen zespolowa: edycja": (u) => assertSpaceAccess(przestrzenZespolowa.id, u, true),
      "roslina zespolowa: odczyt": (u) => assertPlantAccess(roslinaZespolowa.id, u),
      "roslina zespolowa: edycja": (u) => assertPlantAccess(roslinaZespolowa.id, u, true),
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

      await t.test("DZIEDZICZENIE: decyzja o roślinie jest zawsze taka sama jak o jej przestrzeni", () => {
        // To jest sedno tego testu. Deklaracja mówi tylko `parent: rosliny.space`; całą resztę robi
        // platforma. Gdyby typ rodzica był literówką, ta pętla wyłapałaby to natychmiast — a bez niej
        // objawem byłaby odmowa dostępu właścicielowi do jego własnej rośliny, czyli najbardziej
        // myląca z możliwych awarii (lekcja z niewpiętej deklaracji zasobów).
        for (const kto of Object.keys(macierz)) {
          for (const zakres of ["wlasna", "zespolowa"]) {
            for (const op of ["odczyt", "edycja"]) {
              assert.equal(
                macierz[kto][`roslina ${zakres}: ${op}`],
                macierz[kto][`przestrzen ${zakres}: ${op}`],
                `dziedziczenie nie działa: ${kto} × ${zakres}/${op}`,
              );
            }
          }
        }
      });

      await t.test("właściciel może wszystko — także w przestrzeni swojego zespołu", () => {
        for (const v of Object.values(macierz["wlasciciel"])) assert.equal(v, "dozwolone");
      });

      await t.test("członek zespołu ma PEŁNY dostęp do zasobów zespołu, nie tylko odczyt", () => {
        // Ta sama decyzja, co w Zwierzętach (060): `teamOwnership` daje `manager`, bo taki jest stan
        // faktyczny. Odwzorowanie „na logikę" (member → editor) zabrałoby prawa, których nikt nie
        // kazał zabierać, a przy dwóch operacjach różnicy nie byłoby widać.
        assert.equal(macierz["czlonek zespolu wlasciciela"]["przestrzen zespolowa: edycja"], "dozwolone");
        assert.equal(macierz["czlonek zespolu wlasciciela"]["roslina zespolowa: edycja"], "dozwolone");
      });

      await t.test("członek zespołu NIE dostaje przy okazji dostępu do prywatnej przestrzeni właściciela", () => {
        assert.equal(macierz["czlonek zespolu wlasciciela"]["przestrzen wlasna: odczyt"], "odmowa");
        assert.equal(macierz["czlonek zespolu wlasciciela"]["roslina wlasna: odczyt"], "odmowa");
      });

      await t.test("osoba z nadaniem widzi przestrzeń i JEJ ROŚLINY — nadanie dziedziczy się w dół", () => {
        const w = macierz["osoba z nadaniem na przestrzen wlasna"];
        assert.equal(w["przestrzen wlasna: odczyt"], "dozwolone");
        assert.equal(w["roslina wlasna: odczyt"], "dozwolone", "nadanie na przestrzeń nie zeszło na roślinę");
        // Rola `editor` daje też edycję…
        assert.equal(w["przestrzen wlasna: edycja"], "dozwolone");
        // …ale wyłącznie tam, gdzie nadanie sięga: przestrzeń zespołowa właściciela go nie obejmuje.
        assert.equal(w["przestrzen zespolowa: odczyt"], "odmowa");
        assert.equal(w["roslina zespolowa: odczyt"], "odmowa");
      });

      await t.test("ZAKRES LIST: obdarowany ma przestrzeń NA LIŚCIE, a nie tylko przechodzi guard", async () => {
        // To jest druga połowa U-3 i powód, dla którego sam guard nie wystarcza jako dowód.
        // Sprawdzamy dokładnie te dwa zapytania, którymi listy modułu pytają o zakres.
        const { zakresPrzestrzeni, idPrzestrzeniNadanychMi } = await import("../lib/sharingGuard");

        const nadane = await idPrzestrzeniNadanychMi(obdarowany.id);
        assert.ok(nadane.includes(przestrzenMoja.id), "nadana przestrzeń nie wróciła z `idPrzestrzeniNadanychMi`");

        const przestrzenie = await prisma.plantSpace.findMany({
          where: { ...(await zakresPrzestrzeni(obdarowany.id)) },
          select: { id: true },
        });
        assert.ok(
          przestrzenie.some((p) => p.id === przestrzenMoja.id),
          "obdarowany nie widzi nadanej przestrzeni na liście — wchodzi do pustego widoku",
        );

        const rosliny = await prisma.plant.findMany({
          where: { space: { is: await zakresPrzestrzeni(obdarowany.id) } },
          select: { id: true },
        });
        assert.ok(
          rosliny.some((r) => r.id === roslinaMoja.id),
          "obdarowany widzi przestrzeń, ale nie jej rośliny",
        );

        // Obcy przez te same zapytania nie widzi nic — inaczej test dowodziłby, że zakres jest
        // po prostu szeroki.
        const obcePrzestrzenie = await prisma.plantSpace.findMany({
          where: { ...(await zakresPrzestrzeni(obcy.id)) },
          select: { id: true },
        });
        assert.ok(!obcePrzestrzenie.some((p) => p.id === przestrzenMoja.id));
      });

      await t.test("obcy nie może nic", () => {
        for (const v of Object.values(macierz["obcy"])) assert.equal(v, "odmowa");
      });

      await t.test("macierz zgadza się z punktem odniesienia", () => {
        if (!fs.existsSync(BASELINE)) {
          fs.writeFileSync(BASELINE, JSON.stringify(macierz, null, 2) + "\n");
          console.log("  ℹ zapisano punkt odniesienia — kolejne przebiegi porównują się z nim");
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
        assert.deepEqual(
          macierz,
          wzorzec,
          "decyzje o dostępie różnią się od punktu odniesienia — to jest ZATRZYMANIE, nie do nadpisania bez powodu",
        );
      });
    } finally {
      await prisma.resourceGrant.deleteMany({
        where: { resourceType: "rosliny.space", resourceId: przestrzenMoja.id },
      });
      await prisma.plant.deleteMany({ where: { id: { in: [roslinaMoja.id, roslinaZespolowa.id] } } });
      await prisma.plantSpace.deleteMany({ where: { id: { in: [przestrzenMoja.id, przestrzenZespolowa.id] } } });
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      for (const u of [wlasciciel, wZespole, obcy, obdarowany]) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
  },
);
