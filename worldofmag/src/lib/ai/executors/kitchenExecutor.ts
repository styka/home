// Z-010: handler akcji asystenta dla modułu Kuchnia (jadłospis + przepisy + spiżarnia).
// Scala trzy dawne bloki `module === "kitchen"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { setMealPlanEntry, markMealCooked, markMealSkipped, updateMealPlanEntry, moveMealPlanEntry, deleteMealPlanEntry, generateShoppingListFromPlan } from "@/actions/mealPlans";
import { addPantryItem, updatePantryItem, consumePantryItem, deletePantryItem } from "@/actions/pantry";
import { createRecipe, deleteRecipe, updateRecipe, archiveRecipe, duplicateRecipe, markRecipeCooked, shopForRecipe, addIngredient, addStep } from "@/actions/recipes";
import { createCookbook, updateCookbook, deleteCookbook } from "@/actions/cookbooks";
import { asStr, resolveOrCreateList, type ExecOutcome, resolveByName, ownerOrArr } from "@/lib/ai/executors/shared";
import { isoDate } from "@/lib/habitStats";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeKitchenAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "plan_meal") {
    const customTitle = asStr(params.customTitle);
    if (!customTitle) throw new Error("Podaj nazwę posiłku");
    const dateStr = asStr(params.date);
    const date = dateStr ? new Date(dateStr) : new Date();
    const slot = (asStr(params.slot) as "breakfast" | "lunch" | "dinner" | "snack") ?? "dinner";
    await setMealPlanEntry({ date, slot, customTitle });
    const dateLabel = isoDate(date);
    return `Zaplanowano „${customTitle}" na ${dateLabel} (${slot})`;
  }

  if (type === "add_pantry_item") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę produktu");
    const item = await addPantryItem({
      name,
      quantity: params.quantity != null ? Number(params.quantity) : null,
      unit: asStr(params.unit) ?? null,
      expiresAt: params.expiresAt ? new Date(String(params.expiresAt)) : null,
    });
    return `Dodano do spiżarni: ${item.name}`;
  }

  if (type === "create_recipe") {
    const title = asStr(params.title);
    if (!title) throw new Error("Podaj tytuł przepisu");
    const recipe = await createRecipe({
      title,
      description: asStr(params.description) ?? null,
      servings: params.servings != null ? Number(params.servings) : undefined,
      introMarkdown: asStr(params.body) ?? null,
    });
    const msg = `Utworzono przepis „${recipe.title}"`;
    if (params.openAfter === true) return { message: msg, navigateTo: `/kitchen/recipes/${recipe.id}`, navigateLabel: `Otwórz „${recipe.title}"` };
    return msg;
  }

  const teamOr = await ownerOrArr(userId);
  const resolveRecipe = () => resolveByName((w) => prisma.recipe.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.recipeId), "title", searchQuery ?? asStr(params.title), "przepis");
  if (type === "delete_recipe") {
    const id = await resolveRecipe();
    await deleteRecipe(id);
    return `Usunięto przepis`;
  }
  if (type === "update_recipe") {
    const id = await resolveRecipe();
    const patch: Record<string, unknown> = {};
    if (params.newTitle !== undefined) patch.title = String(params.newTitle);
    if (params.description !== undefined) patch.description = asStr(params.description) ?? null;
    if (params.servings !== undefined) patch.servings = Number(params.servings);
    await updateRecipe(id, patch);
    return `Zaktualizowano przepis`;
  }
  if (type === "archive_recipe") {
    const id = await resolveRecipe();
    await archiveRecipe(id);
    return `Zarchiwizowano przepis`;
  }
  if (type === "duplicate_recipe") {
    const id = await resolveRecipe();
    const copy = await duplicateRecipe(id);
    return `Zduplikowano przepis → „${copy.title}"`;
  }
  if (type === "mark_recipe_cooked") {
    const id = await resolveRecipe();
    const r = await prisma.recipe.findUnique({ where: { id }, select: { servings: true } });
    const servings = params.servings != null ? Number(params.servings) : (r?.servings ?? 1);
    await markRecipeCooked(id, servings);
    return `Oznaczono przepis jako ugotowany`;
  }
  if (type === "shop_for_recipe") {
    const id = await resolveRecipe();
    const r = await prisma.recipe.findUnique({ where: { id }, select: { servings: true } });
    const list = await resolveOrCreateList(userId, { listId: asStr(params.listId), listName: asStr(params.listName) });
    const servings = params.servings != null ? Number(params.servings) : (r?.servings ?? 1);
    const res = await shopForRecipe({ recipeId: id, listId: list.id, servings, skipPantry: params.skipPantry !== false });
    const added = res.addedItems?.length ?? 0;
    return `Dodano ${added} ${added === 1 ? "składnik" : "składniki/-ów"} przepisu do listy „${list.name}"`;
  }
  if (type === "add_ingredient") {
    const id = await resolveRecipe();
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę składnika");
    await addIngredient(id, {
      name,
      quantity: params.quantity != null ? Number(params.quantity) : null,
      unit: asStr(params.unit) ?? null,
      note: asStr(params.note) ?? null,
      isOptional: params.isOptional === true,
    });
    return `Dodano składnik „${name}" do przepisu`;
  }
  if (type === "add_step") {
    const id = await resolveRecipe();
    const text = asStr(params.text);
    if (!text) throw new Error("Podaj treść kroku");
    await addStep(id, { text, durationMin: params.durationMin != null ? Number(params.durationMin) : null });
    return `Dodano krok do przepisu`;
  }
  if (type === "mark_meal_cooked") {
    const id = await resolveByName((w) => prisma.mealPlanEntry.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.entryId), "customTitle", searchQuery, "posiłek");
    await markMealCooked(id);
    return `Oznaczono posiłek jako ugotowany`;
  }
  if (type === "delete_meal_plan") {
    const id = await resolveByName((w) => prisma.mealPlanEntry.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.entryId), "customTitle", searchQuery, "posiłek");
    await deleteMealPlanEntry(id);
    return `Usunięto pozycję jadłospisu`;
  }
  if (type === "mark_meal_skipped") {
    const id = await resolveByName((w) => prisma.mealPlanEntry.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.entryId), "customTitle", searchQuery, "posiłek");
    await markMealSkipped(id);
    return `Oznaczono posiłek jako pominięty`;
  }
  if (type === "update_meal_plan_entry") {
    const id = await resolveByName((w) => prisma.mealPlanEntry.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.entryId), "customTitle", searchQuery, "posiłek");
    const patch: Parameters<typeof updateMealPlanEntry>[1] = {};
    if (params.customTitle !== undefined) patch.customTitle = asStr(params.customTitle) ?? null;
    if (params.slot !== undefined) patch.slot = asStr(params.slot) as "breakfast" | "lunch" | "dinner" | "snack";
    await updateMealPlanEntry(id, patch);
    return `Zaktualizowano pozycję jadłospisu`;
  }
  if (type === "move_meal_plan_entry") {
    const id = await resolveByName((w) => prisma.mealPlanEntry.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.entryId), "customTitle", searchQuery, "posiłek");
    const targetDate = params.date ? new Date(String(params.date)) : new Date();
    const targetSlot = (asStr(params.slot) as "breakfast" | "lunch" | "dinner" | "snack") ?? "dinner";
    await moveMealPlanEntry(id, targetDate, targetSlot);
    return `Przeniesiono posiłek na ${isoDate(targetDate)} (${targetSlot})`;
  }
  if (type === "create_cookbook") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę książki kucharskiej");
    const cb = await createCookbook({ name, description: asStr(params.description) ?? null, emoji: asStr(params.emoji) });
    return `Utworzono książkę kucharską „${cb.name}"`;
  }
  if (type === "update_cookbook") {
    const id = await resolveByName((w) => prisma.cookbook.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.cookbookId), "name", searchQuery ?? asStr(params.name), "książka kucharska");
    await updateCookbook(id, { name: asStr(params.name), description: asStr(params.description) ?? null, emoji: asStr(params.emoji) });
    return `Zaktualizowano książkę kucharską`;
  }
  if (type === "delete_cookbook") {
    const id = await resolveByName((w) => prisma.cookbook.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.cookbookId), "name", searchQuery, "książka kucharska");
    await deleteCookbook(id);
    return `Usunięto książkę kucharską`;
  }
  const resolvePantry = () => resolveByName((w) => prisma.pantryItem.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.pantryItemId), "name", searchQuery ?? asStr(params.name), "pozycja spiżarni");
  if (type === "update_pantry_item") {
    const id = await resolvePantry();
    await updatePantryItem(id, { quantity: params.quantity != null ? Number(params.quantity) : undefined, unit: asStr(params.unit), expiresAt: params.expiresAt ? new Date(String(params.expiresAt)) : undefined });
    return `Zaktualizowano pozycję spiżarni`;
  }
  if (type === "consume_pantry") {
    const id = await resolvePantry();
    const qty = Number(params.quantity ?? 1);
    await consumePantryItem(id, qty);
    return `Zużyto ${qty} ze spiżarni`;
  }
  if (type === "delete_pantry_item") {
    const id = await resolvePantry();
    await deletePantryItem(id);
    return `Usunięto pozycję spiżarni`;
  }

  if (type === "generate_shopping_from_plan") {
    // Zbierz składniki z zaplanowanych posiłków na najbliższe N dni do listy zakupów.
    const days = Math.max(1, Math.min(30, Number(params.days ?? 7)));
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + days);
    const list = await resolveOrCreateList(userId, {
      listId: asStr(params.listId),
      listName: asStr(params.listName),
    });
    const res = await generateShoppingListFromPlan({
      from,
      to,
      listId: list.id,
      skipPantry: params.skipPantry !== false,
    });
    const added = res.addedItems.length;
    const skipped = res.skippedFromPantry.length;
    return `Dodano ${added} ${added === 1 ? "pozycję" : "pozycji"} do listy "${list.name}" z jadłospisu na ${days} dni` +
      (skipped > 0 ? ` (pominięto ${skipped} — masz w spiżarni)` : "");
  }

  throw new Error(`Nieznany typ akcji kuchni: ${type}`);
}
