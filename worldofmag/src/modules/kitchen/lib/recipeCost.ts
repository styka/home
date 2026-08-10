// Z-252: koszt przepisu i koszt porcji z cen jednostkowych składników.
//
// Czysta logika (bez DB) — sumuje `quantity * unitPrice` po składnikach, które
// mają podaną cenę. Składniki bez ceny są pomijane w sumie, ale liczone do
// `totalCount`, by UI mogło pokazać „koszt częściowy" (np. 3 z 7 wycenionych).

export interface CostIngredient {
  quantity?: number | null;
  unitPrice?: number | null;
  isOptional?: boolean | null;
}

export interface RecipeCost {
  total: number; // koszt całego przepisu (suma wycenionych składników)
  perServing: number; // koszt na porcję
  pricedCount: number; // ile składników ma cenę
  totalCount: number; // ile składników łącznie
  complete: boolean; // czy wszystkie (nieopcjonalne) składniki są wycenione
}

/**
 * Liczy koszt przepisu. `unitPrice` to cena za jednostkę składnika, więc koszt
 * pozycji = `quantity * unitPrice` (gdy brak `quantity`, przyjmujemy 1 — np.
 * „1 opakowanie" wpisane bez ilości). Składniki opcjonalne wliczają się do
 * kosztu, ale nie wpływają na `complete` (kompletność wyceny obowiązkowych).
 */
export function computeRecipeCost(ingredients: CostIngredient[], servings: number): RecipeCost {
  let total = 0;
  let pricedCount = 0;
  let missingRequired = 0;
  for (const ing of ingredients) {
    const hasPrice = typeof ing.unitPrice === "number" && isFinite(ing.unitPrice) && ing.unitPrice >= 0;
    if (hasPrice) {
      const qty = typeof ing.quantity === "number" && isFinite(ing.quantity) && ing.quantity > 0 ? ing.quantity : 1;
      total += qty * (ing.unitPrice as number);
      pricedCount++;
    } else if (!ing.isOptional) {
      missingRequired++;
    }
  }
  const safeServings = servings > 0 ? servings : 1;
  return {
    total: round2(total),
    perServing: round2(total / safeServings),
    pricedCount,
    totalCount: ingredients.length,
    complete: pricedCount > 0 && missingRequired === 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
