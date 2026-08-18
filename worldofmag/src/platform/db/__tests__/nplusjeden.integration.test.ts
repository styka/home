process.env.OMNIA_QUERY_LOG = "1";

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 084 (zadanie 28, Faza 5) — AUDYT N+1 JAKO POMIAR, NIE JAKO PRZEGLĄD KODU.
 *
 * Rozdz. 11.4 wskazuje cztery powierzchnie do zbadania: kalendarz, pulpit, `ModuleSnapshotGrid`
 * i listy z nadaniami dostępu. „Przejrzeć kod i poprawić" nie jest tu wykonalne: składane są
 * z kilkunastu wkładów modułowych, więc liczba zapytań zmienia się przy każdej nowej funkcji —
 * i rośnie po cichu, bo nic jej nie mierzy.
 *
 * Dlatego audyt ma postać **zapadki**, jak przy paginacji (068): mierzymy liczbę zapytań, zamrażamy
 * ją w `nplusjeden-baseline.json` i nie pozwalamy jej rosnąć. Zapadka pada również przy SPADKU —
 * poprawa ma zostać zapisana w progu, inaczej pierwszy regres schowa się pod dawnym zapasem.
 *
 * **Czego ten test nie robi:** nie twierdzi, że dana liczba jest „dobra". Twierdzi, że jest ZNANA.
 * Rozstrzygnięcie „12 zapytań na pulpit z jedenastoma modułami to N+1 czy nie" wymaga wiedzy o tym,
 * ile modułów wnosi wkład — i właśnie dlatego wynik jest zapisany razem z tą liczbą.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);
const BASELINE = path.join(process.cwd(), "src/platform/db/__tests__/nplusjeden-baseline.json");

test(
  "audyt N+1: liczba zapytań na powierzchniach składanych z wielu modułów",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");
    const { collectDashboardSnapshot } = await import("@/lib/dashboardSnapshot");
    const { collectCalendarEvents } = await import("@/lib/calendarAgenda");
    const { DASHBOARD_CONTRIBUTORS } = await import("@/lib/dashboardContributors");
    const { MODULE_SERVER } = await import("@/lib/modules.server");
    const { wZakresieOperacji } = await import("@/platform/sharing/cache");
    const { MODULES } = await import("@/lib/modules");

    let zapytania: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).$on("query", (e: { query: string }) => {
      zapytania.push(e.query);
    });

    type Pomiar = { zapytan: number; powtorzenia: number; najczestsze: string };

    /**
     * Zwraca łączną liczbę zapytań ORAZ **największą liczbę powtórzeń TEGO SAMEGO zapytania**.
     * Druga liczba jest właściwym sygnałem N+1: sama suma rośnie także wtedy, gdy powierzchnia
     * dostaje nowy, uzasadniony wkład, i wtedy wzrost jest w porządku. Powtórzenie identycznego
     * SQL-a nie jest w porządku nigdy.
     */
    async function zmierz(g: () => Promise<unknown>): Promise<Pomiar> {
      // Każdy przebieg wewnątrz ZAKRESU OPERACJI. Bez tego pomiar byłby nierzetelny w jedną stronę:
      // poza żądaniem `React.cache` nie memoizuje, więc kontekst dostępu liczyłby się od nowa dla
      // każdego wkładu i test zgłaszałby N+1, którego użytkownik nigdy nie widzi.
      const f = () => wZakresieOperacji(async () => { await g(); });
      // Pierwszy przebieg rozgrzewa: Prisma przygotowuje połączenie i plany, a my mierzymy pracę
      // ustaloną, nie koszt startu. Bez tego wynik skakałby między przebiegami.
      await f();
      zapytania = [];
      await f();
      const zliczone = new Map<string, number>();
      for (const q of zapytania) zliczone.set(q, (zliczone.get(q) ?? 0) + 1);
      let najczestsze = "";
      let powtorzenia = 0;
      for (const [q, n] of zliczone) {
        if (n > powtorzenia) {
          powtorzenia = n;
          najczestsze = q;
        }
      }
      return { zapytan: zapytania.length, powtorzenia, najczestsze: najczestsze.slice(0, 120) };
    }

    function kontekstPulpitu() {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 86_400_000);
      return { now, todayStart, todayEnd, teamIds: [] as string[] };
    }

    const u = await prisma.user.create({ data: { email: `nplus-${rnd()}@test.local` } });
    const obdarowany = await prisma.user.create({ data: { email: `nplus-obd-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(u.id);
    await ensurePersonalWorkspace(obdarowany.id);
    const przestrzen = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: u.id } });
    const wszystkieUprawnienia = MODULES.map((m) => m.permission).filter((p): p is string => !!p);

    /**
     * DANE SĄ WARUNKIEM SENSU tego pomiaru. N+1 to „zapytanie na każdy wiersz wyniku" — przy pustej
     * bazie każda z tych powierzchni wykonuje zapytanie zbiorcze, nie znajduje nic i kończy pracę,
     * więc test bez danych świeciłby na zielono także dla kodu jawnie pętlącego po rekordach.
     * Kilka wierszy wystarczy: różnica między 1 a 3 zapytaniami na wiersz jest widoczna od razu.
     */
    const wTymMiesiacu = (dzien: number) => {
      const t = new Date();
      return new Date(t.getFullYear(), t.getMonth(), dzien, 12, 0, 0);
    };
    const projekt = await prisma.taskProject.create({
      data: { name: `nplus-${rnd()}`, workspaceId: przestrzen.id },
    });
    await prisma.task.createMany({
      data: [5, 10, 15].map((d, i) => ({
        title: `zadanie ${i}`,
        projectId: projekt.id,
        dueDate: wTymMiesiacu(d),
        createdById: u.id,
      })),
    });
    await prisma.vehicle.createMany({
      data: [
        { name: `auto-${rnd()}`, inspectionDue: wTymMiesiacu(8), workspaceId: przestrzen.id },
        { name: `auto-${rnd()}`, insuranceDue: wTymMiesiacu(20), workspaceId: przestrzen.id },
      ],
    });
    // Nadania z RÓŻNYMI rodzajami podmiotu — to one uruchamiają dociąganie nazw obdarowanych,
    // czyli miejsce, w którym N+1 na tej liście byłby najbardziej naturalny.
    await prisma.resourceGrant.createMany({
      data: [
        { workspaceId: przestrzen.id, resourceType: "tasks.project", resourceId: projekt.id, subjectType: "user", subjectId: obdarowany.id, role: "viewer", createdById: u.id },
        { workspaceId: przestrzen.id, resourceType: "tasks.project", resourceId: `${projekt.id}-b`, subjectType: "user", subjectId: obdarowany.id, role: "editor", createdById: u.id },
        { workspaceId: przestrzen.id, resourceType: "tasks.project", resourceId: `${projekt.id}-c`, subjectType: "workspace", subjectId: przestrzen.id, role: "viewer", createdById: u.id },
      ],
    });

    try {
      const zmierzone: Record<string, Pomiar & { wkladow: number }> = {};

      await t.test("pulpit (migawka + ModuleSnapshotGrid czytają TEN SAM zbiór)", async () => {
        // `ModuleSnapshotGrid` nie ma własnych zapytań — renderuje migawkę policzoną tutaj.
        // Rozdz. 11.4 wymienia go osobno, więc zapisujemy to wprost zamiast milczeć.
        const n = await zmierz(() =>
          collectDashboardSnapshot(u.id, wszystkieUprawnienia, kontekstPulpitu()),
        );
        zmierzone.pulpit = { ...n, wkladow: Object.keys(DASHBOARD_CONTRIBUTORS).length };
      });

      await t.test("kalendarz (agregat wielomodułowy)", async () => {
        const teraz = new Date();
        const n = await zmierz(() => collectCalendarEvents(u.id, teraz.getFullYear(), teraz.getMonth()));
        zmierzone.kalendarz = { ...n, wkladow: Object.values(MODULE_SERVER).filter((m) => m.calendar).length };
      });

      await t.test("listy z nadaniami dostępu", async () => {
        const { zbierzUdostepnioneMnie, zbierzUdostepnionePrzezeMnie } = await import("@/lib/sharingLists");
        const n = await zmierz(async () => {
          await zbierzUdostepnioneMnie(u.id);
          await zbierzUdostepnionePrzezeMnie(u.id);
        });
        zmierzone.nadania = { ...n, wkladow: 2 };
      });

      await t.test("zapadka: liczba zapytań i powtórzeń nie rośnie (i nie maleje po cichu)", () => {
        const prog = JSON.parse(fs.readFileSync(BASELINE, "utf8")) as {
          progi: Record<string, { zapytan: number; powtorzenia: number }>;
        };
        const rozbieznosci: string[] = [];
        for (const [nazwa, wynik] of Object.entries(zmierzone)) {
          const oczekiwane = prog.progi[nazwa];
          if (!oczekiwane) {
            rozbieznosci.push(`${nazwa}: brak progu w nplusjeden-baseline.json (zmierzono ${JSON.stringify(wynik)})`);
            continue;
          }
          for (const pole of ["zapytan", "powtorzenia"] as const) {
            if (wynik[pole] > oczekiwane[pole]) {
              rozbieznosci.push(
                `${nazwa}.${pole}: ${wynik[pole]}, próg ${oczekiwane[pole]}` +
                  (pole === "powtorzenia" ? ` — to samo zapytanie N razy: ${wynik.najczestsze}` : " — nowe zapytanie w gorącej ścieżce"),
              );
            } else if (wynik[pole] < oczekiwane[pole]) {
              rozbieznosci.push(
                `${nazwa}.${pole}: ${wynik[pole]}, próg ${oczekiwane[pole]} — POPRAW PRÓG, inaczej zapas ukryje następny regres`,
              );
            }
          }
        }
        assert.deepEqual(rozbieznosci, [], `\n${rozbieznosci.join("\n")}\n\nZmierzono: ${JSON.stringify(zmierzone)}`);
      });

    } finally {
      await prisma.resourceGrant.deleteMany({ where: { workspaceId: przestrzen.id } });
      await prisma.task.deleteMany({ where: { projectId: projekt.id } });
      await prisma.taskProject.deleteMany({ where: { id: projekt.id } });
      await prisma.vehicle.deleteMany({ where: { workspaceId: przestrzen.id } });
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: [u.id, obdarowany.id] } } });
      await prisma.workspace.deleteMany({ where: { personalUserId: { in: [u.id, obdarowany.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [u.id, obdarowany.id] } } });
    }
  },
);
