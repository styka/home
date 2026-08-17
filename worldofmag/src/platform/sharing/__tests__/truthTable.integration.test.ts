import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 052 — TABELA PRAWDY KONTROLI DOSTĘPU.
 *
 * Ten przebieg zmienia **sposób podejmowania decyzji o dostępie do danych**. Kompilator nie ma tu
 * nic do powiedzenia: `assertProjectAccess` przed zmianą i po zmianie ma tę samą sygnaturę i tak
 * samo się typuje, a różnić się może każdą pojedynczą odpowiedzią. Dlatego macierz
 * **(relacja użytkownika do zasobu) × (operacja)** jest liczona DWA razy — starym i nowym
 * mechanizmem — i zestawiana **komórka po komórce**.
 *
 * Plik `specs/052…/baseline-dostep.json` powstaje przy pierwszym uruchomieniu (gdy go nie ma)
 * i od tej pory jest **punktem odniesienia**: test porównuje z nim wynik i psuje się przy
 * jakiejkolwiek różnicy. Skasowanie pliku to świadoma decyzja „przyjmuję nowy stan za wzorzec",
 * nie przypadek.
 *
 * **Wiersz, dla którego ta tabela naprawdę powstała:** „projekt zespołowy, użytkownik należy do
 * zespołu, ale nie ma członkostwa w projekcie". `TaskProject` MA kolumnę `ownerTeamId`, ale ani
 * dzisiejszy guard zapisu, ani ścieżka odczytu asystenta jej nie czytają. Nowy mechanizm mógłby
 * „przy okazji" uznać własność zespołową za dostęp — i byłoby to **poszerzenie uprawnień ukryte
 * w przebudowie uprawnień**. Ten wiersz ma pilnować, żeby się to nie stało po cichu.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

const BASELINE = path.join(process.cwd(), "..", "specs/052-requireaccess-platforma/baseline-dostep.json");

/** Jedna komórka macierzy: czy operacja przeszła. */
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
  "tabela prawdy dostępu: decyzje są identyczne z punktem odniesienia",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { assertProjectAccess } = await import("@/modules/tasks/actions/taskProjects");
    const { assertTaskAccess } = await import("@/modules/tasks/lib/access");
    const { requireAccess } = await import("@/lib/sharing");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );

    // ── Fixture: jeden zespół, pięć osób w różnych relacjach, trzy zasoby ────────────────
    const wlasciciel = await prisma.user.create({ data: { email: `tt-own-${rnd()}@test.local` } });
    const czlonek = await prisma.user.create({ data: { email: `tt-mem-${rnd()}@test.local` } });
    const admin = await prisma.user.create({ data: { email: `tt-adm-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `tt-obc-${rnd()}@test.local` } });
    const zespolowy = await prisma.user.create({ data: { email: `tt-zesp-${rnd()}@test.local` } });

    const zespol = await prisma.team.create({
      data: {
        name: `TT-${rnd()}`,
        ownerId: wlasciciel.id,
        members: { create: [{ userId: zespolowy.id, role: "MEMBER" }] },
      },
    });

    /**
     * 056: PRZESTRZENIE MUSZĄ ISTNIEĆ, ZANIM POWSTANĄ ZASOBY.
     *
     * Bez tego fixture mierzyłby coś innego, niż deklaruje. Użytkownicy tworzeni wprost przez
     * Prismę omijają zdarzenie logowania, więc nie mają przestrzeni osobistych; wyzwalacz z 0228
     * nie miałby czego wpisać, `workspaceId` zostałby pusty i rozstrzyganie poszłoby **gałęzią
     * awaryjną** na `ownerId`. Tabela świeciłaby na zielono, dowodząc, że działa stara reguła —
     * czyli dokładnie nie to, co ten przebieg zmienia.
     */
    await ensurePersonalWorkspace(wlasciciel.id);
    await ensurePersonalWorkspace(czlonek.id);
    await ensurePersonalWorkspace(admin.id);
    await ensurePersonalWorkspace(obcy.id);
    await ensurePersonalWorkspace(zespolowy.id);
    await syncTeamWorkspace(zespol.id);

    const projekt = await prisma.taskProject.create({
      data: {
        name: `Projekt-${rnd()}`,
        ownerId: wlasciciel.id,
        members: {
          create: [
            { userId: czlonek.id, role: "MEMBER" },
            { userId: admin.id, role: "ADMIN" },
          ],
        },
      },
    });
    // Projekt należący do ZESPOŁU, bez ani jednego członkostwa — wiersz z AC-5.
    const projektZespolu = await prisma.taskProject.create({
      data: { name: `Zespolowy-${rnd()}`, ownerTeamId: zespol.id },
    });

    /**
     * 056/AC-4: zasób BEZ PRZESTRZENI. Właściciel istnieje, ale przestrzeni nie ma — tak wyglądają
     * sieroty po backfillu 0227 i tak samo wygląda każdy zasób, którego własność jest wyprowadzona.
     * Kolumna pilnuje, żeby przełączenie na przestrzeń nie odebrało właścicielowi jego zasobu
     * i żeby jednocześnie nie oddało go obcemu.
     */
    const bezPrzestrzeni = await prisma.user.create({
      data: { email: `tt-sier-${rnd()}@test.local` },
    });
    // 075: KOLUMNA „projekt bez przestrzeni (sierota)" ZNIKŁA Z MACIERZY — 5×5 → 5×4.
    // Nie dlatego, że przestała być ważna, tylko dlatego, że stanu, który opisywała, NIE DA SIĘ JUŻ
    // ZBUDOWAĆ: etap 4 zaostrzył `TaskProject.workspaceId` do NOT NULL. Kolumna oparta na
    // `update({ workspaceId: null })` byłaby odtąd testem fikcji, a nie zachowania.
    //
    // Co ZOSTAJE i dlaczego to nie jest to samo: użytkownik `bezPrzestrzeni` (konto bez własnej
    // przestrzeni osobistej) dalej jest jednym z wierszy macierzy — TEN stan wciąż jest osiągalny
    // i wciąż musi być pilnowany. Zniknął zasób bez przestrzeni, nie osoba bez przestrzeni.
    //
    // Sam niezmiennik, który tę kolumnę unieważnił, ma własną asercję w `grantMirror` i
    // `ownershipScopeSwitch` — inaczej jego cofnięcie przeszłoby bez śladu.

    const zadanieWProjekcie = await prisma.task.create({
      data: { title: `Zad-${rnd()}`, projectId: projekt.id, createdById: wlasciciel.id },
    });
    const zadanieLuzem = await prisma.task.create({
      data: { title: `Luz-${rnd()}`, createdById: wlasciciel.id, assigneeId: czlonek.id },
    });

    const osoby: Record<string, string> = {
      "wlasciciel projektu": wlasciciel.id,
      "czlonek MEMBER": czlonek.id,
      "czlonek ADMIN": admin.id,
      obcy: obcy.id,
      "w zespole, bez czlonkostwa": zespolowy.id,
      // 056/AC-4: właściciel zasobu, który nie ma przestrzeni.
      "wlasciciel bez przestrzeni": bezPrzestrzeni.id,
    };

    /** Operacje wyrażone przez DZISIEJSZE guardy — to jest definicja stanu „przed". */
    const operacje: Record<string, (userId: string) => Promise<unknown>> = {
      "projekt: odczyt/edycja zawartosci": (u) => assertProjectAccess(projekt.id, u),
      "projekt: zarzadzanie (ADMIN)": (u) => assertProjectAccess(projekt.id, u, "ADMIN"),
      "projekt zespolowy: odczyt/edycja": (u) => assertProjectAccess(projektZespolu.id, u),
      "zadanie w projekcie": (u) =>
        assertTaskAccess(
          { id: zadanieWProjekcie.id, projectId: zadanieWProjekcie.projectId, createdById: zadanieWProjekcie.createdById, assigneeId: zadanieWProjekcie.assigneeId },
          u,
        ),
      "zadanie bez projektu": (u) =>
        assertTaskAccess(
          { id: zadanieLuzem.id, projectId: zadanieLuzem.projectId, createdById: zadanieLuzem.createdById, assigneeId: zadanieLuzem.assigneeId },
          u,
        ),
    };

    /**
     * Te same operacje wyrażone NOWYM mechanizmem. Odwzorowanie `minRole` dzisiejszego guardu:
     * domyślne `MEMBER` → operacja wymagająca `editor`, `ADMIN` → wymagająca `manager`.
     */
    const operacjeNowe: Record<string, (userId: string) => Promise<unknown>> = {
      "projekt: odczyt/edycja zawartosci": (u) => requireAccess(u, { type: "tasks.project", id: projekt.id }, "task.edit"),
      "projekt: zarzadzanie (ADMIN)": (u) => requireAccess(u, { type: "tasks.project", id: projekt.id }, "project.rename"),
      "projekt zespolowy: odczyt/edycja": (u) => requireAccess(u, { type: "tasks.project", id: projektZespolu.id }, "task.edit"),
      "zadanie w projekcie": (u) => requireAccess(u, { type: "tasks.task", id: zadanieWProjekcie.id }, "task.edit"),
      "zadanie bez projektu": (u) => requireAccess(u, { type: "tasks.task", id: zadanieLuzem.id }, "task.edit"),
    };

    async function zbudujMacierz(
      warianty: Record<string, (userId: string) => Promise<unknown>>,
    ): Promise<Record<string, Record<string, Decyzja>>> {
      const m: Record<string, Record<string, Decyzja>> = {};
      for (const [nazwaOsoby, userId] of Object.entries(osoby)) {
        m[nazwaOsoby] = {};
        for (const [nazwaOperacji, wykonaj] of Object.entries(warianty)) {
          m[nazwaOsoby][nazwaOperacji] = await decyzja(() => wykonaj(userId));
        }
      }
      return m;
    }

    try {
      const macierz = await zbudujMacierz(operacje);

      await t.test("każda komórka jest jednoznaczna", () => {
        const komorki = Object.values(macierz).flatMap((w) => Object.values(w));
        assert.equal(komorki.length, Object.keys(osoby).length * Object.keys(operacje).length);
        assert.ok(
          komorki.every((d) => d === "dozwolone" || d === "odmowa"),
          "macierz zawiera komórkę bez jednoznacznej decyzji",
        );
      });

      await t.test("macierz zgadza się z punktem odniesienia", () => {
        if (!fs.existsSync(BASELINE)) {
          fs.writeFileSync(BASELINE, JSON.stringify(macierz, null, 2) + "\n");
          console.log(`  ⓘ Punkt odniesienia zapisany: ${BASELINE}`);
          return;
        }
        const odniesienie = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
        assert.deepEqual(
          macierz,
          odniesienie,
          "decyzje o dostępie różnią się od punktu odniesienia — to jest ZATRZYMANIE, nie do nadpisania bez powodu",
        );
      });

      // Ten wiersz zasługuje na własną asercję, bo jest łatwy do zepsucia „przy okazji".
      //
      // **053 ZMIENIŁO GO ŚWIADOMIE.** Do 052 własność zespołowa nie dawała NIKOMU niczego, więc
      // projekt zespołowy był martwy — widoczny i bezużyteczny. Teraz członek zespołu może w nim
      // pracować. To jest jedyna zaplanowana różnica wobec punktu odniesienia z 052; wszystkie
      // pozostałe komórki mają zostać nietknięte i pilnuje tego porównanie wyżej.
      await t.test("053: członek zespołu MOŻE pracować w projekcie zespołowym", () => {
        assert.equal(macierz["w zespole, bez czlonkostwa"]["projekt zespolowy: odczyt/edycja"], "dozwolone");
      });

      await t.test("056: właściciel zespołu bez członkostwa WIDZI projekt, do którego ma prawo", async () => {
        // Świadoma zmiana ze speca §5 daje właścicielowi zespołu dostęp do projektu zespołowego.
        // Gdyby lista go nie pokazywała, powstałaby dokładnie ta asymetria, którą 053 zamknęło dla
        // członków: prawo działać w czymś, czego się nie widzi, i asystent twierdzący, że tego nie
        // ma. Dostęp i lista mają być tym SAMYM zbiorem.
        const { accessibleProjectIds } = await import("@/modules/tasks/lib/sharingGuard");
        const widoczne = await accessibleProjectIds(wlasciciel.id);
        assert.equal(macierz["wlasciciel projektu"]["projekt zespolowy: odczyt/edycja"], "dozwolone");
        assert.ok(
          widoczne.includes(projektZespolu.id),
          "właściciel zespołu ma dostęp do projektu zespołowego, więc musi go też widzieć na liście",
        );

        // I w drugą stronę: obcy ani go nie widzi, ani nie może.
        const obceWidoczne = await accessibleProjectIds(obcy.id);
        assert.equal(obceWidoczne.includes(projektZespolu.id), false);
      });

      await t.test("053: osoby spoza zespołu nadal nic nie zyskują", () => {
        for (const kto of ["czlonek MEMBER", "czlonek ADMIN", "obcy"]) {
          assert.equal(
            macierz[kto]["projekt zespolowy: odczyt/edycja"],
            "odmowa",
            `${kto} nie należy do zespołu i nie ma prawa nic zyskać`,
          );
        }
      });

      // ── SEDNO PRZEBIEGU (AC-4) ────────────────────────────────────────────────────────
      // Nowy mechanizm liczy te same decyzje. Różnica w JEDNEJ komórce jest zatrzymaniem —
      // albo błąd w deklaracji, albo poszerzenie uprawnień, którego nikt nie zamawiał.
      await t.test("NOWY mechanizm daje decyzje identyczne co do komórki", async () => {
        const nowa = await zbudujMacierz(operacjeNowe);
        assert.deepEqual(
          nowa,
          macierz,
          "requireAccess rozstrzyga inaczej niż dzisiejszy guard — to jest ZATRZYMANIE, nie do nadpisania",
        );
      });
    } finally {
      await prisma.task.deleteMany({ where: { id: { in: [zadanieWProjekcie.id, zadanieLuzem.id] } } });
      await prisma.taskProject.deleteMany({ where: { id: { in: [projekt.id, projektZespolu.id] } } });
      await prisma.team.deleteMany({ where: { id: zespol.id } });
      await prisma.user.deleteMany({
        where: { id: { in: [wlasciciel.id, czlonek.id, admin.id, obcy.id, zespolowy.id].map(String) } },
      });
    }
  },
);
