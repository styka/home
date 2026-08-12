import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 055 / ETAP 2 — DOWÓD, ŻE NOWY REKORD DOSTAJE PRZESTRZEŃ.
 *
 * Bramka `check:workspace-fill` sprawdza, czy każda objęta tabela **ma** wyzwalacz. To jest pytanie
 * o kompletność mechanizmu, nie o jego zachowanie — a zachowania nie da się wyczytać z listy nazw.
 * Ten test odpowiada na drugie pytanie: czy zwykły zapis aplikacji faktycznie wychodzi z bazy
 * z wypełnioną przestrzenią.
 *
 * **Rekordy tworzymy przez PRISMĘ, nie surowym SQL-em.** Gdyby test wołał `INSERT` wprost,
 * sprawdzałby wyzwalacz — a pytanie brzmi „czy ścieżka zapisu aplikacji wypełnia kolumnę".
 *
 * Test operuje na WŁASNYM fixture i sprząta po sobie.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "wypełnianie przestrzeni: nowy rekord dostaje przestrzeń właściciela",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );

    const uzytkownik = await prisma.user.create({ data: { email: `fill-u-${rnd()}@test.local` } });
    // `ensurePersonalWorkspace` zwraca WYNIK UZGODNIENIA (`{utworzone, zaktualizowane, usunięte}`),
    // nie przestrzeń — sama przestrzeń idzie osobnym odczytem.
    await ensurePersonalWorkspace(uzytkownik.id);
    const przestrzenOsobista = await prisma.workspace.findUnique({
      where: { personalUserId: uzytkownik.id },
      select: { id: true },
    });
    const zespol = await prisma.team.create({
      data: { name: `Zespół-${rnd()}`, ownerId: uzytkownik.id },
    });
    await syncTeamWorkspace(zespol.id);
    const przestrzenZespolu = await prisma.workspace.findUnique({
      where: { teamId: zespol.id },
      select: { id: true },
    });

    const utworzone: string[] = [];
    const zrobNotatke = async (dane: Record<string, unknown>) => {
      const n = await prisma.note.create({
        data: { title: `n-${rnd()}`, content: "", ...dane },
        select: { id: true, workspaceId: true },
      });
      utworzone.push(n.id);
      return n;
    };

    try {
      await t.test("właściciel osobisty → jego przestrzeń osobista (AC-1)", async () => {
        const n = await zrobNotatke({ ownerId: uzytkownik.id });
        assert.equal(n.workspaceId, przestrzenOsobista?.id);
      });

      await t.test("właściciel zespołowy → przestrzeń zespołu (AC-2)", async () => {
        const n = await zrobNotatke({ ownerTeamId: zespol.id });
        assert.equal(n.workspaceId, przestrzenZespolu?.id);
      });

      await t.test("obie kolumny własności → wygrywa OSOBISTA (AC-3)", async () => {
        // Konwencja mówi „użytkownik ALBO zespół", ale baza tego nie wymusza. Pierwszeństwo musi
        // być takie samo jak w `resolveRole` i w backfillu 0227 — inaczej te same dane dostałyby
        // trzy różne odpowiedzi na pytanie „czyj to zasób".
        const n = await zrobNotatke({ ownerId: uzytkownik.id, ownerTeamId: zespol.id });
        assert.equal(n.workspaceId, przestrzenOsobista?.id);
      });

      await t.test("właściciel bez przestrzeni → NULL, ale zapis PRZECHODZI (AC-4)", async () => {
        // Najważniejszy przypadek całego etapu: mechanizm siedzi na ścieżce zapisu każdego modułu,
        // więc błąd w nim nie objawia się brakującym polem, tylko ODRZUCONYM zapisem użytkownika.
        const bezPrzestrzeni = await prisma.user.create({
          data: { email: `fill-x-${rnd()}@test.local` },
        });
        const n = await zrobNotatke({ ownerId: bezPrzestrzeni.id });
        assert.equal(n.workspaceId, null);
        await prisma.user.delete({ where: { id: bezPrzestrzeni.id } });
      });

      await t.test("`createMany` — każdy wiersz z osobna dostaje przestrzeń", async () => {
        // `create` to nie jedyna ścieżka zapisu w repo. Wyzwalacz jest `FOR EACH ROW`, więc
        // powinien objąć każdy wiersz wsadu — ale „powinien" to przewidywanie, a nie sprawdzenie.
        const tytuly = [`m1-${rnd()}`, `m2-${rnd()}`, `m3-${rnd()}`];
        await prisma.note.createMany({
          data: tytuly.map((title) => ({ title, content: "", ownerId: uzytkownik.id })),
        });
        const wsad = await prisma.note.findMany({
          where: { title: { in: tytuly } },
          select: { id: true, workspaceId: true },
        });
        utworzone.push(...wsad.map((n) => n.id));
        assert.equal(wsad.length, 3);
        for (const n of wsad) assert.equal(n.workspaceId, przestrzenOsobista?.id);
      });

      await t.test("przestrzeń podana wprost NIE jest nadpisywana", async () => {
        // Etap 3 i migracje danych muszą móc ustawić przestrzeń same — wyzwalacz uzupełnia brak,
        // a nie narzuca wartość.
        const n = await zrobNotatke({
          ownerId: uzytkownik.id,
          workspaceId: przestrzenZespolu?.id,
        });
        assert.equal(n.workspaceId, przestrzenZespolu?.id);
      });
    } finally {
      await prisma.note.deleteMany({ where: { id: { in: utworzone } } });
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: uzytkownik.id } }).catch(() => {});
    }
  },
);
