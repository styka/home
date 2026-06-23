import type {
  Recipe as PrismaRecipe,
  RecipeIngredient as PrismaRecipeIngredient,
  RecipeStep as PrismaRecipeStep,
  RecipeImage as PrismaRecipeImage,
  Cookbook as PrismaCookbook,
  MealPlanEntry as PrismaMealPlanEntry,
  PantryItem as PrismaPantryItem,
  Tag,
  Product,
} from "@prisma/client";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type MealType = MealSlot | "dessert";
export type Difficulty = "easy" | "medium" | "hard";
export type MealStatus = "PLANNED" | "COOKED" | "SKIPPED";
export type RecipeSource = "manual" | "url" | "ai" | "ocr" | "image";
export type PantryLocation = "fridge" | "freezer" | "pantry" | "spice_rack" | "other";

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
  dessert: "Deser",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Łatwe",
  medium: "Średnie",
  hard: "Trudne",
};

export type Cookbook = PrismaCookbook;

export type RecipeIngredient = PrismaRecipeIngredient & {
  product?: Product | null;
};

export type RecipeStep = PrismaRecipeStep;

export type RecipeImage = PrismaRecipeImage;

export type RecipeListItem = Pick<
  PrismaRecipe,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "coverImageUrl"
  | "prepMinutes"
  | "cookMinutes"
  | "servings"
  | "difficulty"
  | "cuisine"
  | "mealType"
  | "cookCount"
  | "lastCookedAt"
  | "rating"
  | "ownerId"
  | "ownerTeamId"
  | "cookbookId"
  | "isPublic"
  | "isArchived"
  | "createdAt"
  | "updatedAt"
> & {
  tags: Array<{ tag: Tag }>;
};

export type RecipeFull = PrismaRecipe & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  images: RecipeImage[];
  tags: Array<{ tag: Tag }>;
  cookbook: Cookbook | null;
};

export interface IngredientInput {
  name: string;
  productId?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null; // Z-252: cena za jednostkę (koszt przepisu / porcji)
  groupName?: string | null;
  note?: string | null;
  isOptional?: boolean;
  order?: number;
}

export interface StepInput {
  text: string;
  order?: number;
  durationMin?: number | null;
  temperature?: string | null;
  imageUrl?: string | null;
}

export interface CreateRecipeInput {
  title: string;
  description?: string | null;
  servings?: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  difficulty?: Difficulty;
  cuisine?: string | null;
  mealType?: MealType | null;
  coverImageUrl?: string | null;
  notes?: string | null;
  introMarkdown?: string | null;
  cookbookId?: string | null;
  // K2: wartości odżywcze na 1 porcję.
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  ownerTeamId?: string | null;
  tagIds?: string[];
  ingredients?: IngredientInput[];
  steps?: StepInput[];
}

export type UpdateRecipeInput = Partial<CreateRecipeInput>;

export type MealPlanEntry = PrismaMealPlanEntry;

export type PantryItem = PrismaPantryItem & {
  product?: Product | null;
};
