/**
 * Z-172 — testy izolacji danych między użytkownikami (BOLA/IDOR).
 * Z-171 — używa aliasu `@/` w runnerze (jeśli alias przestanie działać, test padnie).
 *
 * Wymaga bazy (Postgres). Bez `DATABASE_URL` cały blok jest pomijany, więc
 * `npm run test:unit` pozostaje zielony także bez bazy (CI z Postgresem je odpala).
 * Importy modułów dotykających Prisma są dynamiczne — żeby brak `DATABASE_URL`
 * nie wywołał konstrukcji klienta przy ładowaniu pliku.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-172 izolacja danych (IDOR/BOLA) — guardy odrzucają obcego właściciela", { skip: !HAS_DB && "brak DATABASE_URL" }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { assertListAccess } = await import("@/actions/lists");
  const { assertProjectAccess } = await import("@/actions/taskProjects");
  const { assertRecipeAccess } = await import("@/actions/recipes");
  const { assertPetAccess } = await import("@/actions/pets");
  const { assertCookbookAccess } = await import("@/actions/cookbooks");
  const { assertTaskAccess } = await import("@/lib/tasks/access");
  const { ownedByWhere } = await import("@/lib/ownership");

  const A = await prisma.user.create({ data: { email: `iso-a-${rnd()}@test.local`, name: "A" } });
  const B = await prisma.user.create({ data: { email: `iso-b-${rnd()}@test.local`, name: "B" } });

  try {
    const list = await prisma.shoppingList.create({ data: { name: "L", ownerId: A.id } });
    const project = await prisma.taskProject.create({ data: { name: "P", ownerId: A.id } });
    const recipe = await prisma.recipe.create({ data: { title: "R", slug: `r-${rnd()}`, ownerId: A.id } });
    const pet = await prisma.pet.create({ data: { name: "Pet", ownerId: A.id } });
    const cookbook = await prisma.cookbook.create({ data: { name: "CB", ownerId: A.id } });
    const taskInProject = await prisma.task.create({ data: { title: "t", projectId: project.id, createdById: A.id } });
    await prisma.note.create({ data: { title: "noteA", ownerId: A.id } });
    await prisma.note.create({ data: { title: "noteB", ownerId: B.id } });

    await t.test("shopping: właściciel ma dostęp, obcy odrzucony", async () => {
      await assertListAccess(list.id, A.id);
      await assert.rejects(() => assertListAccess(list.id, B.id));
    });
    await t.test("tasks (projekt): właściciel ma dostęp, obcy odrzucony", async () => {
      await assertProjectAccess(project.id, A.id);
      await assert.rejects(() => assertProjectAccess(project.id, B.id));
    });
    await t.test("recipes: właściciel (read/edit), obcy odrzucony", async () => {
      await assertRecipeAccess(recipe.id, A.id, "read");
      await assert.rejects(() => assertRecipeAccess(recipe.id, B.id, "read"));
      await assert.rejects(() => assertRecipeAccess(recipe.id, B.id, "edit"));
    });
    await t.test("pets: właściciel ma dostęp, obcy odrzucony", async () => {
      await assertPetAccess(pet.id, A.id);
      await assert.rejects(() => assertPetAccess(pet.id, B.id));
    });
    await t.test("kitchen (książka kucharska): właściciel ma dostęp, obcy odrzucony", async () => {
      await assertCookbookAccess(cookbook.id, A.id);
      await assert.rejects(() => assertCookbookAccess(cookbook.id, B.id));
    });
    await t.test("tasks (zadanie w projekcie): obcy odrzucony przez assertTaskAccess", async () => {
      await assertTaskAccess(taskInProject, A.id);
      await assert.rejects(() => assertTaskAccess(taskInProject, B.id));
    });
    await t.test("tasks (zadanie osobiste projectId=null): tylko twórca/przypisany", async () => {
      const personal = { projectId: null, createdById: A.id, assigneeId: null };
      await assertTaskAccess(personal, A.id);
      await assert.rejects(() => assertTaskAccess(personal, B.id), /Access denied/);
    });
    await t.test("ownedByWhere: filtr zwraca tylko rekordy właściciela", async () => {
      const aNotes = await prisma.note.findMany({ where: ownedByWhere(A.id, []) });
      assert.ok(aNotes.every((n) => n.ownerId === A.id), "A widzi tylko swoje notatki");
      const bNotes = await prisma.note.findMany({ where: ownedByWhere(B.id, []) });
      assert.ok(bNotes.every((n) => n.ownerId === B.id), "B widzi tylko swoje notatki");
    });
  } finally {
    // Sprzątanie: usuń zasoby A i userów (SET NULL nie blokuje, ale kasujemy jawnie).
    await prisma.note.deleteMany({ where: { OR: [{ ownerId: A.id }, { ownerId: B.id }] } });
    await prisma.task.deleteMany({ where: { createdById: A.id } });
    await prisma.taskProject.deleteMany({ where: { ownerId: A.id } });
    await prisma.shoppingList.deleteMany({ where: { ownerId: A.id } });
    await prisma.recipe.deleteMany({ where: { ownerId: A.id } });
    await prisma.pet.deleteMany({ where: { ownerId: A.id } });
    await prisma.cookbook.deleteMany({ where: { ownerId: A.id } });
    await prisma.user.delete({ where: { id: A.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: B.id } }).catch(() => {});
  }
});
