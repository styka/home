import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 062 — DOWÓD, ŻE RÓWNOLEGŁY ZAPIS NIE GUBI PRACY.
 *
 * Cichej utraty pracy nie da się sprawdzić czytaniem kodu: obie ścieżki wyglądają na poprawne,
 * a różnicę widać dopiero wtedy, gdy dwa zapisy spotkają się na jednym rekordzie. Ten test
 * odtwarza to spotkanie na prawdziwej bazie.
 *
 * **Przypadek, dla którego to powstało:** dwie osoby odczytują wersję N i obie zapisują.
 * Przed 062 obie kończyły się sukcesem, a praca pierwszej znikała. Po 062 pierwsza wygrywa,
 * druga dostaje konflikt — i to jest jedyna dopuszczalna para wyników.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "wersjonowanie: równoległy zapis daje jeden sukces i jeden konflikt",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { updateWithVersion, readVersion, ConflictError, MissingRecordError } = await import(
      "../version"
    );

    const autor = await prisma.user.create({ data: { email: `v-${rnd()}@test.local` } });
    const zadanie = await prisma.task.create({
      data: { title: `V-${rnd()}`, createdById: autor.id },
    });

    try {
      await t.test("zapis z aktualną wersją przechodzi i podnosi wersję (AC-1)", async () => {
        const v = await readVersion(prisma.task, zadanie.id);
        assert.equal(v, 0, "nowy rekord startuje z wersji 0");
        await updateWithVersion(prisma.task, "tasks.task", zadanie.id, { title: "po pierwszym" }, 0);
        const po = await prisma.task.findUnique({
          where: { id: zadanie.id },
          select: { title: true, version: true },
        });
        assert.equal(po?.title, "po pierwszym");
        assert.equal(po?.version, 1);
      });

      await t.test("DWIE osoby na tej samej wersji: pierwsza wygrywa, druga dostaje konflikt (AC-2)", async () => {
        // Obie odczytują ten sam stan — tak wygląda dwoje ludzi z otwartym formularzem.
        const wersjaObu = (await readVersion(prisma.task, zadanie.id))!;

        await updateWithVersion(prisma.task, "tasks.task", zadanie.id, { title: "Anna" }, wersjaObu);

        await assert.rejects(
          () => updateWithVersion(prisma.task, "tasks.task", zadanie.id, { title: "Marek" }, wersjaObu),
          (e: unknown) => e instanceof ConflictError,
          "drugi zapis na tej samej wersji MUSI się nie udać — inaczej praca Anny znika po cichu",
        );

        const po = await prisma.task.findUnique({
          where: { id: zadanie.id },
          select: { title: true },
        });
        assert.equal(po?.title, "Anna", "zwycięzcą jest pierwszy zapis, a nie ostatni");
      });

      await t.test("konflikt niesie AKTUALNĄ wersję — UI musi mieć co pokazać", async () => {
        const stara = 0;
        try {
          await updateWithVersion(prisma.task, "tasks.task", zadanie.id, { title: "x" }, stara);
          assert.fail("powinien być konflikt");
        } catch (e) {
          assert.ok(e instanceof ConflictError);
          assert.equal(typeof (e as InstanceType<typeof ConflictError>).currentVersion, "number");
          assert.notEqual((e as InstanceType<typeof ConflictError>).currentVersion, stara);
        }
      });

      await t.test("brak rekordu to NIE konflikt (AC-3)", async () => {
        // Użytkownik, który skasował zadanie w drugiej karcie, nie może dostać
        // „ktoś zmienił to zadanie" — dostanie komunikat nieprawdziwy i mylący.
        await assert.rejects(
          () => updateWithVersion(prisma.task, "tasks.task", "nie-istnieje", { title: "x" }, 0),
          (e: unknown) => e instanceof MissingRecordError,
        );
      });

      await t.test("zapis BEZ podanej wersji działa jak dotąd (AC-4)", async () => {
        // Ścieżki, których ten przebieg nie przełącza, mają zachowywać się identycznie.
        await updateWithVersion(prisma.task, "tasks.task", zadanie.id, { title: "bez wersji" });
        const po = await prisma.task.findUnique({
          where: { id: zadanie.id },
          select: { title: true, version: true },
        });
        assert.equal(po?.title, "bez wersji");
        assert.equal(po?.version, 3, "wersja rośnie także przy zapisie bez kontroli");
      });

      await t.test("notatka: ten sam mechanizm na drugim kształcie danych", async () => {
        const notatka = await prisma.note.create({
          data: { title: `N-${rnd()}`, content: "pierwsza treść", ownerId: autor.id },
        });
        try {
          const v = (await readVersion(prisma.note, notatka.id))!;
          await updateWithVersion(prisma.note, "notes.note", notatka.id, { content: "A" }, v);
          await assert.rejects(
            () => updateWithVersion(prisma.note, "notes.note", notatka.id, { content: "B" }, v),
            (e: unknown) => e instanceof ConflictError,
          );
          const po = await prisma.note.findUnique({
            where: { id: notatka.id },
            select: { content: true },
          });
          assert.equal(po?.content, "A");
        } finally {
          await prisma.note.delete({ where: { id: notatka.id } });
        }
      });
    } finally {
      await prisma.task.deleteMany({ where: { id: zadanie.id } });
      await prisma.user.delete({ where: { id: autor.id } }).catch(() => {});
    }
  },
);
