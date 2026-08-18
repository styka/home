import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 092 (zadanie 15, ciąg dalszy) — WERSJE NA KOLEJNYCH MODELACH.
 *
 * 062 udowodniło mechanizm na pilocie. Tu sprawdzamy dwie rzeczy, których rozszerzenie mogłoby nie
 * dowieźć po cichu: że nowe modele **faktycznie liczą wersję** (kolumna bez inkrementacji wygląda
 * identycznie i nie chroni przed niczym) i że kontrola konfliktu na nich działa, gdy klient poda
 * `expectedVersion`.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "wersje na Recipe, TaskProject, ShoppingList, Contact i StorageItem",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { updateWithVersion, ConflictError } = await import("../version");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");

    const u = await prisma.user.create({ data: { email: `wersje-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(u.id);
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: u.id } });

    try {
      await t.test("zapis bez `expectedVersion` PODNOSI wersję", async () => {
        // Kolumna, której nikt nie inkrementuje, wygląda dokładnie tak samo jak działająca —
        // i nie chroni przed niczym. To jest ten przypadek.
        const projekt = await prisma.taskProject.create({ data: { name: `w-${rnd()}`, workspaceId: ws.id } });
        assert.equal(projekt.version, 0);
        await updateWithVersion(prisma.taskProject, "tasks.project", projekt.id, { name: "po zmianie" });
        const po = await prisma.taskProject.findUniqueOrThrow({ where: { id: projekt.id } });
        assert.equal(po.version, 1, "bez inkrementacji kontrola wersji nigdy by nie zadziałała");
        await prisma.taskProject.delete({ where: { id: projekt.id } });
      });

      await t.test("dwie równoległe edycje: druga dostaje ConflictError", async () => {
        const lista = await prisma.shoppingList.create({ data: { name: `w-${rnd()}`, workspaceId: ws.id } });
        // Obie strony wczytały wersję 0. Pierwsza zapisuje i podnosi ją do 1.
        await updateWithVersion(prisma.shoppingList, "shopping.list", lista.id, { name: "pierwsza" }, 0);
        // Druga wciąż myśli, że jest 0 — i musi się o tym dowiedzieć, zamiast nadpisać po cichu.
        await assert.rejects(
          () => updateWithVersion(prisma.shoppingList, "shopping.list", lista.id, { name: "druga" }, 0),
          (e: unknown) => e instanceof ConflictError,
        );
        const po = await prisma.shoppingList.findUniqueOrThrow({ where: { id: lista.id } });
        assert.equal(po.name, "pierwsza", "przegrany zapis nie może zostawić po sobie żadnego śladu");
        await prisma.shoppingList.delete({ where: { id: lista.id } });
      });

      await t.test("wszystkie pięć nowych modeli ma kolumnę i liczy od zera", async () => {
        // Sprawdzenie schematu, nie zachowania: brak kolumny w JEDNYM z nich objawiłby się dopiero
        // przy pierwszej równoległej edycji tego konkretnego modelu.
        const kontakt = await prisma.contact.create({ data: { name: `w-${rnd()}`, workspaceId: ws.id } });
        const pozycja = await prisma.storageItem.create({ data: { name: `w-${rnd()}`, workspaceId: ws.id } });
        const przepis = await prisma.recipe.create({ data: { title: `w-${rnd()}`, slug: `w-${rnd()}`, workspaceId: ws.id } });
        try {
          for (const [nazwa, wersja] of [
            ["Contact", kontakt.version],
            ["StorageItem", pozycja.version],
            ["Recipe", przepis.version],
          ] as const) {
            assert.equal(wersja, 0, `${nazwa} musi mieć kolumnę \`version\` startującą od zera`);
          }
        } finally {
          await prisma.recipe.delete({ where: { id: przepis.id } });
          await prisma.storageItem.delete({ where: { id: pozycja.id } });
          await prisma.contact.delete({ where: { id: kontakt.id } });
        }
      });
    } finally {
      await prisma.workspaceMember.deleteMany({ where: { userId: u.id } });
      await prisma.workspace.deleteMany({ where: { personalUserId: u.id } });
      await prisma.user.deleteMany({ where: { id: u.id } });
    }
  },
);
