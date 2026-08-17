import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 079 (zadanie 11, etap 4 część 3, krok 2) — CO DOKŁADNIE ZNIKA PRZY USUNIĘCIU KONTA.
 *
 * RODO jest dziś kluczowane po `ownerId` — i to na DWA niezależne sposoby, które łatwo pomylić:
 *  1. **jawne `deleteMany`** w `lib/privacy/purge.ts` (jedenaście tabel),
 *  2. **kaskada klucza obcego** `owner User? @relation(onDelete: Cascade)` — wszystko pozostałe.
 *
 * Etap 4 zabiera obie naraz, bo usuwa kolumnę, na której stoją. Punkt (1) widzi kompilator.
 * **Punktu (2) nie widzi nikt**: `workspaceId` nie ma klucza obcego, więc po `DROP COLUMN` rekord
 * po prostu przestaje mieć jakikolwiek związek z kontem — usunięcie użytkownika zostawiłoby
 * jego portfel, flotę, magazyn i pogodę w bazie, a operacja zgłosiłaby sukces. Dlatego ta tabela
 * prawdy obejmuje przede wszystkim tabele, których `purge.ts` **nie wymienia**.
 *
 * **Punkt odniesienia jest niezależny od kodu**: to nie jest przeliczenie tą samą regułą, tylko
 * wypisany ręcznie zbiór rekordów fixture'u z etykietami, plus zamrożony plik z werdyktem
 * „został / usunięty" policzonym PRZED zmianą.
 *
 * **Czego ten test NIE potrafi dziś rozróżnić — i dlaczego to nie jest wada.** Dopóki klucz obcy
 * `owner → User (Cascade)` stoi, usunięcie jawnego `deleteMany` niczego nie zmienia: rekord i tak
 * znika kaskadą. Sprawdzone sondą — wyłączenie kasowania notatek NIE czerwieni testu, wyłączenie
 * kasowania kontaktów (jedyna tabela BEZ klucza obcego) czerwieni natychmiast. Ta asymetria jest
 * miarą tego, ile pracy wykonuje dziś baza, a nie kod — i dokładnie ona jest zagrożona przez
 * `DROP COLUMN`. Test staje się rozróżniający w chwili, gdy kolumny znikną: wtedy każda z tych
 * komórek zależy już wyłącznie od tego, czy własność została przepięta poprawnie.
 *
 * Trzy klasy rekordów w każdej tabeli, żeby dowód był dwustronny:
 *  - `A-osobisty` — MUSI zniknąć (to jest sedno RODO),
 *  - `B-osobisty` — MUSI zostać (izolacja kont),
 *  - `zespolowy` — MUSI zostać: zespół przechodzi na następcę razem z zawartością.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);
const BASELINE = path.join(
  process.cwd(),
  "..",
  "specs/079-etap-4-3-usuniecie-kolumn/baseline-zakres-rodo.json",
);

test(
  "usunięcie konta: zakres skasowanych rekordów zgadza się z punktem odniesienia",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { purgeUserData } = await import("@/lib/privacy/purge");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );

    const A = await prisma.user.create({ data: { email: `pz-a-${rnd()}@test.local` } });
    const B = await prisma.user.create({ data: { email: `pz-b-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(A.id);
    await ensurePersonalWorkspace(B.id);

    // Zespół z DRUGIM członkiem — dzięki temu `purgeUserData` przekaże własność, a nie usunie
    // zespołu. Wariant „solo" kasuje zespół kaskadą i nie odróżniłby przekazania od utraty.
    const zespol = await prisma.team.create({
      data: { name: `PZ-${rnd()}`, ownerId: A.id, members: { create: [{ userId: B.id, role: "MEMBER" }] } },
    });
    await syncTeamWorkspace(zespol.id);

    /**
     * Tabele objęte pomiarem. Świadomie z przewagą tych, których `purge.ts` **nie wymienia** —
     * u nich całą robotę wykonuje dziś kaskada klucza obcego i to ona jest zagrożona.
     * `zespol: false` = tabela nie ma współwłasności zespołowej.
     */
    const tabele: {
      nazwa: keyof typeof prisma & string;
      zespol: boolean;
      dane: (i: number) => Record<string, unknown>;
    }[] = [
      { nazwa: "taskProject", zespol: true, dane: (i) => ({ name: `P${i}-${rnd()}` }) },
      { nazwa: "note", zespol: true, dane: (i) => ({ title: `N${i}-${rnd()}` }) },
      { nazwa: "shoppingList", zespol: true, dane: (i) => ({ name: `L${i}-${rnd()}` }) },
      { nazwa: "recipe", zespol: true, dane: (i) => ({ title: `R${i}`, slug: `r${i}-${rnd()}` }) },
      { nazwa: "cookbook", zespol: true, dane: (i) => ({ name: `K${i}-${rnd()}` }) },
      { nazwa: "habit", zespol: true, dane: (i) => ({ name: `H${i}-${rnd()}` }) },
      { nazwa: "healthEvent", zespol: true, dane: (i) => ({ title: `Z${i}`, scheduledAt: new Date() }) },
      { nazwa: "medicationSchedule", zespol: true, dane: (i) => ({ name: `M${i}-${rnd()}` }) },
      { nazwa: "languageDeck", zespol: true, dane: (i) => ({ name: `D${i}`, nativeLang: "pl", targetLang: "en" }) },
      // Poniżej: tabele, których `purge.ts` NIE wymienia — dziś czyści je wyłącznie kaskada.
      { nazwa: "walletElement", zespol: true, dane: (i) => ({ name: `W${i}-${rnd()}` }) },
      { nazwa: "budget", zespol: true, dane: (i) => ({ category: `C${i}`, limitAmount: 100 }) },
      { nazwa: "financeGoal", zespol: true, dane: (i) => ({ name: `G${i}`, targetAmount: 1000 }) },
      { nazwa: "vehicle", zespol: true, dane: (i) => ({ name: `V${i}-${rnd()}` }) },
      { nazwa: "storageItem", zespol: true, dane: (i) => ({ name: `S${i}-${rnd()}` }) },
      { nazwa: "workshop", zespol: true, dane: (i) => ({ name: `WS${i}-${rnd()}` }) },
      { nazwa: "pantryItem", zespol: true, dane: (i) => ({ name: `PI${i}-${rnd()}` }) },
      { nazwa: "pet", zespol: true, dane: (i) => ({ name: `Pet${i}`, species: "gekon" }) },
      { nazwa: "mealPlanEntry", zespol: true, dane: () => ({ date: new Date(), slot: "DINNER" }) },
      // Kontakt: kolumna właściciela BEZ klucza obcego (Z-370) — kasuje go wyłącznie jawny wpis.
      { nazwa: "contact", zespol: true, dane: (i) => ({ name: `Kontakt ${i} ${rnd()}` }) },
      // Bez współwłasności zespołowej (`ownerId` NOT NULL).
      { nazwa: "projectGroup", zespol: false, dane: (i) => ({ name: `PG${i}-${rnd()}` }) },
      { nazwa: "weatherLocation", zespol: false, dane: (i) => ({ label: `Loc${i}`, lat: 52.2, lon: 21.0 }) },
      { nazwa: "userFact", zespol: false, dane: (i) => ({ category: "pref", text: `f${i}`, fingerprint: `fp-${rnd()}` }) },
      { nazwa: "newsTopic", zespol: false, dane: (i) => ({ title: `T${i}`, semanticFilter: `q${i}` }) },
    ];

    type Delegat = { create: (a: unknown) => Promise<{ id: string }>; count: (a: unknown) => Promise<number> };
    const delegat = (n: string) => (prisma as unknown as Record<string, Delegat>)[n];

    /** etykieta rekordu → jego id, per tabela. */
    const utworzone: Record<string, Record<string, string>> = {};

    for (const tab of tabele) {
      const d = delegat(tab.nazwa);
      utworzone[tab.nazwa] = {};
      utworzone[tab.nazwa]["A-osobisty"] = (await d.create({ data: { ...tab.dane(1), ownerId: A.id } })).id;
      utworzone[tab.nazwa]["B-osobisty"] = (await d.create({ data: { ...tab.dane(2), ownerId: B.id } })).id;
      if (tab.zespol) {
        utworzone[tab.nazwa]["zespolowy"] = (await d.create({ data: { ...tab.dane(3), ownerTeamId: zespol.id } })).id;
      }
    }

    try {
      await purgeUserData(A.id);

      const macierz: Record<string, Record<string, "zostal" | "usuniety">> = {};
      for (const tab of tabele) {
        const d = delegat(tab.nazwa);
        macierz[tab.nazwa] = {};
        for (const [etykieta, id] of Object.entries(utworzone[tab.nazwa])) {
          macierz[tab.nazwa][etykieta] =
            (await d.count({ where: { id } })) > 0 ? "zostal" : "usuniety";
        }
      }

      await t.test("werdykt per rekord zgadza się z punktem odniesienia", () => {
        if (!fs.existsSync(BASELINE)) {
          fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
          fs.writeFileSync(BASELINE, JSON.stringify(macierz, null, 2) + "\n");
          console.log("  ℹ zapisano punkt odniesienia — stan PRZED przepięciem RODO");
          return;
        }
        const wzorzec = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
        for (const tabela of Object.keys(macierz)) {
          for (const etykieta of Object.keys(macierz[tabela])) {
            if (macierz[tabela][etykieta] !== wzorzec[tabela]?.[etykieta]) {
              console.log(
                `  RÓŻNICA: ${tabela} × ${etykieta}: ${wzorzec[tabela]?.[etykieta]} → ${macierz[tabela][etykieta]}`,
              );
            }
          }
        }
        assert.deepEqual(macierz, wzorzec, "zakres usuwania danych osobowych się zmienił — ZATRZYMANIE");
      });

      // Punkt odniesienia pilnuje ZGODNOŚCI, ale sam w sobie nie mówi, czy stan jest POPRAWNY.
      // Te trzy asercje wypisują oczekiwanie wprost, żeby zamrożony plik nie mógł kiedyś
      // uwiecznić regresji jako „tak było".
      await t.test("każdy osobisty rekord konta A zniknął", () => {
        for (const tab of tabele) {
          assert.equal(macierz[tab.nazwa]["A-osobisty"], "usuniety", `${tab.nazwa}: dane osobowe zostały w bazie`);
        }
      });

      await t.test("konto B nietknięte", () => {
        for (const tab of tabele) {
          assert.equal(macierz[tab.nazwa]["B-osobisty"], "zostal", `${tab.nazwa}: usunięto cudze dane`);
        }
      });

      await t.test("zawartość zespołu przechodzi na następcę, nie znika", () => {
        for (const tab of tabele.filter((x) => x.zespol)) {
          assert.equal(macierz[tab.nazwa]["zespolowy"], "zostal", `${tab.nazwa}: zespół stracił zawartość`);
        }
        // Sam zespół też ma zostać — z nowym właścicielem.
        return prisma.team.findUnique({ where: { id: zespol.id }, select: { ownerId: true } }).then((z) => {
          assert.equal(z?.ownerId, B.id, "własność zespołu nie przeszła na następcę");
        });
      });
    } finally {
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      for (const u of [A, B]) await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
  },
);
