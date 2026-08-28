import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 112 (AC-2, AC-5) — STRONICOWANIE ODCZYTU ZADAŃ.
 *
 * Zgłoszenie „pies Raj": użytkownik poprosił o przeczytanie WSZYSTKICH obowiązków z projektu zadań i
 * zbudowanie na ich podstawie profilu zwierzęcia. Asystent wykonał jedenaście odczytów w sześciu
 * iteracjach — za każdym razem coraz węziej (po statusie, po tagu, po priorytecie) — po czym
 * wyczerpał kroki i nie oddał niczego. Przyczyną nie było narzędzie, tylko budżet rekordów PO jego
 * stronie i komunikat obcięcia, który kazał „zawęzić zapytanie": polecenie niewykonalne, bo limit
 * siedział w kontekście, nie w zapytaniu.
 *
 * Dwa niezmienniki, na których stoi naprawa:
 *  1. kolejne porcje są ROZŁĄCZNE i razem dają komplet (inaczej stronicowanie gubiłoby zadania
 *     równie cicho, jak robiło to dzielenie po filtrach),
 *  2. `includeDescription` daje TREŚĆ opisów wielu zadań naraz — bez tego zbudowanie profilu
 *     wymagałoby `get_task` po jednym, przy czterech narzędziach na turę.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "list_tasks: porcje po offset są rozłączne i pokrywają komplet",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { readTools } = await import("@/modules/tasks/ai/readTools");

    const uzytkownik = await prisma.user.create({ data: { email: `str-${rnd()}@test.local` } });
    const projekt = await prisma.taskProject.create({
      data: { name: `Stronicowanie-${rnd()}`, ...(await wlasnoscDoZapisu(uzytkownik.id)) },
    });
    const ILE = 60;
    for (let i = 0; i < ILE; i++) {
      await prisma.task.create({
        data: {
          title: `Zadanie ${String(i).padStart(2, "0")}`,
          description: i % 2 === 0 ? `Szczegóły zadania ${i}` : null,
          projectId: projekt.id,
          createdById: uzytkownik.id,
        },
      });
    }

    try {
      await t.test("dwie porcje po 40 dają komplet bez duplikatów (AC-2)", async () => {
        const a = (await readTools.list_tasks(
          { projectId: projekt.id, limit: 40, offset: 0 },
          uzytkownik.id
        )) as { id: string }[];
        const b = (await readTools.list_tasks(
          { projectId: projekt.id, limit: 40, offset: 40 },
          uzytkownik.id
        )) as { id: string }[];

        assert.equal(a.length, 40, "pierwsza porcja pełna");
        assert.equal(b.length, ILE - 40, "druga porcja to reszta");

        const idA = new Set(a.map((z) => z.id));
        const wspolne = b.filter((z) => idA.has(z.id));
        assert.equal(wspolne.length, 0, "porcje NIE mogą na siebie zachodzić");
        assert.equal(new Set([...a, ...b].map((z) => z.id)).size, ILE, "razem dają komplet zadań");
      });

      await t.test("bez includeDescription wynik niesie tylko flagę (zero kosztu tokenów)", async () => {
        const wynik = (await readTools.list_tasks({ projectId: projekt.id, limit: 5 }, uzytkownik.id)) as Record<
          string,
          unknown
        >[];
        const zOpisem = wynik.filter((z) => z.hasDescription === true);
        assert.ok(zOpisem.length > 0, "w zestawie są zadania z opisem — inaczej test niczego nie dowodzi");
        assert.ok(
          wynik.every((z) => z.description === undefined),
          "bez flagi treść opisu NIE trafia do wyniku"
        );
      });

      await t.test("includeDescription dokłada TREŚĆ opisów wielu zadań naraz (AC-5)", async () => {
        const wynik = (await readTools.list_tasks(
          { projectId: projekt.id, limit: 40, includeDescription: true },
          uzytkownik.id
        )) as Record<string, unknown>[];
        const zTrescia = wynik.filter((z) => typeof z.description === "string" && z.description);
        assert.ok(zTrescia.length >= 20, `oczekiwano treści opisów, dostano ${zTrescia.length}`);
        assert.ok(
          wynik.every((z) => z.hasDescription === undefined),
          "z flagą nie dublujemy informacji: jest treść ALBO flaga, nie oba"
        );
      });

      await t.test("offset nie poszerza widocznego zbioru (guard bez zmian)", async () => {
        const obcy = await prisma.user.create({ data: { email: `str-obcy-${rnd()}@test.local` } });
        const wynik = (await readTools.list_tasks({ limit: 40, offset: 0 }, obcy.id)) as { id: string }[];
        const idProjektu = new Set(
          ((await readTools.list_tasks({ projectId: projekt.id, limit: 40 }, uzytkownik.id)) as { id: string }[]).map(
            (z) => z.id
          )
        );
        assert.equal(
          wynik.filter((z) => idProjektu.has(z.id)).length,
          0,
          "stronicowanie zmienia OKNO, nigdy zakres dostępu"
        );
        await prisma.user.delete({ where: { id: obcy.id } });
      });
    } finally {
      await prisma.task.deleteMany({ where: { projectId: projekt.id } });
      await prisma.taskProject.delete({ where: { id: projekt.id } });
      await prisma.user.delete({ where: { id: uzytkownik.id } });
    }
  }
);
