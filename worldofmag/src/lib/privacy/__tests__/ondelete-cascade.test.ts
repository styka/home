import { test } from "node:test";
import assert from "node:assert/strict";

// Z-033/Z-036 — jawna polityka onDelete = Cascade dla 10 modeli własności
// (ShoppingList, TaskProject, Note, Recipe, Cookbook, MealPlanEntry, LanguageDeck,
// HealthEvent, MedicationSchedule, Habit), które wcześniej miały SetNull/brak polityki
// i przy usunięciu konta zostawiały OSIEROCONY rekord (ownerId=NULL) — niezgodne z RODO.
//
// Test DB-gated. Usuwamy usera BEZPOŚREDNIO (`prisma.user.delete`, NIE `purgeUserData`),
// żeby sprawdzić samą KASKADĘ FK w bazie, niezależnie od ręcznego sprzątania w purge.
//
// WAŻNE: asercja po ID rekordu, nie po ownerId. SetNull też wyzerowałby ownerId
// (więc `count({where:{ownerId}})` fałszywie przeszłoby), ale ZOSTAWIŁ rekord —
// asercja po ID wykrywa regresję do bugu sieroctwa.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "Z-033 onDelete=Cascade: user.delete kasuje dane 10 modeli własności bez sierot (izolacja zachowana)",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/lib/prisma");

    const U = await prisma.user.create({ data: { email: `casc-u-${rnd()}@test.local` } });
    const V = await prisma.user.create({ data: { email: `casc-v-${rnd()}@test.local` } });

    const ids = {
      shoppingList: (await prisma.shoppingList.create({ data: { name: "L", ownerId: U.id } })).id,
      taskProject: (await prisma.taskProject.create({ data: { name: "P", ownerId: U.id } })).id,
      note: (await prisma.note.create({ data: { title: "N", ownerId: U.id } })).id,
      recipe: (await prisma.recipe.create({ data: { title: "R", slug: `r-${rnd()}`, ownerId: U.id } })).id,
      cookbook: (await prisma.cookbook.create({ data: { name: "C", ownerId: U.id } })).id,
      mealPlanEntry: (await prisma.mealPlanEntry.create({ data: { date: new Date(), slot: "DINNER", ownerId: U.id } })).id,
      languageDeck: (await prisma.languageDeck.create({ data: { name: "D", nativeLang: "pl", targetLang: "en", ownerId: U.id } })).id,
      healthEvent: (await prisma.healthEvent.create({ data: { title: "H", scheduledAt: new Date(), ownerId: U.id } })).id,
      medicationSchedule: (await prisma.medicationSchedule.create({ data: { name: "M", ownerId: U.id } })).id,
      habit: (await prisma.habit.create({ data: { name: "Hb", ownerId: U.id } })).id,
    };

    // Kontrola izolacji — rekord należący do innego usera (V).
    const vNote = await prisma.note.create({ data: { title: "V", ownerId: V.id } });

    try {
      // KLUCZOWE: bezpośrednie usunięcie usera wymusza kaskadę FK (nie app-level purge).
      await prisma.user.delete({ where: { id: U.id } });

      await t.test("każdy rekord własności FIZYCZNIE skasowany (kaskada, nie sierota)", async () => {
        assert.equal(await prisma.shoppingList.count({ where: { id: ids.shoppingList } }), 0, "ShoppingList");
        assert.equal(await prisma.taskProject.count({ where: { id: ids.taskProject } }), 0, "TaskProject");
        assert.equal(await prisma.note.count({ where: { id: ids.note } }), 0, "Note");
        assert.equal(await prisma.recipe.count({ where: { id: ids.recipe } }), 0, "Recipe");
        assert.equal(await prisma.cookbook.count({ where: { id: ids.cookbook } }), 0, "Cookbook");
        assert.equal(await prisma.mealPlanEntry.count({ where: { id: ids.mealPlanEntry } }), 0, "MealPlanEntry");
        assert.equal(await prisma.languageDeck.count({ where: { id: ids.languageDeck } }), 0, "LanguageDeck");
        assert.equal(await prisma.healthEvent.count({ where: { id: ids.healthEvent } }), 0, "HealthEvent");
        assert.equal(await prisma.medicationSchedule.count({ where: { id: ids.medicationSchedule } }), 0, "MedicationSchedule");
        assert.equal(await prisma.habit.count({ where: { id: ids.habit } }), 0, "Habit");
      });

      await t.test("izolacja: dane innego usera (V) nietknięte", async () => {
        assert.equal(await prisma.note.count({ where: { id: vNote.id } }), 1);
      });
    } finally {
      await prisma.note.deleteMany({ where: { ownerId: V.id } });
      await prisma.user.delete({ where: { id: V.id } }).catch(() => {});
    }
  },
);
