import { getAutoReplenishCandidates, getCookbooks, getExpiringSoon, getMealPlanCost, getRecipe, getTodaysMeals } from "../contract";
import { getUserTeamIds, ownedOrAsync } from "@/platform/auth/serverUtils";
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, clampLimit, asStr, resolveIdOrName, ownerScope } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_recipes: args { search?, limit? } → [{ id, title }]. Przepisy kulinarne.",
  "- get_recipe: args { search? | recipeId? } → { id, title, servings, ingredients:[…], steps:[…] } | null. PEŁNY przepis (składniki + kroki) — do gotowania/analizy jednego przepisu.",
  "- list_cookbooks: args {} → [{ id, name, recipeCount }]. Książki kucharskie.",
  "- list_meal_plan: args { days?, limit? } → [{ id, date, slot, title }]. Zaplanowane posiłki (domyślnie najbliższe 7 dni).",
  "- list_todays_meals: args {} → [{ slot, title }]. Dzisiejsze zaplanowane posiłki.",
  "- list_pantry: args { search?, limit? } → [{ id, name, quantity, unit, expiresAt }]. Spiżarnia.",
  "- list_expiring_pantry: args { days? } → [{ id, name, quantity, unit, expiresAt }]. Produkty w spiżarni z terminem ważności w najbliższych N dniach (domyślnie 7).",
  "- get_meal_plan_cost: args { days? } → { total, currency, … }. Szacowany koszt jadłospisu na N dni (domyślnie 7).",
  "- list_replenish_candidates: args {} → [{ id, name, quantity, unit }]. Produkty spiżarni do automatycznego uzupełnienia (poniżej progu).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_recipes: async (args, userId) => {
      const search = asStr(args.search);
      const recipes = await prisma.recipe.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: clampLimit(args.limit),
      });
      return recipes;
  },
  get_recipe: async (args, userId) => {
      const idOrSlug = asStr(args.recipeId);
      const search = asStr(args.search);
      const recipeOwnerOr = async () => {
        const teamIds = await getUserTeamIds(userId);
        return (await ownedOrAsync(userId));
      };
      let key = idOrSlug;
      // 032: `recipeId` bywa TYTUŁEM przepisu — rozwiąż (id/slug → nazwa), zamiast zwrócić null.
      // Wynik pierwszego trafienia zapamiętujemy, bo `getRecipe` jest pełnym odczytem przepisu
      // (składniki, kroki, obrazki) — wołanie go dwa razy dla tego samego klucza to czysty narzut.
      let resolved: Awaited<ReturnType<typeof getRecipe>> | null = null;
      if (key) {
        key = await resolveIdOrName(
          key,
          "przepisu",
          async (ref) => {
            resolved = await getRecipe(ref); // obsługuje zarówno id, jak i slug
            return resolved ? ref : null;
          },
          async () =>
            prisma.recipe
              .findMany({ where: { OR: await recipeOwnerOr() }, select: { id: true, title: true }, take: HARD_MAX })
              .then((rows) => rows.map((r) => ({ id: r.id, name: r.title })))
        );
      }
      if (!key && search) {
        const r = await prisma.recipe.findFirst({
          where: { OR: await recipeOwnerOr(), title: { contains: search, mode: "insensitive" } },
          select: { id: true },
          orderBy: { updatedAt: "desc" },
        });
        key = r?.id;
      }
      if (!key) return null;
      const recipe = resolved ?? (await getRecipe(key));
      if (!recipe) return null;
      return recipe;
  },
  list_cookbooks: async (args, userId) => {
      const cookbooks = await getCookbooks();
      return cookbooks.map((c) => ({ id: c.id, name: c.name, recipeCount: c.recipeCount }));
  },
  list_meal_plan: async (args, userId) => {
      const days = typeof args.days === "number" ? Math.max(1, Math.min(30, args.days)) : 7;
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + days);
      const entries = await prisma.mealPlanEntry.findMany({
        where: { ...(await ownerScope(userId)), date: { gte: from, lt: to } },
        select: { id: true, date: true, slot: true, customTitle: true, recipe: { select: { title: true } } },
        orderBy: { date: "asc" },
        take: clampLimit(args.limit),
      });
      return entries.map((e) => ({
        id: e.id,
        date: e.date.toISOString().slice(0, 10),
        slot: e.slot,
        title: e.customTitle ?? e.recipe?.title ?? "(posiłek)",
      }));
  },
  list_todays_meals: async (args, userId) => {
      const meals = await getTodaysMeals();
      return meals.map((m) => ({ slot: m.slot, title: m.customTitle ?? m.recipe?.title ?? "(posiłek)" }));
  },
  list_pantry: async (args, userId) => {
      const search = asStr(args.search);
      const items = await prisma.pantryItem.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, quantity: true, unit: true, expiresAt: true },
        orderBy: { name: "asc" },
        take: clampLimit(args.limit),
      });
      return items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        expiresAt: i.expiresAt?.toISOString().slice(0, 10) ?? null,
      }));
  },
  list_expiring_pantry: async (args, userId) => {
      const days = typeof args.days === "number" ? Math.max(1, Math.min(60, args.days)) : 7;
      const items = await getExpiringSoon(days);
      return items.slice(0, clampLimit(args.limit)).map((i) => ({
        id: i.id, name: i.name, quantity: i.quantity, unit: i.unit,
        expiresAt: i.expiresAt ? new Date(i.expiresAt).toISOString().slice(0, 10) : null,
      }));
  },
  get_meal_plan_cost: async (args, userId) => {
      const days = typeof args.days === "number" ? Math.max(1, Math.min(30, args.days)) : 7;
      const from = new Date(); from.setHours(0, 0, 0, 0);
      const to = new Date(from); to.setDate(to.getDate() + days);
      return getMealPlanCost({ from, to });
  },
  list_replenish_candidates: async (args, userId) => {
      const items = await getAutoReplenishCandidates();
      return items.slice(0, clampLimit(args.limit)).map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, unit: i.unit }));
  },
};
