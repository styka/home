// Z-010: handler akcji asystenta dla modułu Kuchnia (jadłospis + przepisy + spiżarnia).
// Scala trzy dawne bloki `module === "kitchen"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { setMealPlanEntry, markMealCooked, deleteMealPlanEntry, generateShoppingListFromPlan } from "@/actions/mealPlans";
import { addPantryItem, updatePantryItem, consumePantryItem, deletePantryItem } from "@/actions/pantry";
import { createRecipe, deleteRecipe } from "@/actions/recipes";
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
  if (type === "delete_recipe") {
    const id = await resolveByName((w) => prisma.recipe.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.recipeId), "title", searchQuery, "przepis");
    await deleteRecipe(id);
    return `Usunięto przepis`;
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
