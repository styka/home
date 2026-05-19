/** Specific items to draw per grocery category — used in LLM prompts and UI hint pre-fill. */
export const CATEGORY_ITEMS: Record<string, string[]> = {
  "Produce":            ["carrot", "apple", "broccoli", "tomato", "onion", "lettuce", "avocado", "lemon"],
  "Dairy & Eggs":       ["milk bottle", "cheese wheel", "butter block", "egg", "yogurt jar", "cream"],
  "Meat & Fish":        ["steak", "chicken leg", "fish", "bacon strips", "sausage", "shrimp"],
  "Bakery":             ["loaf of bread", "croissant", "baguette", "donut", "muffin", "pretzel"],
  "Dry Goods & Pasta":  ["pasta bowl", "rice bag", "flour sack", "beans", "cereal box", "lentils"],
  "Drinks":             ["water bottle", "coffee cup", "juice box", "wine glass", "beer mug", "tea cup"],
  "Frozen":             ["ice cube", "frozen bag", "ice cream", "snowflake", "frozen peas", "popsicle"],
  "Snacks & Sweets":    ["chocolate bar", "candy", "chips bag", "cookie", "popcorn", "gummy bears"],
  "Condiments & Oils":  ["olive oil bottle", "ketchup", "mustard jar", "honey jar", "salt shaker", "vinegar"],
  "Spices & Herbs":     ["basil leaf", "pepper grinder", "cinnamon stick", "garlic", "chili pepper", "herb bundle"],
  "Cleaning & Hygiene": ["soap bar", "shampoo bottle", "toothbrush", "toilet paper roll", "cleaning spray", "sponge"],
  "Canned & Preserved": ["tin can", "glass jar", "preserved tomatoes", "canned beans", "pickle jar"],
  "Other":              ["shopping bag", "box", "label", "price tag", "shopping cart"],
};

/** Returns a comma-separated hint string for category-specific generation (pre-fills additionalText). */
export function getCategoryHints(category: string): string {
  const items = CATEGORY_ITEMS[category];
  if (!items || items.length === 0) return "";
  return items.slice(0, 6).join(", ");
}
