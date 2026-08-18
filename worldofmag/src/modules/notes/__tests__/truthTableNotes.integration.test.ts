import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 095 — TABELA PRAWDY DOSTĘPU DO NOTATEK.
 *
 * Ten przebieg przenosi rozstrzyganie dostępu do notatki z guardu modułu (`assertOwnership`) do
 * platformy. Sygnatura się nie zmienia, więc kompilator nie ma tu nic do powiedzenia — różnić się
 * może każda pojedyncza odpowiedź. Stąd macierz **(relacja × operacja)** (C-17).
 *
 * **Punkt odniesienia jest liczony NIEZALEŻNIE, a nie odczytany z pliku zapisanego po zmianie.**
 * Zamrożony JSON wygenerowany już po przełączeniu dowodziłby wyłącznie tego, że kod jest zgodny
 * sam ze sobą. Dlatego stara reguła jest tu **odtworzona wprost** (notatka leży w jednej z moich
 * przestrzeni) i porównywana z nową dla wszystkich wierszy, w których nadań nie ma. Dla wierszy
 * z nadaniem porównanie nie miałoby sensu: tam poprzednia odpowiedź brzmiała „odmowa", bo nadania
 * dla notatek nie istniały.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

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
  "tabela prawdy dostępu do notatek: członkowie przestrzeni bez zmian, nadania to jedyna nowość",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { requireModuleAccess } = await import("../lib/sharingGuard");
    const { idZasobowNadanychMi } = await import("@/platform/sharing/nadaneMi");
    const { getAccessContext } = await import("@/platform/sharing/cache");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import("@/platform/workspaces/sync");
    const { getUserTeamIds } = await import("@/platform/auth/serverUtils");

    const wlasciciel = await prisma.user.create({ data: { email: `tn-o-${rnd()}@test.local` } });
    const wZespole = await prisma.user.create({ data: { email: `tn-z-${rnd()}@test.local` } });
    const widz = await prisma.user.create({ data: { email: `tn-v-${rnd()}@test.local` } });
    const redaktor = await prisma.user.create({ data: { email: `tn-e-${rnd()}@test.local` } });
    const przezZespol = await prisma.user.create({ data: { email: `tn-tz-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `tn-x-${rnd()}@test.local` } });

    const zespolWlasciciel = await prisma.team.create({
      data: { name: `TNW-${rnd()}`, ownerId: wlasciciel.id, members: { create: [{ userId: wZespole.id, role: "MEMBER" }] } },
    });
    const zespolZUdostepnieniem = await prisma.team.create({
      data: { name: `TNU-${rnd()}`, ownerId: wlasciciel.id, members: { create: [{ userId: przezZespol.id, role: "MEMBER" }] } },
    });
    for (const u of [wlasciciel, wZespole, widz, redaktor, przezZespol, obcy]) await ensurePersonalWorkspace(u.id);
    await syncTeamWorkspace(zespolWlasciciel.id);
    await syncTeamWorkspace(zespolZUdostepnieniem.id);

    const moja = await prisma.note.create({
      data: { title: `N-${rnd()}`, content: "x", ...(await wlasnoscDoZapisu(wlasciciel.id)) },
    });
    const zespolowa = await prisma.note.create({
      data: { title: `NZ-${rnd()}`, content: "x", ...(await wlasnoscDoZapisu(wlasciciel.id, zespolWlasciciel.id)) },
    });

    const przestrzenUdostepniana = await prisma.workspace.findUnique({
      where: { teamId: zespolZUdostepnieniem.id },
      select: { id: true },
    });
    assert.ok(przestrzenUdostepniana, "przestrzeń zespołu musi istnieć");

    await prisma.resourceGrant.createMany({
      data: [
        { workspaceId: moja.workspaceId, resourceType: "notes.note", resourceId: moja.id, subjectType: "user", subjectId: widz.id, role: "viewer", createdById: wlasciciel.id },
        { workspaceId: moja.workspaceId, resourceType: "notes.note", resourceId: moja.id, subjectType: "user", subjectId: redaktor.id, role: "editor", createdById: wlasciciel.id },
        { workspaceId: moja.workspaceId, resourceType: "notes.note", resourceId: moja.id, subjectType: "workspace", subjectId: przestrzenUdostepniana.id, role: "editor", createdById: wlasciciel.id },
      ],
    });

    /** Reguła SPRZED 095, odtworzona wprost: notatka leży w jednej z moich przestrzeni. */
    async function staraRegula(noteId: string, userId: string): Promise<Decyzja> {
      const n = await prisma.note.findUnique({ where: { id: noteId }, select: { workspaceId: true } });
      if (!n) return "odmowa";
      const teamIds = await getUserTeamIds(userId);
      const moje = await prisma.workspace.findMany({
        where: { OR: [{ personalUserId: userId }, { teamId: { in: teamIds } }] },
        select: { id: true },
      });
      return moje.some((w) => w.id === n.workspaceId) ? "dozwolone" : "odmowa";
    }

    const osoby: Record<string, string> = {
      wlasciciel: wlasciciel.id,
      "czlonek zespolu wlasciciela": wZespole.id,
      "nadanie viewer": widz.id,
      "nadanie editor": redaktor.id,
      "nadanie dla przestrzeni zespolu": przezZespol.id,
      obcy: obcy.id,
    };
    const operacje: Record<string, (u: string) => Promise<unknown>> = {
      "notatka wlasna: odczyt": (u) => requireModuleAccess(u, { type: "notes.note", id: moja.id }, "note.read"),
      "notatka wlasna: edycja": (u) => requireModuleAccess(u, { type: "notes.note", id: moja.id }, "note.edit"),
      "notatka zespolowa: odczyt": (u) => requireModuleAccess(u, { type: "notes.note", id: zespolowa.id }, "note.read"),
      "notatka zespolowa: edycja": (u) => requireModuleAccess(u, { type: "notes.note", id: zespolowa.id }, "note.edit"),
    };
    /** Wiersze BEZ nadania — tylko dla nich stara i nowa reguła muszą dać to samo. */
    const bezNadania = ["wlasciciel", "czlonek zespolu wlasciciela", "obcy"];

    try {
      const macierz: Record<string, Record<string, Decyzja>> = {};
      for (const [kto, id] of Object.entries(osoby)) {
        macierz[kto] = {};
        for (const [co, wykonaj] of Object.entries(operacje)) macierz[kto][co] = await decyzja(() => wykonaj(id));
      }

      /**
       * Jedna komórka RÓŻNI SIĘ od starej reguły i jest wymieniona z nazwy zamiast zamiecionej:
       * właściciel zespołu × zasób jego zespołu. `getUserTeamIds` czyta wiersze `TeamMember`,
       * a założyciel zespołu takiego wiersza nie ma — więc stara reguła odmawiała mu dostępu do
       * zasobu WŁASNEGO zespołu. Lustro przestrzeni (051) wpisuje go jako `owner`, więc platforma
       * przepuszcza. To dokładnie ta sama komórka, którą 056 rozstrzygnęło dla Zadań, a 060 dla
       * Zwierząt; tu ujawnia się w trzecim module. Rozszerzenie dotyczy wyłącznie zasobu, którego
       * przestrzeń ta osoba posiada — nikomu innemu niczego nie dodaje.
       */
      const ZNANA_ROZBIEZNOSC_056 = new Set([
        "wlasciciel|notatka zespolowa: odczyt",
        "wlasciciel|notatka zespolowa: edycja",
      ]);

      await t.test("dla relacji bez nadania nowa reguła odpowiada dokładnie tak, jak stara", async () => {
        for (const kto of bezNadania) {
          for (const [co, notatka] of [
            ["notatka wlasna: odczyt", moja.id],
            ["notatka wlasna: edycja", moja.id],
            ["notatka zespolowa: odczyt", zespolowa.id],
            ["notatka zespolowa: edycja", zespolowa.id],
          ] as const) {
            if (ZNANA_ROZBIEZNOSC_056.has(`${kto}|${co}`)) continue;
            const stara = await staraRegula(notatka, osoby[kto]);
            assert.equal(macierz[kto][co], stara, `${kto} × ${co}: stara=${stara}, nowa=${macierz[kto][co]}`);
          }
        }
      });

      await t.test("056: właściciel zespołu widzi notatkę swojego zespołu (świadoma rozbieżność)", async () => {
        // Pilnujemy OBU stron: że stara reguła faktycznie odmawiała (inaczej wyjątek byłby zbędny
        // i cicho przykrywałby przyszły regres) i że nowa przepuszcza.
        assert.equal(await staraRegula(zespolowa.id, wlasciciel.id), "odmowa");
        assert.equal(macierz["wlasciciel"]["notatka zespolowa: odczyt"], "dozwolone");
        assert.equal(macierz["wlasciciel"]["notatka zespolowa: edycja"], "dozwolone");
      });

      await t.test("obcy nie może nic", () => {
        for (const v of Object.values(macierz["obcy"])) assert.equal(v, "odmowa");
      });

      await t.test("nadanie viewer czyta, ale nie edytuje", () => {
        assert.equal(macierz["nadanie viewer"]["notatka wlasna: odczyt"], "dozwolone");
        assert.equal(macierz["nadanie viewer"]["notatka wlasna: edycja"], "odmowa");
        // Nadanie dotyczy JEDNEJ notatki — nie otwiera reszty przestrzeni właściciela.
        assert.equal(macierz["nadanie viewer"]["notatka zespolowa: odczyt"], "odmowa");
      });

      await t.test("nadanie editor czyta i edytuje", () => {
        assert.equal(macierz["nadanie editor"]["notatka wlasna: odczyt"], "dozwolone");
        assert.equal(macierz["nadanie editor"]["notatka wlasna: edycja"], "dozwolone");
      });

      await t.test("nadanie dla przestrzeni zespołu działa dla jego członka", () => {
        assert.equal(macierz["nadanie dla przestrzeni zespolu"]["notatka wlasna: edycja"], "dozwolone");
      });

      await t.test("udostępniona notatka trafia na listę „nadane mi”, a cudza nie", async () => {
        const ctxWidz = await getAccessContext(widz.id);
        const nadaneWidzowi = await idZasobowNadanychMi(widz.id, "notes.note", ctxWidz);
        assert.ok(nadaneWidzowi.includes(moja.id), "widz musi zobaczyć udostępnioną mu notatkę");
        assert.ok(!nadaneWidzowi.includes(zespolowa.id), "notatka bez nadania nie może się tam znaleźć");

        const ctxObcy = await getAccessContext(obcy.id);
        assert.deepEqual(await idZasobowNadanychMi(obcy.id, "notes.note", ctxObcy), []);
      });

      await t.test("PRÓBA: po usunięciu nadania widz traci dostęp", async () => {
        // Bez tej próby zielony wiersz „nadanie viewer" mógłby wynikać z czegokolwiek innego
        // (własności, członkostwa, dziury w regule) i nikt by tego nie zauważył.
        await prisma.resourceGrant.deleteMany({
          where: { resourceType: "notes.note", resourceId: moja.id, subjectType: "user", subjectId: widz.id },
        });
        const po = await decyzja(() => requireModuleAccess(widz.id, { type: "notes.note", id: moja.id }, "note.read"));
        assert.equal(po, "odmowa", "to nadanie było jedynym powodem dostępu — po jego usunięciu musi być odmowa");
      });
    } finally {
      await prisma.resourceGrant.deleteMany({ where: { resourceId: { in: [moja.id, zespolowa.id] } } });
      await prisma.note.deleteMany({ where: { id: { in: [moja.id, zespolowa.id] } } });
      for (const z of [zespolWlasciciel, zespolZUdostepnieniem]) await prisma.team.delete({ where: { id: z.id } }).catch(() => {});
      for (const u of [wlasciciel, wZespole, widz, redaktor, przezZespol, obcy]) await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
  },
);
