import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 052/AC-9 — ASYSTENT NIE JEST DROGĄ OBEJŚCIA UPRAWNIEŃ (rozdz. 9.6).
 *
 * Dokument nazywa to **realnym zagrożeniem bezpieczeństwa**, i słusznie: asystent czyta wszystkie
 * moduły, nie przechodzi przez UI i dostaje identyfikatory wprost z rozmowy. Gdyby jego read-toole
 * pytały bazę po `ownerId` zamiast przez wspólne sprawdzanie dostępu, wystarczyłoby podać cudzy
 * identyfikator — albo cudzy TYTUŁ, bo `get_task` rozwiązuje też nazwy.
 *
 * Test sprawdza **obie drogi wejścia** i jest sprawdzony na czerwono: po wyłączeniu kontroli
 * w `get_task` przechodzi w „dozwolone" i test pada.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "asystent: read-tool nie zwraca zadania osoby, do której użytkownik nie ma dostępu",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { readTools } = await import("@/modules/tasks/ai/readTools");

    const wlasciciel = await prisma.user.create({ data: { email: `ab-a-${rnd()}@test.local` } });
    const napastnik = await prisma.user.create({ data: { email: `ab-b-${rnd()}@test.local` } });

    const projekt = await prisma.taskProject.create({
      data: { name: `Prywatny-${rnd()}`, ...(await wlasnoscDoZapisu(wlasciciel.id)) },
    });
    const tytul = `Tajne-${rnd()}`;
    const zadanie = await prisma.task.create({
      data: { title: tytul, projectId: projekt.id, createdById: wlasciciel.id },
    });

    try {
      await t.test("właściciel widzi swoje zadanie (kontrola pozytywna)", async () => {
        const wynik = await readTools.get_task({ taskId: zadanie.id }, wlasciciel.id);
        assert.ok(wynik, "właściciel MUSI widzieć własne zadanie — inaczej test niczego nie dowodzi");
      });

      await t.test("obcy nie dostaje zadania po IDENTYFIKATORZE", async () => {
        const wynik = await readTools
          .get_task({ taskId: zadanie.id }, napastnik.id)
          .catch(() => null);
        assert.equal(wynik, null, "asystent wydał cudze zadanie po identyfikatorze");
      });

      await t.test("obcy nie dostaje zadania po TYTULE", async () => {
        // `get_task` rozwiązuje `taskId` również jako tytuł — to druga droga wejścia i była
        // dokładnie tak samo niebezpieczna.
        const wynik = await readTools.get_task({ taskId: tytul }, napastnik.id).catch(() => null);
        assert.equal(wynik, null, "asystent wydał cudze zadanie po tytule");
      });

      await t.test("obcy nie widzi cudzego projektu na liście", async () => {
        const projekty = (await readTools.list_projects({}, napastnik.id)) as { id: string }[];
        assert.ok(
          !projekty.some((p) => p.id === projekt.id),
          "lista projektów asystenta pokazała cudzy projekt",
        );
      });
    } finally {
      await prisma.task.deleteMany({ where: { id: zadanie.id } });
      await prisma.taskProject.deleteMany({ where: { id: projekt.id } });
      await prisma.user.deleteMany({ where: { id: { in: [wlasciciel.id, napastnik.id] } } });
    }
  },
);
