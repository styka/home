/**
 * Kontrakt modułu **Kuchnia** (przepisy, książki kucharskie, plan posiłków, spiżarnia).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/kitchen/*` poza `contract`.
 *
 * Konsumenci:
 * - **pulpit** (`app/page.tsx`) → `getTodaysMeals`, `getExpiringSoon`,
 * - **narzędzia odczytu asystenta** → `getCookbooks`, `getRecipe`, `getMealPlanCost`,
 *   `getTodaysMeals`, `getExpiringSoon`, `getAutoReplenishCandidates`,
 * - **egzekutor akcji asystenta** → przepisy, plan, spiżarnia, książki (największy zestaw),
 * - **trasa AI „ugotuj ze spiżarni"** → `getPantry`, `getRecipes`,
 * - **test izolacji najemcy** → guardy `assertRecipeAccess`, `assertCookbookAccess`.
 *
 * Guardy w kontrakcie to **świadomy wyjątek**: test izolacji najemcy jest z założenia generowany
 * i sprawdza wszystkie moduły jednakowo, więc musi je widzieć. Wystawienie guardu nie osłabia
 * niczego — on nadal robi dokładnie to samo sprawdzenie.
 *
 * **Kuchnia jest też konsumentem Zakupów** (`assertListAccess` przy „kup na to zakupy") oraz
 * słownika tagów, który świadomie został poza modułami (Notatki używają tego samego).
 */

// 115 (Z-INT-16): deklaracja modułu dla konsumentów sprawdzających uprawnienie
// `module.kitchen` przed dopisaniem do spiżarni (wzorzec `tasksModule`/`notesModule`).
export { default as kitchenModule } from "./module";

export {
  // przepisy
  getRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  archiveRecipe,
  duplicateRecipe,
  markRecipeCooked,
  shopForRecipe,
  addIngredient,
  addStep,
  assertRecipeAccess,
} from "./actions/recipes";

export {
  // książki kucharskie
  getCookbooks,
  createCookbook,
  updateCookbook,
  deleteCookbook,
  assertCookbookAccess,
} from "./actions/cookbooks";

export {
  // plan posiłków
  getTodaysMeals,
  getMealPlanCost,
  setMealPlanEntry,
  updateMealPlanEntry,
  moveMealPlanEntry,
  deleteMealPlanEntry,
  markMealCooked,
  markMealSkipped,
  generateShoppingListFromPlan,
} from "./actions/mealPlans";

export {
  // spiżarnia
  getPantry,
  getExpiringSoon,
  getAutoReplenishCandidates,
  addPantryItem,
  updatePantryItem,
  setPantryQuantity,
  consumePantryItem,
  deletePantryItem,
  moveItemToPantry,
  autoReplenishToList,
} from "./actions/pantry";
