-- Moduł Kuchnia: 4 dokumenty przygotowawcze (architektura, UX, analiza, raport końcowy)
-- Dollar-quoting — bezpieczny dla dużej zawartości markdown
-- authorId = NULL → publiczne/systemowe, widoczne w /admin/reports

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Kuchnia — Dokument architektoniczny',
  'kitchen-architecture-2026-05-20',
  $kitchen_architecture_2026_05_20$# Kuchnia — Dokument architektoniczny

**Wersja:** 1.0 (draft do implementacji)
**Data:** 2026-05-20
**Status:** Do zatwierdzenia przed implementacją
**Autor:** Claude Code (sesja przygotowawcza)

---

## 1. Streszczenie zarządcze

Dokument opisuje pełną architekturę nowego działu **„Kuchnia"** (`/kitchen`) — modułu zarządzania przepisami, planowania posiłków, spiżarni oraz głębokiej integracji z istniejącym działem Zakupów. Decyzja architektoniczna: zamiast tworzyć dwa osobne moduły („Receptury" + „Żywienie"), tworzymy **jeden parasolowy moduł Kuchnia** z czterema spójnymi podstronami. Uzasadnienie w §2.

Moduł dodaje **6 nowych modeli Prisma**, **4 nowe pliki Server Actions**, **1 nową ścieżkę główną** (`/kitchen` z podstronami), **1 nowy zestaw uprawnień** oraz integruje się punktowo z istniejącym kodem Zakupów (przede wszystkim `items.ts` i `lists.ts`). Nie wprowadza żadnych breaking changes w istniejących modułach.

---

## 2. Decyzja: jeden moduł czy dwa?

### Rozważane opcje

| Opcja | Plusy | Minusy |
|-------|-------|--------|
| A. Jeden moduł „Kuchnia" zawierający przepisy + plan posiłków + spiżarnię | Wspólny model danych, naturalna nawigacja, jedna ikona w sidebarze, prostsze AI (wspólny kontekst), mniej duplikacji UI | Większy moduł, więcej w jednym miejscu |
| B. Dwa moduły: „Przepisy" + „Żywienie" | Mniejsza odpowiedzialność każdego modułu | Duplikacja modeli (Składnik, Posiłek, jednostki), trudniej integrować, sztuczny podział, dwa pozycje w sidebarze blisko siebie |
| C. Moduł „Jedzenie" z podstronami | To samo co A pod inną nazwą | — |

### Wybór: Opcja A — moduł `Kuchnia`

**Uzasadnienie:**
1. Przepis bez planowania posiłków to tylko biblioteka tekstów — wartość wyrasta z połączenia.
2. Plan posiłków bez przepisów to kalendarz — niewiele lepszy niż Zadania.
3. Spiżarnia bez planu i przepisów to lista — niewiele lepsza niż Zakupy.
4. AI ma sens dopiero gdy może łączyć: „masz brokuł i kurczaka → zaproponuj przepis → wygeneruj listę zakupów na brakujące składniki → wstaw posiłek do planu".
5. Trzymanie wszystkiego pod jedną ikoną redukuje liczbę pozycji w sidebarze (już mamy 4 aktywne moduły).

### Nazewnictwo w UI

- Polskie: **Kuchnia**
- Ikona: `ChefHat` (lucide-react), kolor `--accent-orange` (nowy token, dodać)
- URL: `/kitchen`
- Podstrony:
  - `/kitchen/recipes` — biblioteka przepisów (domyślna)
  - `/kitchen/recipes/[recipeId]` — widok przepisu
  - `/kitchen/recipes/new` — nowy przepis
  - `/kitchen/plan` — plan posiłków na tydzień/miesiąc
  - `/kitchen/pantry` — spiżarnia (stan magazynowy)
  - `/kitchen/cookbooks` — kolekcje/książki kucharskie
  - `/kitchen/import` — import z URL/zdjęcia/AI

---

## 3. Schemat bazy danych

### 3.1 Nowe modele Prisma

```prisma
// ─── Kitchen / Recipes ─────────────────────────────────────────────────────

model Recipe {
  id           String   @id @default(cuid())
  title        String
  slug         String   @unique
  description  String?            // krótki opis 1-2 zdania
  // sekcje treści przepisu (przygotowanie)
  introMarkdown String? @default("")  // wstęp narratora, opcjonalny
  notes        String? @default("")   // notatki kucharza (po przepisie)
  // metadane
  servings     Int      @default(2)
  prepMinutes  Int?                    // czas przygotowania
  cookMinutes  Int?                    // czas gotowania
  difficulty   String   @default("easy")  // "easy" | "medium" | "hard"
  cuisine      String?                 // "polska" | "włoska" | "azjatycka" | ...
  mealType     String?                 // "breakfast" | "lunch" | "dinner" | "snack" | "dessert"
  // media
  coverImageUrl String?               // główne zdjęcie
  // własność (zgodnie z wzorcem z innych modułów)
  ownerId      String?
  ownerTeamId  String?
  cookbookId   String?                // opcjonalna przynależność do kolekcji
  // statystyki
  cookCount    Int      @default(0)   // ile razy ugotowane
  lastCookedAt DateTime?
  rating       Float?                 // 1-5
  // import
  sourceUrl    String?                // jeśli zaimportowane z neta
  sourceType   String   @default("manual")  // "manual" | "url" | "ai" | "ocr" | "image"
  // flagi
  isPublic     Boolean  @default(false)  // publiczne == widoczne dla wszystkich userów
  isArchived   Boolean  @default(false)
  // timestamps
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  owner        User?               @relation("OwnedRecipes", fields: [ownerId], references: [id], onDelete: SetNull)
  ownerTeam    Team?               @relation("TeamRecipes", fields: [ownerTeamId], references: [id], onDelete: SetNull)
  cookbook     Cookbook?           @relation(fields: [cookbookId], references: [id], onDelete: SetNull)
  ingredients  RecipeIngredient[]
  steps        RecipeStep[]
  images       RecipeImage[]
  tags         RecipeTag[]
  plannedMeals MealPlanEntry[]
  ratings      RecipeRating[]

  @@index([ownerId])
  @@index([ownerTeamId])
  @@index([cookbookId])
  @@index([mealType, difficulty])
}

model RecipeIngredient {
  id           String   @id @default(cuid())
  recipeId     String
  // odniesienie do Product z modułu Shopping (pozwala na podpowiedzi i merge składników)
  productId    String?
  // ZAWSZE pole tekstowe — fallback gdy productId nie istnieje
  name         String
  quantity     Float?
  unit         String?
  // grupowanie składników (np. "Marynata", "Sos", "Główne")
  groupName    String?
  // pozycja sortowania w danej grupie
  order        Int      @default(0)
  // notatka do składnika ("posiekane", "schłodzone")
  note         String?
  // opcjonalność (np. "topping" — można pominąć)
  isOptional   Boolean  @default(false)

  recipe       Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  product      Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([recipeId])
  @@index([productId])
}

model RecipeStep {
  id          String   @id @default(cuid())
  recipeId    String
  order       Int
  text        String              // markdown
  imageUrl    String?             // zdjęcie do kroku (opcjonalne)
  durationMin Int?                // timer dla tego kroku
  temperature String?             // np. "180°C", "low"

  recipe      Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@index([recipeId, order])
}

model RecipeImage {
  id        String   @id @default(cuid())
  recipeId  String
  url       String
  caption   String?
  order     Int      @default(0)
  isCover   Boolean  @default(false)

  recipe    Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@index([recipeId])
}

model RecipeTag {
  recipeId String
  tagId    String
  recipe   Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  tag      Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([recipeId, tagId])
}

model RecipeRating {
  id        String   @id @default(cuid())
  recipeId  String
  userId    String
  value     Int      // 1..5
  comment   String?
  createdAt DateTime @default(now())

  recipe    Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([recipeId, userId])
}

model Cookbook {
  id          String   @id @default(cuid())
  name        String
  description String?
  emoji       String   @default("📚")
  color       String?
  ownerId     String?
  ownerTeamId String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner       User?    @relation("OwnedCookbooks", fields: [ownerId], references: [id], onDelete: SetNull)
  ownerTeam   Team?    @relation("TeamCookbooks", fields: [ownerTeamId], references: [id], onDelete: SetNull)
  recipes     Recipe[]

  @@index([ownerId])
  @@index([ownerTeamId])
}

// ─── Meal planning ─────────────────────────────────────────────────────────

model MealPlanEntry {
  id          String   @id @default(cuid())
  date        DateTime               // YYYY-MM-DD (north-noon to avoid TZ drift)
  slot        String                 // "breakfast" | "lunch" | "dinner" | "snack"
  recipeId    String?                // nullable: pozwala wpisać "obiad u rodziców" bez przepisu
  customTitle String?                // gdy bez przepisu
  servings    Int      @default(2)
  notes       String?
  ownerId     String?
  ownerTeamId String?
  // status realizacji
  status      String   @default("PLANNED")  // "PLANNED" | "COOKED" | "SKIPPED"
  cookedAt    DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  recipe      Recipe?  @relation(fields: [recipeId], references: [id], onDelete: SetNull)
  owner       User?    @relation("OwnedMealPlans", fields: [ownerId], references: [id], onDelete: SetNull)
  ownerTeam   Team?    @relation("TeamMealPlans", fields: [ownerTeamId], references: [id], onDelete: SetNull)

  @@index([ownerId, date])
  @@index([ownerTeamId, date])
  @@index([date])
}

// ─── Pantry (Spiżarnia) ────────────────────────────────────────────────────

model PantryItem {
  id          String    @id @default(cuid())
  // ten sam wzorzec co RecipeIngredient: productId opcjonalny, name fallback
  productId   String?
  name        String
  quantity    Float?
  unit        String?
  location    String?               // "lodówka" | "spiżarnia" | "zamrażarka" | ...
  // daty
  addedAt     DateTime  @default(now())
  expiresAt   DateTime?
  openedAt    DateTime?             // gdy otwarte (np. mleko po otwarciu szybciej się psuje)
  // własność
  ownerId     String?
  ownerTeamId String?
  // automatyzacja
  minQuantity Float?                // próg "kup uzupełnienie" (autoreplenish)
  autoShop    Boolean  @default(false)  // jeśli spadnie poniżej min — automatycznie dodać do domyślnej listy

  product     Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  owner       User?    @relation("OwnedPantryItems", fields: [ownerId], references: [id], onDelete: Cascade)
  ownerTeam   Team?    @relation("TeamPantryItems", fields: [ownerTeamId], references: [id], onDelete: Cascade)

  @@index([ownerId])
  @@index([ownerTeamId])
  @@index([productId])
  @@index([expiresAt])
}

// ─── Linkowanie: zakupy do przepisu ────────────────────────────────────────
// Pozwala później wiedzieć "te pozycje na liście trafiły z przepisu X"
// (przyciski undo, ponowne dodanie, statystyki "ile razy gotowane")
model ItemRecipeOrigin {
  itemId    String   @id
  recipeId  String
  // ile porcji przepisu wygenerowało ten item
  servings  Int      @default(2)
  // odniesienie do konkretnego składnika (gdy chcemy się cofnąć)
  ingredientId String?

  item      Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  recipe    Recipe   @relation("ItemsFromRecipe", fields: [recipeId], references: [id], onDelete: SetNull)

  @@index([recipeId])
}
```

### 3.2 Modyfikacje istniejących modeli

```prisma
model User {
  // ...istniejące pola...
  recipes        Recipe[]         @relation("OwnedRecipes")
  cookbooks      Cookbook[]       @relation("OwnedCookbooks")
  mealPlans      MealPlanEntry[]  @relation("OwnedMealPlans")
  pantryItems    PantryItem[]     @relation("OwnedPantryItems")
  recipeRatings  RecipeRating[]
}

model Team {
  // ...istniejące pola...
  recipes      Recipe[]         @relation("TeamRecipes")
  cookbooks    Cookbook[]       @relation("TeamCookbooks")
  mealPlans    MealPlanEntry[]  @relation("TeamMealPlans")
  pantryItems  PantryItem[]     @relation("TeamPantryItems")
}

model Product {
  // ...istniejące pola...
  recipeIngredients RecipeIngredient[]
  pantryItems       PantryItem[]
}

model Tag {
  // ...istniejące pola...
  recipes  RecipeTag[]
}

model Item {
  // ...istniejące pola...
  recipeOrigin ItemRecipeOrigin?
}

model Recipe {
  // (zdefiniowane wyżej, dodajemy:)
  itemsGenerated ItemRecipeOrigin[] @relation("ItemsFromRecipe")
}
```

### 3.3 Decyzje schematyczne — uzasadnienia

| Decyzja | Uzasadnienie |
|---------|--------------|
| `RecipeIngredient.productId` jest **nullable**, `name` **wymagane** | Pozwala wpisywać luźne składniki bez wymuszania kompletności katalogu Produktów. Gdy productId istnieje — można podpowiadać jednostkę domyślną, ikonę kategorii, sugerować zakupy. |
| `MealPlanEntry.recipeId` nullable + `customTitle` | Realny use-case: „obiad u babci", „pizza na wynos" — nie zawsze chcemy mieć przepis. |
| `Recipe.slug` **unique globalnie** | Spójne z `Report.slug`, pozwala URL-e typu `/kitchen/recipes/spaghetti-carbonara`. Slugify w Server Action. |
| `RecipeStep` osobny model (nie JSON w Recipe) | Pozwala na timery per krok, zdjęcia do kroków, sortowanie drag-and-drop bez race condition na całym przepisie. |
| `RecipeImage` osobny model | Galeria, zdjęcia procesu, możliwość zmiany cover bez edycji przepisu. |
| `Cookbook` zamiast „category" na przepisie | Książki kucharskie to bardziej naturalne grupowanie niż jedna kategoria. Tagi pokrywają „rodzaj" (wegetariańskie, szybkie). |
| Wspólny `Tag` z modułem Notes | Tagi są transwersalne (np. „włoska") — sensowniej dzielić niż duplikować. Już istnieje `model Tag` w schemacie. |
| `PantryItem` osobny od `Item` | Inna logika cyklu życia (kupione → posiadane → zużyte). Item to lista zakupów. PantryItem to stan. |
| `ItemRecipeOrigin` zamiast pól w `Item` | Brak ingerencji w istniejący model Item. Soft-link, łatwo cofnąć integrację jeśli zajdzie potrzeba. |
| Brak Prisma enum dla `mealType`, `slot`, `status` | Spójnie z `Item.status` — SQLite nie obsługuje enum. TypeScript union enforce'uje na poziomie kodu. |

### 3.4 TypeScript unions (zamiast Prisma enum)

```typescript
// src/types/kitchen.ts
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
```

### 3.5 Migracja Prismy

Plan migracji jako jedna atomowa migracja `0017_kitchen_module`:

1. CREATE TABLE dla 8 nowych modeli (`Recipe`, `RecipeIngredient`, `RecipeStep`, `RecipeImage`, `RecipeTag`, `RecipeRating`, `Cookbook`, `MealPlanEntry`, `PantryItem`, `ItemRecipeOrigin`).
2. ALTER TABLE `User`, `Team`, `Product`, `Tag`, `Item` — tylko dodanie relations (relacje są wirtualne w Prisma, nie wymagają zmian SQL).
3. CREATE INDEX dla zdefiniowanych indeksów.
4. Brak seeda obowiązkowego — opcjonalny `seedRecipes()` w `prisma/seed.ts` (pominąć w MVP, dodać 5-10 przepisów-testowych w v1.1).

---

## 4. Routing i struktura plików

### 4.1 Routing (Next.js App Router)

```
src/app/kitchen/
├── layout.tsx                          # Wspólny layout: tabbed nav (Przepisy | Plan | Spiżarnia | Książki)
├── page.tsx                            # Redirect → /kitchen/recipes
├── recipes/
│   ├── page.tsx                        # Lista przepisów (filtry, search)
│   ├── new/page.tsx                    # Tworzenie nowego (3 metody: manual, URL, AI)
│   ├── import/page.tsx                 # Wybór metody importu (URL, zdjęcie, AI prompt)
│   └── [recipeId]/
│       ├── page.tsx                    # Widok przepisu (read-only, „cook mode")
│       ├── edit/page.tsx               # Edycja
│       └── cook/page.tsx               # Cook Mode — fullscreen, krok po kroku
├── plan/
│   ├── page.tsx                        # Plan tygodnia (default)
│   └── month/page.tsx                  # Widok miesiąca
├── pantry/
│   ├── page.tsx                        # Lista spiżarniana
│   └── stocktake/page.tsx              # Tryb inwentaryzacji
└── cookbooks/
    ├── page.tsx                        # Lista książek kucharskich
    └── [cookbookId]/page.tsx           # Książka kucharska
```

### 4.2 Komponenty (`src/components/kitchen/`)

```
src/components/kitchen/
├── KitchenLayout.tsx                   # Wspólny layout z tabbar
├── KitchenSideNav.tsx                  # Boczna nawigacja (jeśli wybierzemy sidebar wewn.)
├── recipes/
│   ├── RecipeList.tsx                  # Grid/lista przepisów
│   ├── RecipeCard.tsx                  # Karta przepisu (zdjęcie, czas, tagi)
│   ├── RecipeFilters.tsx               # Filtry (cuisine, tagi, czas, składniki)
│   ├── RecipeView.tsx                  # Wyświetlanie pełnego przepisu
│   ├── RecipeEditor.tsx                # Edytor (formularz)
│   ├── IngredientList.tsx              # Edycja składników z autocomplete na Product
│   ├── IngredientRow.tsx               # Pojedyncza linijka składnika
│   ├── StepList.tsx                    # Edycja kroków (DnD)
│   ├── StepRow.tsx                     # Pojedynczy krok
│   ├── CookMode.tsx                    # Tryb gotowania (fullscreen, timer, voice)
│   ├── CookModeStep.tsx                # Wyświetlanie jednego kroku w trybie cook
│   ├── ScaleSelector.tsx               # Zmiana porcji (z przeliczeniem składników)
│   ├── ShopForRecipeDialog.tsx         # „Zrób zakupy do tego przepisu" — wybór listy + porcje
│   ├── ImportFromUrl.tsx               # Import z URL (z parserem)
│   ├── ImportFromImage.tsx             # Import ze zdjęcia (OCR + LLM)
│   ├── ImportFromAI.tsx                # Generacja przepisu z promptu
│   └── RecipePage.tsx                  # Server entry
├── plan/
│   ├── MealPlanWeek.tsx                # Widok tygodnia (7 kolumn × 4 sloty)
│   ├── MealPlanMonth.tsx               # Widok miesiąca
│   ├── MealPlanSlot.tsx                # Komórka dnia/slot (drag target)
│   ├── MealPlanDrawer.tsx              # Drawer z propozycjami przepisów (drag source)
│   ├── ShoppingFromPlanDialog.tsx      # „Wygeneruj listę zakupów na ten tydzień"
│   └── AISuggestionPanel.tsx           # AI: zaproponuj plan na tydzień
├── pantry/
│   ├── PantryList.tsx                  # Lista produktów ze stanem
│   ├── PantryRow.tsx                   # Wiersz produktu
│   ├── PantryFilters.tsx               # Filtr po lokalizacji + „zbliża się termin"
│   ├── StockTakeMode.tsx               # Tryb inwentaryzacji (szybki zliczacz)
│   ├── ExpiringSoon.tsx                # Widget: kończy się termin
│   └── AutoReplenishConfig.tsx         # Konfiguracja autoreplenish per produkt
├── cookbooks/
│   ├── CookbookList.tsx
│   ├── CookbookCard.tsx
│   └── CookbookEditor.tsx
└── shared/
    ├── TagPicker.tsx                   # Współdzielony z Notes
    ├── DurationInput.tsx               # Input prep+cook time
    └── ServingSelector.tsx             # 1, 2, 4, 6, 8, custom
```

### 4.3 Server Actions (`src/actions/`)

```
src/actions/
├── recipes.ts        # CRUD przepisów + ingredient/step mgmt + shopForRecipe
├── cookbooks.ts      # CRUD książek kucharskich
├── mealPlans.ts      # CRUD wpisów planu posiłków + generowanie zakupów
└── pantry.ts         # CRUD spiżarni + auto-replenish + integracja "kupiłem → dodaj do spiżarni"
```

#### 4.3.1 `recipes.ts` — kontrakt

```typescript
// listing
export async function getRecipes(opts?: {
  search?: string;
  tagIds?: string[];
  cookbookId?: string;
  cuisine?: string;
  mealType?: MealType;
  maxMinutes?: number;
  ownedOnly?: boolean;
}): Promise<RecipeListItem[]>

// detail
export async function getRecipe(slugOrId: string): Promise<RecipeFull | null>

// CRUD
export async function createRecipe(data: CreateRecipeInput): Promise<Recipe>
export async function updateRecipe(id: string, data: UpdateRecipeInput): Promise<Recipe>
export async function deleteRecipe(id: string): Promise<void>
export async function archiveRecipe(id: string): Promise<void>
export async function duplicateRecipe(id: string): Promise<Recipe>

// składniki/kroki (osobne akcje dla DnD i częstych edycji)
export async function addIngredient(recipeId: string, data: IngredientInput): Promise<RecipeIngredient>
export async function updateIngredient(id: string, data: IngredientInput): Promise<RecipeIngredient>
export async function deleteIngredient(id: string): Promise<void>
export async function reorderIngredients(recipeId: string, orderedIds: string[]): Promise<void>

export async function addStep(recipeId: string, data: StepInput): Promise<RecipeStep>
export async function updateStep(id: string, data: StepInput): Promise<RecipeStep>
export async function deleteStep(id: string): Promise<void>
export async function reorderSteps(recipeId: string, orderedIds: string[]): Promise<void>

// integracja z zakupami
export async function shopForRecipe(input: {
  recipeId: string;
  listId: string;
  servings: number;
  skipPantry: boolean;       // jeśli false → odejmie zawartość spiżarni
  skipOptional: boolean;
  ingredientOverrides?: Array<{ ingredientId: string; include: boolean; quantity?: number }>;
}): Promise<{ addedItems: Item[]; skippedFromPantry: Array<{ name: string; quantity: number }> }>

// statystyki gotowania
export async function markRecipeCooked(id: string, servings: number): Promise<void>

// import
export async function importRecipeFromUrl(url: string): Promise<Recipe>
export async function importRecipeFromImage(imageBase64: string): Promise<Recipe>
export async function generateRecipeFromPrompt(prompt: string): Promise<Recipe>

// AI helpers
export async function suggestIngredientsFromText(text: string): Promise<IngredientSuggestion[]>
export async function categorizeAndCleanRecipe(recipeId: string): Promise<Recipe>
```

#### 4.3.2 `mealPlans.ts` — kontrakt

```typescript
export async function getMealPlan(range: { from: Date; to: Date }, teamId?: string): Promise<MealPlanEntry[]>

export async function setMealPlanEntry(data: {
  date: Date;
  slot: MealSlot;
  recipeId?: string;
  customTitle?: string;
  servings: number;
  teamId?: string;
}): Promise<MealPlanEntry>

export async function updateMealPlanEntry(id: string, data: Partial<MealPlanEntryInput>): Promise<MealPlanEntry>
export async function deleteMealPlanEntry(id: string): Promise<void>
export async function markMealCooked(id: string): Promise<void>
export async function markMealSkipped(id: string): Promise<void>

// generacja listy zakupów na cały zakres planu
export async function generateShoppingListFromPlan(input: {
  from: Date;
  to: Date;
  listId: string;       // gdzie wrzucić
  skipPantry: boolean;
  consolidate: boolean; // łącz duplikaty (np. cebula w 3 przepisach → 3 szt)
}): Promise<{ addedItems: Item[]; skippedFromPantry: Array<{ name: string; quantity: number }>; mergedCount: number }>

// AI: zaproponuj plan na tydzień
export async function suggestWeekPlan(input: {
  weekStart: Date;
  constraints?: {
    avoidIngredients?: string[];
    cuisinePreference?: string[];
    maxMinutesPerMeal?: number;
    mustUsePantry?: boolean;       // priorytetyzuj przepisy używające produktów ze spiżarni
    repeatRecipesOk?: boolean;
  };
}): Promise<MealPlanSuggestion[]>
```

#### 4.3.3 `pantry.ts` — kontrakt

```typescript
export async function getPantry(teamId?: string): Promise<PantryItem[]>
export async function addPantryItem(data: PantryItemInput): Promise<PantryItem>
export async function updatePantryItem(id: string, data: Partial<PantryItemInput>): Promise<PantryItem>
export async function deletePantryItem(id: string): Promise<void>

// szybkie operacje
export async function consumePantryItem(id: string, quantity: number): Promise<PantryItem>  // np. po ugotowaniu
export async function setPantryQuantity(id: string, quantity: number): Promise<PantryItem>  // tryb inwentaryzacji

// integracja z Zakupami
export async function moveItemToPantry(itemId: string, pantryData?: Partial<PantryItemInput>): Promise<PantryItem>
// auto-hook: gdy Item.status → DONE → utwórz/uzupełnij PantryItem (konfigurowalne)

// auto-replenish
export async function getAutoReplenishCandidates(): Promise<PantryItem[]>  // < minQuantity
export async function autoReplenishToList(listId: string): Promise<{ addedItems: Item[] }>

// expiring soon
export async function getExpiringSoon(days: number): Promise<PantryItem[]>
```

### 4.4 React hooks

```
src/hooks/
├── useRecipes.ts            # SWR-style fetcher dla listy
├── useRecipe.ts             # Detail
├── useMealPlanWeek.ts       # Plan na tydzień (z optimistic update)
├── usePantry.ts             # Spiżarnia
└── useCookMode.ts           # State machine trybu gotowania (timer, krok)
```

---

## 5. Integracja z istniejącymi modułami

### 5.1 Integracja z modułem Zakupy (Shopping)

#### 5.1.1 „Zrób zakupy do tego przepisu" — flow

```
[Recipe View] 
  → button „Dodaj składniki do listy zakupów"
  → ShopForRecipeDialog:
      - wybór listy (dropdown z istniejących)
      - liczba porcji (default = recipe.servings)
      - checkbox „Pomiń to co mam w spiżarni" (default ON)
      - checkbox „Pomiń składniki opcjonalne" (default OFF)
      - lista składników z checkboxami (default ON, oznacz to co już jest w spiżarni)
      - dla każdego: edytowalna ilość
  → Server Action: shopForRecipe()
  → revalidate /shopping/[listId]
  → toast: „Dodano X pozycji. Y pominięto (jest w spiżarni)."
  → opcja „Cofnij" (5 sekund) — usuwa dodane Item-y po itemRecipeOrigin
```

#### 5.1.2 Mapowanie składnik → pozycja zakupowa

```typescript
function ingredientToShoppingItem(ing: RecipeIngredient, servings: number): NewItem {
  const scale = servings / recipe.servings;
  return {
    name: ing.product?.name ?? ing.name,
    quantity: ing.quantity ? ing.quantity * scale : undefined,
    unit: ing.unit ?? ing.product?.defaultUnit ?? undefined,
    category: ing.product?.category ?? categorize(ing.name),
    // soft-link
    recipeOrigin: { recipeId: recipe.id, servings, ingredientId: ing.id },
  };
}
```

#### 5.1.3 Konsolidacja przy planie tygodnia

Gdy generujemy listę z planu (np. 3 przepisy używają cebulę), używamy klucza (`productId` || `lowercase(name)`, `unit`) i sumujemy ilości. Pozycje bez wspólnego klucza zostają osobno.

#### 5.1.4 Auto-uzupełnianie spiżarni po zakupie

Hook na zmianę `Item.status` → `DONE` lub `IN_CART` (konfigurowalne w settings):
- jeśli item ma `productId` → znajdź `PantryItem` z tym `productId` → zwiększ `quantity` o `item.quantity`
- jeśli nie ma `PantryItem` → utwórz nowy
- ustawienia: domyślny `location`, domyślne `expiresAt` na podstawie kategorii Product (np. nabiał → 7 dni)

**Decyzja:** Auto-feed do spiżarni jest **opt-in** w settings użytkownika (`autoFillPantryOnPurchase`). MVP — wyłączone. Po feedbacku userów — pomyśleć o domyślnym włączeniu.

### 5.2 Integracja z modułem Notes

- Pole `Recipe.notes` to markdown — używamy tej samej logiki renderu co Notes (`isMarkdown`).
- Tagi (`Tag` model) są współdzielone — tag „włoska" na przepisie i notatce to ta sama encja.
- W przyszłości: „skopiuj jako notatkę" / „skopiuj z notatki jako przepis" (parsowanie LLM).

### 5.3 Integracja z modułem Tasks

- Wpis MealPlanEntry można opcjonalnie wyświetlać jako Task na danej liście „Posiłki tygodnia" (one-way sync).
- W v2.0: przepis może mieć `prepTasks: TaskTemplate[]` → np. „marynować mięso wieczorem dzień wcześniej" auto-tworzy Task.

### 5.4 Integracja z modułem Home (AI dashboard)

- Widget „Co dzisiaj gotujemy?" — wyciąga `MealPlanEntry` na dziś.
- Widget „Termin ważności" — pierwsze 3 PantryItem z `expiresAt < 3 dni`.
- Widget „Inteligentne sugestie" — LLM proponuje 3 przepisy na podstawie spiżarni.

### 5.5 Integracja z modułem Teams

Pełny support team-ownership we wszystkich nowych modelach (zgodnie ze wzorcem):
- `ownerId` XOR `ownerTeamId`
- `assertRecipeAccess(recipeId, userId)` — funkcja w `src/lib/server-utils.ts`
- `assertMealPlanAccess`, `assertPantryAccess`, `assertCookbookAccess` — analogicznie

Widoczność team:
- Przepis może być team-shared, user-only, lub publiczny (`isPublic=true` — widoczny dla wszystkich userów, edytowalny tylko przez ownera).
- Plan posiłków team-shared = rodzina widzi co kto co planuje.
- Spiżarnia team-shared = wspólny stan domowej spiżarni.

---

## 6. Integracja AI / LLM

### 6.1 Use-case'y AI

| # | Funkcja | Model | Priorytet |
|---|---------|-------|-----------|
| 1 | Parsowanie składników z tekstu („500g mąki, 2 jajka, szczypta soli") → strukturalna lista | Haiku 4.5 | MVP |
| 2 | Import przepisu z URL — pobiera HTML, ekstrahuje JSON-LD `Recipe` lub parsuje LLM-em | Sonnet 4.6 | MVP |
| 3 | OCR ze zdjęcia przepisu (np. książka kucharska) — Claude Vision | Sonnet 4.6 | v1.0 |
| 4 | Generacja przepisu z promptu („obiad z kurczaka na 4 osoby, polski, do 30 min") | Sonnet 4.6 | v1.0 |
| 5 | Propozycje przepisów na podstawie spiżarni | Sonnet 4.6 | v1.0 |
| 6 | Plan tygodnia z preferencjami | Opus 4.7 | v1.1 |
| 7 | „Zastąp składnik" — sugestie zamienników (alergia, brak na stanie) | Haiku 4.5 | v1.1 |
| 8 | Auto-kategoryzacja przepisu (cuisine, mealType, tagi) | Haiku 4.5 | MVP |
| 9 | Skalowanie nieprostych przepisów (np. „1 jajko" przy 1.5× porcji) | Haiku 4.5 | v1.1 |
| 10 | Wartości odżywcze (kalorie, białko, węglow., tłuszcz) — szacunkowo | Sonnet 4.6 | v2.0 |
| 11 | „Voice cook mode" — STT → komendy „next step", „set timer 5 min" | Whisper + Haiku | v2.0 |

### 6.2 Architektura wywołań

Wszystko przez istniejące `src/lib/llm-client.ts` (rozszerzyć), nigdy bezpośrednio w komponentach. Każda funkcja LLM ma:

1. **Server Action** (np. `parseIngredientsWithAI`) — auth + rate-limit + tracking użycia.
2. **Prompt template** w `src/lib/llm-prompts/kitchen/` (osobny plik per use-case).
3. **Output schema** (Zod) — walidacja JSON z LLM, fallback gdy parser failuje.
4. **Tracking** — wpis w `UserActivity` z `type="ai_kitchen"`, `metadata={ feature, tokens, cost }`.

### 6.3 Przykładowy prompt (parser składników)

```
SYSTEM:
Jesteś parserem składników kulinarnych po polsku i angielsku.
Zwracaj WYŁĄCZNIE JSON.

USER:
Tekst:
"""
{text}
"""

Schema (TypeScript):
type Output = { ingredients: Array<{
  name: string;          // krótki, bez ilości — np. "mąka pszenna"
  quantity: number | null;
  unit: string | null;   // np. "g", "szt", "łyżka"
  note: string | null;   // np. "drobno posiekana"
  isOptional: boolean;
}> }
```

### 6.4 Kategoryzacja składników do działu zakupów

Wykorzystujemy istniejący `categorize.ts` (Polish keywords + LLM fallback) — nie duplikujemy logiki. Każdy nowy składnik przy `shopForRecipe()` przechodzi przez `categorize()` jeśli nie ma `productId`.

### 6.5 Rate limiting / koszty

- Per user / dzień: max 50 wywołań Haiku, 10 wywołań Sonnet, 3 wywołania Opus.
- Limit w `src/lib/llm-rate-limit.ts` (do utworzenia) — KV-like w tabeli `UserActivity` z agregacją.
- UI: przy zbliżaniu się do limitu → toast informacyjny.

---

## 7. Permissions / RBAC

### 7.1 Nowe permissions (slugi)

```typescript
// src/lib/permissions.ts — dodać do PERMISSIONS
KITCHEN_VIEW: "kitchen.view",                  // bazowe: zobacz moduł
RECIPE_CREATE: "recipe.create",
RECIPE_EDIT_OWN: "recipe.edit.own",
RECIPE_EDIT_TEAM: "recipe.edit.team",
RECIPE_EDIT_ANY: "recipe.edit.any",            // admin
RECIPE_DELETE_OWN: "recipe.delete.own",
RECIPE_DELETE_TEAM: "recipe.delete.team",
RECIPE_DELETE_ANY: "recipe.delete.any",
MEALPLAN_VIEW: "mealplan.view",
MEALPLAN_EDIT: "mealplan.edit",
PANTRY_VIEW: "pantry.view",
PANTRY_EDIT: "pantry.edit",
KITCHEN_AI: "kitchen.ai",                       // dostęp do funkcji AI w module
```

Domyślne nadania:
- `USER` (default): `KITCHEN_VIEW`, `RECIPE_CREATE`, `RECIPE_EDIT_OWN`, `RECIPE_DELETE_OWN`, `MEALPLAN_*`, `PANTRY_*`, `RECIPE_EDIT_TEAM`, `RECIPE_DELETE_TEAM` (gated przez członkostwo)
- `BETA_TESTER`: + `KITCHEN_AI`
- `ADMIN`: wszystko + `*_ANY`

Po wyjściu z bety: `KITCHEN_AI` przenosimy do `USER`.

### 7.2 Server-side checks

Każda mutacja w `actions/recipes.ts`, `mealPlans.ts`, `pantry.ts`, `cookbooks.ts` zaczyna się od:

```typescript
const user = await requireAuth();
// dla mutacji konkretnego zasobu:
await assertRecipeAccess(recipeId, user.id, "edit");
```

`assertRecipeAccess` sprawdza:
- ownerId == userId, lub
- ownerTeamId w teamIds użytkownika, lub
- isPublic && mode == "read", lub
- hasPermission(session, RECIPE_EDIT_ANY) — admin override.

---

## 8. Upload plików (zdjęcia przepisów)

### 8.1 Decyzja: gdzie trzymać zdjęcia?

**Opcje:**

| Backend | Plusy | Minusy |
|---------|-------|--------|
| A. Render Disk | Tani, blisko aplikacji | Free tier brak disk-a, znika przy redeployu na free tier |
| B. Vercel Blob | Nieprzydatne (Vercel zabroniony) | — |
| C. Cloudflare R2 | Tanie, S3-compatible, free tier 10GB | Konieczność konfiguracji konta |
| D. Backblaze B2 | Tanie | Mniej popularne |
| E. Bezpośrednio w DB (base64) | Zerowa infra | Drogi storage Postgres, slow loading |

**Rekomendacja:** **Cloudflare R2** + signed upload URL.

- W MVP: pozwolić tylko na `coverImageUrl` jako pełny URL wklejony z neta (parsowany z importu URL).
- W v1.0: pełen upload do R2 + miniatury.
- ENV: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.

### 8.2 Walidacja uploadów

- Max 5 MB per zdjęcie
- Akceptowane: jpg, png, webp, heic (konwersja serverside)
- Resize na 1600px max (Sharp lub Cloudflare Image Resizing)
- Cover: dodatkowo wygenerować miniaturę 400×300

---

## 9. Caching i wydajność

### 9.1 ISR / revalidate

Każda mutacja kończy się `revalidatePath()`:

```typescript
revalidatePath("/kitchen/recipes");
revalidatePath(`/kitchen/recipes/${slug}`);
revalidatePath("/kitchen/plan");
revalidatePath("/kitchen/pantry");
```

### 9.2 Indeksy DB

Zdefiniowane wyżej (`@@index`) — krytyczne:
- `Recipe(ownerId)`, `Recipe(ownerTeamId)`, `Recipe(mealType, difficulty)`
- `MealPlanEntry(ownerId, date)`, `MealPlanEntry(ownerTeamId, date)`
- `PantryItem(ownerId)`, `PantryItem(expiresAt)`

### 9.3 Lazy loading

- Lista przepisów: zwracamy `RecipeListItem` (bez `RecipeStep[]`, bez `RecipeIngredient[]`, tylko z `coverImageUrl`, `title`, `prepMinutes`, `cookMinutes`, tagi).
- `RecipeFull` z ingredientami/krokami tylko na stronie szczegółowej.

### 9.4 Search

- Postgres `LIKE '%query%'` na `title` w MVP.
- W v1.1: `tsvector` index na `title || description || coalesce(notes, '')` z `to_tsvector('polish', ...)` — Postgres ma wsparcie dla polskiego.

---

## 10. Testy

### 10.1 Co testować (priorytet)

| Co | Typ | Priorytet |
|----|-----|-----------|
| `shopForRecipe()` — skalowanie porcji, pominięcie spiżarni | unit | MUST |
| `generateShoppingListFromPlan()` — konsolidacja składników | unit | MUST |
| `assertRecipeAccess()` — wszystkie ścieżki (owner, team, public, admin) | unit | MUST |
| Parser składników z tekstu (z mockiem LLM) | unit | SHOULD |
| Auto-replenish — próg `minQuantity` | unit | SHOULD |
| RecipeEditor — dodawanie/usuwanie składników (RTL) | component | SHOULD |
| `MealPlanWeek` — DnD pomiędzy slotami (RTL + DnD events) | component | COULD |
| End-to-end: stwórz przepis → dodaj do planu → wygeneruj listę zakupów | e2e (Playwright) | SHOULD |

### 10.2 Testy istnieją?

Sprawdzenie: `worldofmag/jest.config*` / `package.json scripts`. Jeśli brak — w ramach implementacji modułu **dodać Jest + RTL** (osobne PR przed merge). Jeśli to za dużo na jeden PR — odpuścić testy i polegać na manualnym QA + ścisłym code review.

---

## 11. Migracja danych / backward compatibility

- Brak istniejących danych do migracji (moduł nowy).
- Schema migracja `0017_kitchen_module` jest **niezniszcząca** — tylko CREATE TABLE / ADD COLUMN.
- Rollback plan: `prisma migrate resolve --rolled-back 0017_kitchen_module` + ręczne DROP TABLE (skrypt SQL w `docs/recipes/rollback.sql`).

---

## 12. Wdrożenie etapami (faza)

### Faza 0 — Pre-implementation (1 PR)
- [ ] Migration `0017_kitchen_module` (tylko schema, bez UI)
- [ ] Update PERMISSIONS + RBAC seeds
- [ ] Sidebar w AppShell — dodanie ikony Kuchnia (placeholder)
- [ ] Routing skeleton (puste strony z „Wkrótce")

### Faza 1 — MVP Recipes (2-3 PR)
- [ ] `actions/recipes.ts` — pełny CRUD + ingredient/step CRUD
- [ ] `actions/cookbooks.ts` — CRUD
- [ ] RecipeList, RecipeCard, RecipeView, RecipeEditor
- [ ] ShopForRecipeDialog + `shopForRecipe()` action
- [ ] Manual creation (bez AI)
- [ ] Test ścieżki: stworzenie przepisu, dodanie do listy zakupów

### Faza 2 — Meal Planning (1-2 PR)
- [ ] `actions/mealPlans.ts`
- [ ] MealPlanWeek (DnD)
- [ ] `generateShoppingListFromPlan()`
- [ ] Widget na Home: „Co dzisiaj gotujemy?"

### Faza 3 — Pantry (1-2 PR)
- [ ] `actions/pantry.ts`
- [ ] PantryList, StockTakeMode
- [ ] Integracja `shopForRecipe(skipPantry: true)`
- [ ] `getExpiringSoon()` + widget na Home

### Faza 4 — AI Integration (2-3 PR)
- [ ] Parser składników (Haiku)
- [ ] Import z URL (parser JSON-LD + LLM fallback)
- [ ] Auto-kategoryzacja przepisu
- [ ] Sugestie z spiżarni
- [ ] Settings: `KITCHEN_AI` permission gating

### Faza 5 — Polish & v1.0 (1-2 PR)
- [ ] Cook Mode (fullscreen)
- [ ] Zdjęcia (Cloudflare R2)
- [ ] OCR ze zdjęcia
- [ ] Plan tygodnia AI
- [ ] Voice mode (opcjonalnie, v2.0)

### Faza 6 — v2.0 ekstrasy
- [ ] Wartości odżywcze
- [ ] Eksport (PDF, drukowanie)
- [ ] Publiczna baza przepisów (community)
- [ ] „Cook with friend" — synchroniczny tryb gotowania na 2 ekranach

---

## 13. Ryzyka i mitygacje

| Ryzyko | Wpływ | Prawdopodobieństwo | Mitygacja |
|--------|-------|---------------------|-----------|
| LLM zwraca błędny JSON (parser składników) | M | M | Zod walidacja + fallback do prostego regexa + UI „nie udało się rozpoznać, popraw ręcznie" |
| Konflikty merge na schema.prisma jeśli równolegle ktoś edytuje | H | L | Robić migrację jako pierwszy commit po `git pull master`. Małe migracje. |
| Cold start Render — wolne ładowanie zdjęć z R2 | L | M | CDN cache z R2 + lazy loading + miniatury |
| Spiżarnia rozjedzie się ze stanem fizycznym | M | H | Tryb StockTake (szybki update), reminder w settings „Sprawdź spiżarnię" |
| Plan tygodnia generowany przez AI nie pasuje do preferencji | M | M | Konstrukcja constraints + feedback loop („nie podobało mi się" → log do prompt context next time) |
| Koszty LLM rosną nieproporcjonalnie | H | L | Rate limiting + monitoring per user + alert przy >$5/m/user |
| Upload zdjęć przekroczy limit R2 free tier | L | M | Cap 50 zdjęć/user free, paid plan dla power users |

---

## 14. Niezbędne dependencies do dodania

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.x",        // dla R2 (S3-compatible)
    "@aws-sdk/s3-request-presigner": "^3.x",
    "sharp": "^0.33.x",                   // resize images
    "@dnd-kit/core": "^6.x",              // drag-drop dla MealPlan + składniki/kroki
    "@dnd-kit/sortable": "^8.x",
    "date-fns": "^3.x"                    // jeśli nie ma jeszcze; do operacji na tygodniach
  }
}
```

(Sprawdzić package.json — niektóre mogą już być.)

---

## 15. Otwarte pytania do zatwierdzenia

1. **Czy chcemy publiczną bazę przepisów** (community)? Wpływ na uprawnienia i moderację.
2. **Czy zdjęcia w MVP są niezbędne?** Jeśli odpadną — Faza 1 jest dużo prostsza.
3. **Voice mode w Cook Mode** — czy ma być? Wymaga Whisper API lub Web Speech API.
4. **Limit rozmiaru przepisu (znaki w `notes`)** — sugeruję 50 000 znaków.
5. **Czy MealPlan ma wspierać „repetitive meals"** (np. „śniadanie: owsianka — codziennie")?
6. **Hosting zdjęć** — R2 (preferowane) vs. trzymać URLe zewnętrzne (zero infra).
7. **Czy zostawiać `customTitle` w MealPlanEntry** — czy zawsze wymagać przepisu? (Argument za: realny use-case „obiad u babci".)
8. **Integracja z kalendarzem Google** — jeśli kiedyś dodamy moduł Kalendarz, czy MealPlan ma się tam pokazywać?

---

## 16. Załączniki

- `recipes-ux.md` — pełna specyfikacja UX (screeny, flowy, komponenty)
- `recipes-analysis.md` — analiza funkcji, AI, roadmapy, KPI
- `recipes-summary.md` — wstęp dla nowej sesji Claude Code

---

**Koniec dokumentu architektonicznego v1.0.**
$kitchen_architecture_2026_05_20$,
  'proposal',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Kuchnia — Dokument UX',
  'kitchen-ux-2026-05-20',
  $kitchen_ux_2026_05_20$# Kuchnia — Dokument UX

**Wersja:** 1.0
**Data:** 2026-05-20
**Status:** Do zatwierdzenia przed implementacją
**Filozofia:** Mobile-first, keyboard-friendly desktop, „no waste" (zero zbędnych kliknięć)

---

## 1. Persona i konteksty użycia

### Persona główna: Szymon (developer power user)

- Wiek 35+, ma rodzinę, gotuje 3-4× w tygodniu.
- Lubi gotować, ale nie chce „walczyć" z appem.
- Używa iPhone'a w kuchni (zalany blat, mokre ręce) — wymaga **dużych touch targetów** i **trybu „nie wyłączaj ekranu"**.
- W tygodniu planuje posiłki — zazwyczaj wieczorem na laptopie (desktop).
- Wynagrodzenie: shortcut typu `Ctrl+K` → wpisz „spaghetti carbonara" → enter → przepis.
- Ma alergię/nielubi czegoś — chce w 1 sekundę odfiltrować.

### Konteksty użycia

| Kontekst | Urządzenie | Cel | Główny KPI |
|----------|-----------|-----|------------|
| Planowanie tygodnia (sobota wieczór) | Desktop / iPad | Stworzyć plan 7 dni, wygenerować listę zakupów | „Czas od decyzji do listy zakupów" — target < 5 min |
| Zakupy (niedziela rano) | iPhone | Przejść z gotowej listy | Już istniejące Shopping |
| Gotowanie (codziennie) | iPhone na statywie / iPad | Krok po kroku, timery, ręce zajęte | „Kroków bez konieczności dotknięcia ekranu" |
| Spontaniczny posiłek (wieczór, „co zrobić z kurczaka + brokuł") | iPhone | Szybko znaleźć przepis | Time-to-recipe < 30 sek |
| Tworzenie własnego przepisu (po fakcie, ad-hoc) | iPhone (zdjęcie efektu) / Desktop (porządne wpisanie) | Zapisać przepis na zawsze | Niska bariera dodania |
| Importowanie przepisu (z internetu) | Desktop | Wkleić URL → mam | Czas < 10 sek |

---

## 2. Filozofia projektowa

### 2.1 Zasady ogólne (rozszerzenie CLAUDE.md)

1. **Keyboard-first na desktopie, gesture-first na mobile.**
2. **Cookies < 5 kliknięć** — od listy do listy zakupów dla przepisu max 4 kliknięcia.
3. **Brak animacji ozdobnych.** Tylko micro-feedback (200ms fade na toastach, instant hover).
4. **Zero-state inteligentny** — pusty stan zawsze pokazuje *jak zacząć* + przykład.
5. **Edycja in-place** wszędzie gdzie ma to sens (tytuł przepisu, składnik, krok).
6. **Optimistic UI** — zmiany są widoczne natychmiast, server sync w tle, rollback przy błędzie.
7. **Cook Mode = święte miejsce** — żadnych powiadomień, żadnych pop-up, żadnych analytics, żadnych modali. Tylko gotowanie.

### 2.2 Mobile-first ≠ tylko-mobile

- Cały moduł projektujemy najpierw na 375px (iPhone SE width).
- Następnie skalujemy do 768px (iPad), 1024px+ (desktop).
- Desktop dostaje: side panele, multi-column layouty, większe gridy.
- **Nie chowamy funkcji na desktopie** — zachowujemy parity.

### 2.3 Mobile-specific zasady

- Touch targets ≥ 44×44px (Apple HIG).
- Bottom sheet zamiast modali (Radix Dialog z `position: bottom`).
- Brak hoverów — wszystko działa po tap.
- W Cook Mode: tap w lewą połowę = poprzedni krok, w prawą = następny.
- Long-press na karcie przepisu = quick menu (edycja, duplikuj, usuń).

---

## 3. Mapa ekranów

### 3.1 Hierarchia

```
/kitchen
├── /recipes                    [GŁÓWNY EKRAN]
│   ├── /recipes/new            [Tworzenie]
│   ├── /recipes/import         [Wybór metody importu]
│   └── /recipes/[id]           [Widok przepisu]
│       ├── /recipes/[id]/edit  [Edycja]
│       └── /recipes/[id]/cook  [Tryb gotowania — fullscreen]
├── /plan                       [Plan tygodnia]
│   └── /plan/month             [Widok miesiąca]
├── /pantry                     [Spiżarnia]
│   └── /pantry/stocktake       [Inwentaryzacja]
└── /cookbooks                  [Książki kucharskie]
    └── /cookbooks/[id]         [Pojedyncza książka]
```

### 3.2 Nawigacja wewnątrz modułu

**Desktop:** górny tabbar pod nagłówkiem strony.

```
┌─────────────────────────────────────────────────────┐
│  Kuchnia                              [+ Nowy ▾]    │
├─────────────────────────────────────────────────────┤
│  [📖 Przepisy] [📅 Plan] [🥫 Spiżarnia] [📚 Książki]│
└─────────────────────────────────────────────────────┘
```

**Mobile:** dolny tabbar (4 ikony) — analogicznie do tab-baru iOS.

```
                  CONTENT
┌─────────────────────────────────────────────────────┐
│  📖       📅       🥫       📚                       │
│ Przepisy Plan  Spiżarnia Książki                    │
└─────────────────────────────────────────────────────┘
```

(Na mobile dolny tabbar pojawia się tylko w `/kitchen/*` — nie zastępuje globalnego selectora nawigacji modułów.)

---

## 4. Ekran: Lista przepisów (`/kitchen/recipes`)

### 4.1 Desktop (≥1024px)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Kuchnia                                          [+ Nowy przepis ▾]  │
│  ──────────────────────────────────────────────────────────────────   │
│  [📖 Przepisy] [📅 Plan] [🥫 Spiżarnia] [📚 Książki]                  │
│  ──────────────────────────────────────────────────────────────────   │
│                                                                       │
│  🔍 Szukaj przepisów...                          ⌘K                   │
│                                                                       │
│  Filtry:                                                              │
│  [Kuchnia ▾] [Posiłek ▾] [Tagi ▾] [Czas ≤ ?] [📚 Książka ▾]          │
│  Aktywne: ╳ włoska   ╳ obiad   ╳ ≤30min                              │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  [zdjęcie]  │  │  [zdjęcie]  │  │  [zdjęcie]  │  │  [zdjęcie]  │  │
│  │             │  │             │  │             │  │             │  │
│  │ Carbonara   │  │ Pesto       │  │ Risotto     │  │ Ravioli     │  │
│  │ 25 min · 4p │  │ 15 min · 4p │  │ 45 min · 2p │  │ 60 min · 4p │  │
│  │ włoska      │  │ włoska·wege │  │ włoska      │  │ włoska      │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                                       │
│  (load more on scroll)                                                │
└───────────────────────────────────────────────────────────────────────┘
```

### 4.2 Mobile (375px)

```
┌──────────────────────────────┐
│  Kuchnia            [+ ▾]    │
├──────────────────────────────┤
│  🔍 Szukaj...                │
├──────────────────────────────┤
│  [Wszystkie] [Ulubione] [⏲]   │  ← chipy filtrów (scroll-x)
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ [zdjęcie 16:9]         │  │
│  │                        │  │
│  │ Spaghetti Carbonara    │  │
│  │ 25 min · 4 porcje      │  │
│  │ ★ 4.5 · ostatnio: 3d   │  │
│  │ włoska · obiad         │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ [zdjęcie 16:9]         │  │
│  ...                          │
├──────────────────────────────┤
│  📖   📅   🥫   📚            │  ← bottom tabbar
└──────────────────────────────┘
```

### 4.3 Komponenty

| Komponent | Opis |
|-----------|------|
| `RecipeFilters` | Dropdown menu z multi-select dla kuchni / posiłku / tagów / czasu / książki. Wybrane wartości jako chipy poniżej. |
| `RecipeCard` | Karta z cover image (16:9, lazy), tytuł, czas, porcje, rating, tagi (max 3, reszta jako „+2"). |
| `SearchBar` | Live search z debounce 300ms. Skrót `/` lub `Ctrl+K`. |
| `NewRecipeMenu` | Dropdown z opcjami: „Pusty", „Z URL", „Ze zdjęcia", „Z AI" |

### 4.4 Klawiatura (desktop)

- `/` — focus search
- `j`/`k` — nawigacja po kartach
- `Enter` — otwórz przepis
- `n` — nowy przepis (puste menu)
- `Ctrl+K` — command palette (globalny — rozszerzony o „Kuchnia: nowy przepis")
- `f` — toggle filtry

### 4.5 Empty state

```
┌─────────────────────────────────────┐
│         🍳                          │
│   Brak przepisów                    │
│                                     │
│   Zacznij od:                       │
│   [+ Pusty przepis]                 │
│   [📥 Importuj z URL]               │
│   [📸 Ze zdjęcia]                   │
│   [✨ Wygeneruj z AI]               │
│                                     │
│   …albo skopiuj jeden z bazy:       │
│   ┌─────────────┐ ┌─────────────┐   │
│   │ Carbonara   │ │ Naleśniki   │   │
│   └─────────────┘ └─────────────┘   │
└─────────────────────────────────────┘
```

---

## 5. Ekran: Widok przepisu (`/kitchen/recipes/[id]`)

### 5.1 Desktop (≥1024px)

Dwukolumnowy layout: lewa kolumna składniki, prawa kroki.

```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Przepisy                                                           │
│                                                                       │
│  Spaghetti Carbonara                          [✏️ Edytuj] [⋯]         │
│  ★★★★☆  ·  Włoska · Obiad · 25 min  ·  4 porcje                       │
│  Ostatnio: 3 dni temu (5×)                                            │
│  Tagi: szybkie, makaron, klasyk                                       │
│                                                                       │
│  ┌─────────────────────────────────────┐                              │
│  │ [Cover image 16:9, full width]      │                              │
│  └─────────────────────────────────────┘                              │
│                                                                       │
│  Porcje: [- 4 +]  [👨‍🍳 Cook Mode]  [🛒 Do listy]  [📅 Do planu]      │
│                                                                       │
│  ┌─────────────────────┐  ┌─────────────────────────────────────────┐ │
│  │ Składniki            │  │ Przygotowanie                          │ │
│  │ ───────────────────  │  │ ─────────────────────────────────────   │ │
│  │ Główne               │  │ 1. Ugotuj makaron al dente w osolonej  │ │
│  │ ☐ 400g spaghetti    │  │    wodzie (8-10 min)                    │ │
│  │   ⓘ masz: 250g      │  │    [📷] [⏲ 10:00]                       │ │
│  │ ☐ 200g boczku       │  │                                          │ │
│  │ ☐ 4 żółtka          │  │ 2. Pokrój boczek w drobną kostkę.        │ │
│  │ ☐ 100g parmezanu    │  │    Podsmaż na suchej patelni do złotego  │ │
│  │ ☐ czarny pieprz     │  │    koloru.                               │ │
│  │                      │  │                                          │ │
│  │ Opcjonalne           │  │ 3. ...                                   │ │
│  │ ☐ pietruszka         │  │                                          │ │
│  └─────────────────────┘  └─────────────────────────────────────────┘ │
│                                                                       │
│  Notatki kucharza                                                     │
│  Najlepiej z guanciale zamiast boczku. Pieprz świeżo mielony.         │
│                                                                       │
│  Komentarze (3)  ★★★★☆ (12 ocen)                                      │
└───────────────────────────────────────────────────────────────────────┘
```

### 5.2 Mobile

```
┌──────────────────────────────┐
│  ← Przepisy            [⋯]   │
├──────────────────────────────┤
│  [Cover 16:9]                │
├──────────────────────────────┤
│  Spaghetti Carbonara         │
│  ★★★★☆ · 25 min · 4 porcje   │
│  Włoska · Obiad              │
├──────────────────────────────┤
│  Porcje: [- 4 +]             │
│                              │
│  [👨‍🍳 Cook Mode]              │
│  [🛒 Dodaj do listy zakupów] │
│  [📅 Wstaw do planu]         │
├──────────────────────────────┤
│  SKŁADNIKI                   │
│  ─────────                   │
│  Główne                      │
│  ☐ 400g spaghetti           │
│    ⓘ masz: 250g             │
│  ☐ 200g boczku              │
│  ...                         │
│                              │
│  PRZYGOTOWANIE               │
│  ─────────────               │
│  1. Ugotuj makaron al dente  │
│     w osolonej wodzie...     │
│     [⏲ 10:00]                │
│                              │
│  2. ...                      │
└──────────────────────────────┘
```

### 5.3 Funkcje na ekranie widoku

- **Skala porcji** (`-` / `+`) — natychmiast przelicza ilości składników (z odpowiednim zaokrąglaniem: „1 jajko" → „1.5 jajka" → komunikat „użyj 2 jajek" + opcjonalnie AI fallback dla nieoczywistych).
- **Checkboxy przy składnikach** — to LOKALNY state (zaznaczasz „mam to, idę dalej"), nie zmienia DB. Reset przy reload.
- **Tooltip „masz: X"** — pokazuje stan ze spiżarni przy każdym składniku (gdy `productId` matcha).
- **Cook Mode** — duży CTA, pełnoekranowy widok krok po kroku.
- **Do listy zakupów** — otwiera `ShopForRecipeDialog`.
- **Do planu** — otwiera kalendarz, klikasz datę+slot, dodaje wpis.

### 5.4 Klawiatura

- `e` — edycja
- `c` — cook mode
- `s` — do listy zakupów (shop)
- `p` — do planu
- `+` / `-` — skala porcji
- `Esc` — powrót do listy

---

## 6. Ekran: Edycja przepisu (`/kitchen/recipes/[id]/edit`)

### 6.1 Layout (desktop)

```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Anuluj                                            [Zapisz Ctrl+S]  │
├───────────────────────────────────────────────────────────────────────┤
│  Tytuł:                                                               │
│  [Spaghetti Carbonara                                              ]  │
│                                                                       │
│  Krótki opis (1-2 zdania):                                            │
│  [Klasyczny włoski makaron z boczkiem i sosem jajecznym.           ]  │
│                                                                       │
│  Cover image:                                                         │
│  [📷 Wgraj] lub URL: [____________]                                   │
│                                                                       │
│  Czas: [Prep 5  ] min  [Cook 20  ] min   Porcje: [4  ]                │
│  Trudność: ( ) Łatwe  (•) Średnie  ( ) Trudne                         │
│  Kuchnia: [Włoska ▾]   Posiłek: [Obiad ▾]                             │
│  Książka: [Brak ▾]                                                    │
│  Tagi: [+ szybkie] [+ makaron] [+ klasyk] [+]                         │
│                                                                       │
│  ─── Składniki ──────────────────────────────────────────────────     │
│  Grupa: [Główne]                                                      │
│  ⠿ [ilość] [jedn] [nazwa składnika                  ] [notatka] [✕]   │
│  ⠿ 400      g      spaghetti                          al dente   ✕   │
│  ⠿ 200      g      boczek                                        ✕   │
│  ⠿ 4        szt    żółtka                                        ✕   │
│  [+ Dodaj składnik]   [+ Nowa grupa]                                  │
│                                                                       │
│  ✨ [Wklej tekst → parsuj składniki AI]                                │
│  ┌────────────────────────────────────────────────────────┐           │
│  │ 400g spaghetti                                          │           │
│  │ 200g boczku                                              │           │
│  │ 4 żółtka                                                 │           │
│  │ 100g parmezanu                                           │           │
│  └────────────────────────────────────────────────────────┘           │
│  [Parsuj]                                                              │
│                                                                       │
│  ─── Przygotowanie ──────────────────────────────────────────────     │
│  Krok 1:                                                              │
│  ⠿ [Ugotuj makaron al dente w osolonej wodzie (8-10 min).        ✕]  │
│    Timer: [10] min   Temperatura: [____]   [📷 Zdjęcie]               │
│                                                                       │
│  Krok 2: ...                                                          │
│  [+ Dodaj krok]                                                        │
│                                                                       │
│  ─── Notatki kucharza (markdown) ─────────────────────────────────    │
│  [Tekstarea wielowierszowa...                                      ]  │
│                                                                       │
│  ─── Widoczność ───────────────────────────────────────────────       │
│  ( ) Tylko ja  (•) Mój team: [Rodzina ▾]  ( ) Publiczny               │
│                                                                       │
│  [Anuluj]                          [Usuń przepis]  [Zapisz Ctrl+S]    │
└───────────────────────────────────────────────────────────────────────┘
```

### 6.2 Krytyczne mechaniki edytora

#### 6.2.1 Inteligentny input składnika

Pole „nazwa składnika" działa jak `<input>` z autocomplete:
- Po wpisaniu 2+ znaków → fetch sugestii z `Product[]` (top 10 by `useCount`).
- Wybór sugestii → ustawia `productId`, podpowiada `defaultUnit`.
- Brak dopasowania → input swobodny, `productId` = null, tworzymy Product przy zapisie (opt-in).

#### 6.2.2 Smart parsing pojedynczego inputu

Skopiowane z istniejącego `parseQuantity.ts`:
- Wpisanie „400g spaghetti" w pole tekstowe → automatycznie wypełnia `qty=400`, `unit=g`, `name=spaghetti`.
- Ten sam parser co Shopping.

#### 6.2.3 Parser AI (wklej cały blok)

Textarea „Wklej tekst → parsuj składniki AI":
- Wpisujesz kilka linii surowego tekstu (np. z przepisu skopiowanego z neta).
- Klik „Parsuj" → call Server Action `suggestIngredientsFromText()` → zwraca strukturę.
- UI pokazuje propozycje obok obecnych składników z checkboxami „dodaj".
- Każdy z możliwością ręcznej edycji przed wpisem do listy składników.

#### 6.2.4 Drag-and-drop

`@dnd-kit/sortable` na:
- Reordering składników w grupie (i między grupami).
- Reordering kroków.

Vertical handle z lewej strony (`⠿`), zarówno desktop jak mobile (long-press → drag na mobile).

#### 6.2.5 Auto-save

- Po 3 sekundach bezczynności → save draft (Server Action `updateRecipe` z `isDraft=true`).
- Toast „Zapisano draft" subtelny w prawym dolnym rogu (3s timeout).
- Pełen zapis przy kliknięciu „Zapisz" lub `Ctrl+S`.
- Confirm dialog przy próbie wyjścia z niezapisanymi zmianami.

### 6.3 Klawiatura

- `Ctrl+S` — zapisz
- `Tab` — między polami
- W liście składników: `Enter` w polu „nazwa" → dodaj kolejny składnik (focus na nowym)
- W liście kroków: `Ctrl+Enter` → dodaj kolejny krok
- `Esc` — anuluj (z confirm jeśli niezapisane)

---

## 7. Ekran: Cook Mode (`/kitchen/recipes/[id]/cook`)

### 7.1 Filozofia

> „Stałem nad gazem z brudnymi rękami. Aplikacja MUSI działać tak, żebym przeszedł cały przepis, dotykając ekranu może 5 razy."

### 7.2 Layout

**Fullscreen.** Bez sidebara, bez nagłówka, bez nawigacji.

```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Wyjdź                       Spaghetti Carbonara          Krok 2/8  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                                                                       │
│              Pokrój boczek w drobną kostkę.                           │
│              Podsmaż na suchej patelni                                │
│              do złotego koloru.                                       │
│                                                                       │
│                                                                       │
│                                                                       │
│              [📷 zdjęcie kroku, jeśli jest]                           │
│                                                                       │
│                                                                       │
│              ⏲  05:00                                                 │
│              [▶ Start timer]                                          │
│                                                                       │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│  ← Poprzedni              ●●○○○○○○                Następny →          │
└───────────────────────────────────────────────────────────────────────┘
```

### 7.3 Funkcje Cook Mode

- **Brak wygaszania ekranu** — wakelock API (`navigator.wakeLock.request('screen')`).
- **Wielki tekst** — `font-size: 28px` na mobile, 32px desktop.
- **Tap-zones:** lewa połowa = poprzedni krok, prawa = następny. (Wyłącznik w settings.)
- **Wbudowany timer per krok** — przycisk startuje, sygnał dźwiękowy + wibracja po końcu.
- **Wiele timerów równolegle** — pływające „pills" na dole z odliczaniem (np. „makaron 04:23" + „sos 02:11").
- **Składniki przypomniane** — przycisk „pokaż składniki" otwiera bottom sheet (mobile) / sidebar (desktop) z listą.
- **Voice control (v1.1)** — komendy: „dalej", „wstecz", „start timer 5 minut", „pokaż składniki".
- **Wyjście** — przycisk „Wyjdź" + dialog „Ugotowałem!" (mark cooked → `cookCount++`, `lastCookedAt`, sugestia do spiżarni i planu).

### 7.4 Mark cooked dialog

```
┌─────────────────────────────────┐
│  Ugotowałeś Spaghetti Carbonara │
│                                 │
│  Ile porcji wyszło?             │
│  [- 4 +]                        │
│                                 │
│  ☑ Zaktualizuj spiżarnię        │
│     (odjmij zużyte składniki)   │
│                                 │
│  ☐ Daj ocenę                   │
│     ☆☆☆☆☆                       │
│                                 │
│  [Anuluj]    [Zapisz]           │
└─────────────────────────────────┘
```

---

## 8. Ekran: Plan posiłków (`/kitchen/plan`)

### 8.1 Desktop — widok tygodnia

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  Plan posiłków                              < 18-24 maja 2026 >    [📅 Miesiąc]    │
│  ──────────────────────────────────────────────────────────────────────────────    │
│                                                          [📥 Wygeneruj listę]      │
│                                                          [✨ AI: zaproponuj plan]  │
│  ──────────────────────────────────────────────────────────────────────────────    │
│              Pon 18      Wt 19      Śr 20      Czw 21    Pt 22     Sob 23   Nd 24  │
│  Śniadanie  Owsianka    Owsianka   Jajecznica  Owsianka  Naleśn.   —        —      │
│             [2p]        [2p]       [4p]        [2p]      [4p]                       │
│                                                                                     │
│  Obiad      Carbonara   Risotto    + Dodaj    Curry      —        Zupa pomid. Pizza│
│             [4p]        [2p]                  [4p]                [4p]       [4p]   │
│                                                                                     │
│  Kolacja    Kanapki     Sałatka    Kanapki    Soup       Tortilla  —        —      │
│             [2p]        [2p]       [2p]       [2p]       [2p]                       │
│                                                                                     │
│  Przekąska  —           —          —          —          Babka     —        —      │
│  ──────────────────────────────────────────────────────────────────────────────    │
│  → Drag&drop z bocznego panelu (toggle z prawej)                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

#### Boczny drawer (toggleable z prawej)

```
┌───────────────────────┐
│  📖 Twoje przepisy    │
│  🔍 Szukaj            │
│  ───────────────────  │
│  [Carbonara]   drag   │
│  [Risotto]     drag   │
│  [Curry]       drag   │
│  [Pesto]       drag   │
│  ...                  │
│  ───────────────────  │
│  ✨ AI sugestie       │
│  „Na podstawie spiżarni:│
│   - Sałatka grecka     │
│   - Pomidorowa zupa    │
│   - Curry z kurczaka"   │
└───────────────────────┘
```

### 8.2 Mobile — dzień jako karta (scroll)

Tygodniowy grid jest nieczytelny na małym ekranie. Mobile pokazuje **listę dni**, każdy dzień jako karta ze slotami.

```
┌──────────────────────────────┐
│  Plan posiłków               │
│  < 18-24 maja 2026 >         │
├──────────────────────────────┤
│  Pon 18 maja                 │
│  ┌────────────────────────┐  │
│  │ ☕ Śniadanie · 2p     │  │
│  │ Owsianka z owocami    │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 🍽 Obiad · 4p          │  │
│  │ Spaghetti Carbonara   │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 🌙 Kolacja · 2p        │  │
│  │ Kanapki                │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ + Dodaj posiłek        │  │
│  └────────────────────────┘  │
│                              │
│  Wt 19 maja                  │
│  ...                          │
└──────────────────────────────┘
```

Tap na slot → bottom sheet z wyborem przepisu lub wpisaniem własnego tytułu.

### 8.3 Generowanie listy zakupów z planu

Klik „📥 Wygeneruj listę" → dialog:

```
┌──────────────────────────────────┐
│  Wygeneruj listę zakupów         │
│                                  │
│  Zakres:                         │
│  ( ) Tylko ten tydzień           │
│  (•) Najbliższe 3 dni            │
│  ( ) Wybierz daty: [____] - [__] │
│                                  │
│  Lista docelowa:                 │
│  [Tygodniowe zakupy ▾]           │
│                                  │
│  ☑ Pomiń to co jest w spiżarni  │
│  ☑ Konsoliduj duplikaty          │
│  ☐ Pomiń składniki opcjonalne   │
│                                  │
│  Podgląd:                        │
│  • cebula 3 szt (3 przepisy)     │
│  • mleko 1l                      │
│  • masło 200g                    │
│  • ... (37 pozycji)              │
│                                  │
│  Pominięte ze spiżarni: 8 poz.   │
│                                  │
│  [Anuluj]      [Dodaj do listy]  │
└──────────────────────────────────┘
```

### 8.4 AI: zaproponuj plan tygodnia

Klik „✨ AI: zaproponuj plan" → wizard:

```
Krok 1: Preferencje (memorized z poprzednich)
- Liczba osób: [2  ]
- Posiłki dziennie: ☑ Śniadanie ☑ Obiad ☑ Kolacja ☐ Przekąska
- Unikaj: [boczek] [ryba]
- Kuchnia preferowana: [polska] [włoska] [azjatycka]
- Max czas/posiłek: [45 min ▾]
- ☑ Priorytet: użyj produktów ze spiżarni
- ☑ Nie powtarzaj przepisów w tygodniu
- ☐ Trzymaj się ulubionych książek: [□ Mama] [□ Włoska]

Krok 2: Generacja (loader)
„AI tworzy plan na podstawie Twoich przepisów..."

Krok 3: Podgląd planu (jak w 8.1, ale z markerami „AI")
- Każdy slot z subtelnym ✨ ikoną
- Klik na slot → swap (3 alternatywy AI)
- „Zaakceptuj wszystko" / „Edytuj ręcznie" / „Wygeneruj ponownie"
```

---

## 9. Ekran: Spiżarnia (`/kitchen/pantry`)

### 9.1 Desktop

```
┌───────────────────────────────────────────────────────────────────────┐
│  Spiżarnia                                  [📋 Inwentaryzacja] [+]   │
│  ──────────────────────────────────────────────────────────────────   │
│  Lokalizacja: [Wszystkie ▾]   Status: [Wszystko ▾]                    │
│  🔍 Szukaj produktu...                                                │
│                                                                       │
│  ⚠️ Kończy się termin (3)                                              │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │ Mleko 1l  ·  Lodówka   ·  za 2 dni  ·  🛒 [Dokup]          │     │
│  │ Jogurt    ·  Lodówka   ·  jutro     ·  🛒 [Dokup]  ⚙ [-1]  │     │
│  │ Boczek    ·  Lodówka   ·  za 3 dni  ·  🛒 [Dokup]          │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  🥫 Spiżarnia                                                          │
│  ─────────────────                                                    │
│  Mąka pszenna       2 kg     spiżarnia   ⚙ [-]   🛒[Auto-replenish]   │
│  Cukier             1.5 kg   spiżarnia   ⚙ [-]                        │
│  Ryż basmati        500 g    spiżarnia   ⚙ [-]   ⚠ poniżej minimum    │
│  ...                                                                  │
│                                                                       │
│  ❄️ Lodówka                                                            │
│  ─────────────────                                                    │
│  Masło              200 g    lodówka     ⚙ [-]                        │
│  Mleko              1 l      lodówka     ⚙ [-]   ⚠ termin 2d          │
│  ...                                                                  │
│                                                                       │
│  🧊 Zamrażarka                                                         │
│  ─────────────────                                                    │
│  Kurczak filet      500 g    zamrażarka  ⚙ [-]                        │
└───────────────────────────────────────────────────────────────────────┘
```

### 9.2 Mobile

Pełna lista jest długa — wyświetlamy grupowaną po lokalizacji, każdy element jako wiersz.

```
┌──────────────────────────────┐
│  Spiżarnia          [+] [📋] │
├──────────────────────────────┤
│  🔍 Szukaj...                │
├──────────────────────────────┤
│  ⚠️ Termin (3)                │
│  • Mleko 1l (jutro)          │
│  • Jogurt (jutro)            │
│  • Boczek (za 3 dni)         │
├──────────────────────────────┤
│  Filtry: [Wszystko] [Lodów.] │
├──────────────────────────────┤
│  🥫 Spiżarnia                 │
│  Mąka pszenna        2 kg ⋮  │
│  Cukier              1.5kg ⋮ │
│  Ryż basmati         500g ⋮  │
│                              │
│  ❄️ Lodówka                   │
│  Masło               200g ⋮  │
│  Mleko        1l  ⚠2d   ⋮    │
└──────────────────────────────┘
```

Tap na produkt → bottom sheet z opcjami: edytuj ilość, zmień lokalizację, ustaw termin, włącz auto-replenish, „Zużyj X" (slider).

### 9.3 Tryb inwentaryzacji (Stocktake)

Pełen ekran z listą wszystkich produktów, każdy ma input liczbowy. Cel: szybki update wszystkiego po fizycznej inspekcji.

```
┌──────────────────────────────┐
│  ← Anuluj    [Zapisz]        │
├──────────────────────────────┤
│  Inwentaryzacja              │
│  Wpisz aktualną ilość        │
├──────────────────────────────┤
│  🥫 Spiżarnia                 │
│  Mąka pszenna  [2.0  ] kg    │
│  Cukier        [1.5  ] kg    │
│  Ryż basmati   [0.3  ] kg    │
│                              │
│  ❄️ Lodówka                   │
│  Masło         [0.15 ] kg    │
│  Mleko         [1    ] l     │
│  ...                          │
│                              │
│  [+ Dodaj produkt]           │
└──────────────────────────────┘
```

Zapis → batchowy update wszystkich `PantryItem.quantity`.

### 9.4 Auto-replenish

- Per produkt: edit dialog ma checkbox „Auto-uzupełnij" + pole „Minimum: [X]".
- Gdy `quantity < minQuantity` → produkt pojawia się w widget'cie „🛒 Do zakupu" na górze spiżarni.
- Globalna akcja „🛒 Dodaj wszystkie do listy" → dodaje wszystkie poniżej minimum do wybranej listy.
- W settings: per użytkownik „domyślna lista do auto-replenish".

---

## 10. Ekran: Książki kucharskie (`/kitchen/cookbooks`)

Prosty grid kart z okładkami (emoji + kolor). Klik → strona książki = filtrowana lista przepisów `cookbookId=X`.

```
┌───────────────────────────────────────────────────┐
│  Książki kucharskie                          [+]  │
├───────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │   📚     │  │   🍝     │  │   🥗     │         │
│  │          │  │          │  │          │         │
│  │ Mama     │  │ Włoska   │  │ Wege     │         │
│  │ 24 przep.│  │ 18 przep.│  │ 12 przep.│         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                   │
│  ┌──────────┐  ┌──────────┐                       │
│  │   🧁     │  │   ➕     │                       │
│  │ Desery   │  │ Nowa     │                       │
│  └──────────┘  └──────────┘                       │
└───────────────────────────────────────────────────┘
```

---

## 11. Komponenty dzielone

### 11.1 `IngredientRow` (read-only)

```
┌──────────────────────────────────────────────┐
│ ☐  400 g  spaghetti          ⓘ masz: 250g   │
│                                              │
│   ↑ kategoria z ikoną z bazy Shopping        │
└──────────────────────────────────────────────┘
```

### 11.2 `IngredientRow` (edit)

```
┌─────────────────────────────────────────────────────────────┐
│ ⠿  [400 ]  [g  ▾]  [spaghetti              ]  [al dente]  ✕ │
│              ↑ autocomplete (Product)                        │
└─────────────────────────────────────────────────────────────┘
```

### 11.3 `StepRow` (edit)

```
┌─────────────────────────────────────────────────────────────┐
│ ⠿ Krok 1                                                ✕   │
│   [Tekst markdown wielowierszowy                       ]    │
│   ⏲ [10 ] min   🌡 [____]   [📷 dodaj zdjęcie]             │
└─────────────────────────────────────────────────────────────┘
```

### 11.4 `TagPicker`

Identyczny jak istniejący w Notes — reuse. Multi-select z możliwością tworzenia nowych tagów.

### 11.5 `DurationInput`

Specjalny input do czasów: liczbowy + dropdown („min" / „godz"). Konwersja do minut przy zapisie.

### 11.6 `ServingSelector`

```
[-]  4 porcje  [+]
```

Lub bottom sheet/dropdown z preset'ami: 1, 2, 4, 6, 8, custom.

### 11.7 `ShopForRecipeDialog`

```
┌──────────────────────────────────────┐
│  Dodaj do listy zakupów              │
│                                      │
│  Lista: [Tygodniowe zakupy ▾]        │
│  Porcje: [- 4 +]                     │
│                                      │
│  ☑ Pomiń spiżarnię                  │
│  ☐ Pomiń opcjonalne                 │
│                                      │
│  Składniki:                          │
│  ☑ 400g spaghetti                   │
│  ☑ 200g boczek                      │
│  ☐ 4 żółtka (masz: 6 szt)           │
│  ☑ 100g parmezan                    │
│  ☐ pietruszka (opcjonalne)          │
│                                      │
│  Dodam: 3 pozycje                    │
│  Pominę: 2 (1 w spiżarni, 1 opcj.)   │
│                                      │
│  [Anuluj]            [Dodaj 3 poz.]  │
└──────────────────────────────────────┘
```

---

## 12. Klawiatura — globalne skróty modułu Kuchnia

| Skrót | Akcja | Kontekst |
|-------|-------|----------|
| `Ctrl+K` | Command palette (z prefixami: „Kuchnia: ...") | Globalny |
| `g` `r` | Goto Recipes | Globalny |
| `g` `p` | Goto Plan | Globalny |
| `g` `s` | Goto Spiżarnia (pantry) | Globalny |
| `g` `b` | Goto Cookbooks | Globalny |
| `n` | Nowy (kontekstowo: przepis / wpis planu / produkt spiżarni) | W module |
| `/` | Focus search | W liście |
| `j` `k` | Nawigacja | W liście |
| `e` | Edytuj | Na elemencie |
| `d` | Usuń (z confirm) | Na elemencie |
| `c` | Cook mode | Na widoku przepisu |
| `s` | Do listy zakupów | Na widoku przepisu |
| `p` | Do planu | Na widoku przepisu |
| `+` / `-` | Skala porcji | Na widoku przepisu |
| `Ctrl+S` | Zapisz | W edytorze |
| `Esc` | Wyjdź / anuluj | Wszędzie |
| `Space` | Toggle składnik (checkbox) | W widoku przepisu |

### Command palette extensions

```
Kuchnia: Nowy przepis
Kuchnia: Importuj z URL
Kuchnia: Importuj ze zdjęcia
Kuchnia: Generuj przepis (AI)
Kuchnia: Pokaż plan tygodnia
Kuchnia: Wygeneruj listę zakupów z planu
Kuchnia: Inwentaryzacja spiżarni
Kuchnia: Co dziś gotuję? (AI sugestia)
Kuchnia: Co kończy się w lodówce?
```

---

## 13. Stany pośrednie

### 13.1 Loading

- Skeleton dla każdej karty (RecipeCard skeleton, PantryRow skeleton).
- Spinner tylko w przyciskach akcji (Server Action in-flight).
- Nigdy fullscreen spinner.

### 13.2 Errors

- Toast (4s) dla błędów akcji.
- Inline error pod inputem dla walidacji.
- Error boundary dla awarii komponentu — pokazuje „Coś poszło nie tak" + przycisk „Spróbuj ponownie".

### 13.3 Offline

- W MVP: pokaż banner „Brak połączenia, niektóre akcje mogą nie działać".
- W v1.1: Service Worker cache dla widoku przepisu (Cook Mode powinien działać offline).

### 13.4 Optimistic UI policies

| Akcja | Optimistic? |
|-------|-------------|
| Dodanie składnika/kroku | TAK |
| Reorder | TAK |
| Zmiana porcji (skala) | TAK (lokalnie, bez DB) |
| Usuń przepis | NIE (confirm dialog) |
| Mark cooked | TAK |
| Add to shopping list | NIE (czekaj na ack, pokaż toast) |
| Update pantry quantity | TAK |

---

## 14. Dostępność (a11y)

- Wszystkie inputy mają `<label>` z `htmlFor`.
- Drag handles mają `aria-label="Przenieś"`.
- Cook Mode: `aria-live="polite"` dla bieżącego kroku — czytnik ekranu odczyta po zmianie.
- Wszystkie buttony bez tekstu mają `aria-label`.
- Kontrast min 4.5:1 dla tekstu (sprawdzić tokeny `--text-muted` na `--bg-elevated`).
- Focus visible — `:focus-visible` outline.
- Klawiatura — wszystkie akcje dostępne bez myszy.

---

## 15. Wizualne tokens — extensions

Dodajemy do `globals.css`:

```css
:root {
  --accent-orange: #ff8a3d;        /* Kuchnia primary accent */
  --kitchen-pantry: #4caf50;       /* zielony dla pantry items */
  --kitchen-expiring: #ff9800;     /* pomarańczowy dla expiring */
  --kitchen-expired: #f44336;      /* czerwony dla expired */
  --kitchen-cook-bg: #050505;      /* czarne tło Cook Mode (kontrast) */
  --kitchen-cook-text: #ffffff;
}
```

---

## 16. Animacje (minimalistyczne)

| Co | Animacja | Czas |
|----|----------|------|
| Drag preview | fade-in | 100ms |
| Drop accept | scale 1.0 → 1.03 → 1.0 | 200ms |
| Toast pop | slide-up + fade | 200ms |
| Bottom sheet | slide-up from bottom | 300ms cubic-bezier |
| Cook Mode next/prev step | crossfade text 150ms | — |
| Skala porcji (zmiana ilości) | brak — instant | — |
| Hover na karcie | brak (mobile) / lift 1px (desktop) | 100ms |
| Wszystko inne | brak | — |

---

## 17. Mobile-specific UX

### 17.1 Gesty

- **Long-press na karcie przepisu** → quick menu (Edytuj, Duplikuj, Dodaj do planu, Usuń).
- **Swipe right** na karcie przepisu w liście → szybkie „Dodaj do listy zakupów".
- **Swipe left** na karcie przepisu w liście → archiwizuj.
- **Pull-to-refresh** → re-fetch listy.
- **Swipe down** na bottom sheet → zamknij.
- **Tap zone Cook Mode** lewa/prawa = poprzedni/następny.

### 17.2 Klawisze sprzętowe iPhone

- Brak (mobile Safari nie obsługuje keyboard shortcuts globalnych).
- Wewnątrz Cook Mode: jeśli podłączona klawiatura BT → strzałki ← → przełączają kroki.

### 17.3 Web App / PWA

Moduł powinien działać dobrze jako PWA:
- Manifest.json zawiera shortcuts:
  - „Co dziś gotuję" → otwiera `/kitchen/plan` na dzisiaj
  - „Spiżarnia" → otwiera `/kitchen/pantry`
- Icon dla Kuchnia.
- Offline (Service Worker) dla Cook Mode (cache krok-po-kroku po wejściu).

---

## 18. Cross-module UX

### 18.1 Z modułu Shopping

- Przycisk na liście zakupów: „Co mogę z tego ugotować?" → modal z propozycjami przepisów używających items z listy (AI).
- Przy pozycji z `recipeOrigin` — badge „🍽 z przepisu Carbonara" + klik → wraca do przepisu.
- W settings listy zakupów: „Auto-przenieś do spiżarni po DONE" (toggle).

### 18.2 Z Home (AI dashboard)

- Widget „Dziś gotuję": pokazuje dziś planowany posiłek + przycisk „Cook Mode".
- Widget „Kończy się w lodówce": top 3 PantryItem `< 3 dni`.
- Widget „Sugestia AI": klik generuje 1 przepis z spiżarni → szczegóły lub „Dodaj do planu".

### 18.3 Z Tasks

- W MVP: brak integracji.
- W v2.0: gotowanie planowanego posiłku może być zadaniem na konkretną godzinę (np. „Marynować mięso o 18:00 dzień przed").

---

## 19. Onboarding

Pierwsze wejście do `/kitchen`:

```
┌───────────────────────────────────────────────┐
│            👨‍🍳                                 │
│   Witaj w Kuchni                              │
│                                               │
│   Co chcesz zrobić jako pierwsze?             │
│                                               │
│   [📥 Zaimportować ulubiony przepis z neta]   │
│   [✏️  Wpisać przepis ręcznie]                │
│   [📚 Wybrać z gotowej bazy startowej]        │
│   [⏭  Pomiń, eksploruję sam]                  │
└───────────────────────────────────────────────┘
```

Po pierwszym przepisie → tooltip pokazujący „Spróbuj: kliknij 🛒 aby dodać składniki do listy zakupów".

---

## 20. Specyfikacja techniczna komponentów (skrócona)

### 20.1 `RecipeCard` props

```typescript
interface RecipeCardProps {
  recipe: RecipeListItem;
  variant?: "grid" | "list" | "compact";
  onClick?: (id: string) => void;
  onAddToPlan?: (id: string) => void;
  onAddToShopping?: (id: string) => void;
  showOrigin?: boolean;   // czy pokazać "własny / team / publiczny"
  highlightQuery?: string; // do podświetlania w search
}
```

### 20.2 `MealPlanWeek` props

```typescript
interface MealPlanWeekProps {
  weekStart: Date;
  teamId?: string;
  onSlotClick?: (date: Date, slot: MealSlot) => void;
  onSlotDrop?: (date: Date, slot: MealSlot, recipeId: string) => void;
  onMealCooked?: (entryId: string) => void;
}
```

### 20.3 `PantryRow` props

```typescript
interface PantryRowProps {
  item: PantryItem;
  expiringWarn?: number;   // dni do alertu (default 3)
  onQuantityChange?: (id: string, q: number) => void;
  onRemove?: (id: string) => void;
  onToggleAutoReplenish?: (id: string) => void;
}
```

---

## 21. Testy UX (manualne checklisty przed release'em)

### 21.1 Mobile (iPhone Safari)

- [ ] Cała lista przepisów scrolluje płynnie (60fps) przy 100+ przepisach
- [ ] Cover image lazy-loadowane (nie pobiera 100 zdjęć na start)
- [ ] Bottom sheet dla `ShopForRecipeDialog` otwiera się płynnie i nie zasłania zbyt wiele
- [ ] Cook Mode wakelock działa (ekran nie gaśnie przez 5 min)
- [ ] Long-press na karcie pokazuje quick menu bez konfliktu z scrollem
- [ ] DnD w edytorze działa po long-press
- [ ] Timery w Cook Mode wibrują przy końcu (`navigator.vibrate`)
- [ ] PWA install action działa
- [ ] Tryb landscape (na iPadzie) skaluje się rozsądnie

### 21.2 Desktop

- [ ] Wszystkie skróty klawiszowe działają i nie konfliktują z innymi modułami
- [ ] DnD w `MealPlanWeek` działa płynnie (drag z drawera → drop na slot)
- [ ] Auto-save w edytorze działa, ale nie spamuje serwera (debounce)
- [ ] Multi-window (otwarcie dwóch okien tej samej strony) nie powoduje desyncu
- [ ] Drukowanie przepisu (`Ctrl+P`) wygląda przyzwoicie (CSS print styles)

### 21.3 A11y

- [ ] Tab przez wszystkie pola edytora w sensownej kolejności
- [ ] Czytnik ekranu (VoiceOver) odczytuje kroki Cook Mode po zmianie
- [ ] Wszystkie kolory mają ≥ 4.5:1 kontrast
- [ ] Focus visible wszędzie

---

## 22. Najczęstsze błędy UX do uniknięcia

1. **Nie wymuszać Product na każdy składnik.** Człowiek wpisuje „szczyptę soli" — i tyle.
2. **Nie domyślnie wszystko jako team.** Jeśli user nie ma teamu, ukrywaj selektor.
3. **Nie mieszać porcji w edycji.** Edycja przepisu zawsze pokazuje ilości dla `recipe.servings` (zachowane). Skala porcji to tylko view.
4. **Cook Mode bez „Zamknij" w widocznym miejscu** = pułapka.
5. **Spiżarnia bez „grupowanie po lokalizacji"** = chaos przy 50+ produktach.
6. **Sugestie AI bez „regeneruj"** = irytujące jeśli pierwsza propozycja nie pasuje.
7. **Lista zakupów z planu bez podglądu** = czarna skrzynka, user nie wie co dostanie.

---

## 23. Załączniki

- `recipes-architecture.md` — pełna architektura (DB, actions, integracje)
- `recipes-analysis.md` — analiza funkcji, AI, roadmapy
- `recipes-summary.md` — wstęp dla nowej sesji Claude Code

---

**Koniec dokumentu UX v1.0.**
$kitchen_ux_2026_05_20$,
  'proposal',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Kuchnia — Dokument analityczny',
  'kitchen-analysis-2026-05-20',
  $kitchen_analysis_2026_05_20$# Kuchnia — Dokument analityczny

**Wersja:** 1.0
**Data:** 2026-05-20
**Status:** Do zatwierdzenia przed implementacją

---

## 1. Cel modułu

Stworzyć **moduł Kuchnia** który jest „killer feature" dla użytkownika rodzinnego: pełen workflow „od pomysłu na obiad do jego ugotowania" w jednym miejscu, z głęboką integracją z istniejącym modułem Zakupów. Główna hipoteza: integracja Przepisy ↔ Spiżarnia ↔ Plan posiłków ↔ Lista zakupów eliminuje 80% manualnej pracy gospodyni/gospodarza domowego.

---

## 2. Hipotezy i metryki sukcesu

### 2.1 Hipotezy

| # | Hipoteza | Sposób weryfikacji |
|---|----------|---------------------|
| H1 | Po włączeniu modułu user będzie używał aplikacji częściej (sesje/tydz) | Porównanie sesji/tydz przed i 30 dni po release |
| H2 | „Zrób zakupy do przepisu" będzie najczęściej używaną funkcją (>50% sesji w Kuchni) | UserActivity tracking |
| H3 | Plan tygodnia AI redukuje czas „decyzji co jeść" o 70% | Self-reported (ankieta), telemetria |
| H4 | Spiżarnia odejmie 30%+ pozycji z list zakupów | Porównanie ile pozycji `shopForRecipe` pomija po włączeniu spiżarni |
| H5 | Import z URL będzie wystarczająco dokładny by zachęcić do dodawania (>80% przepisów się parsuje OK) | A/B test importera, % manualnych poprawek |

### 2.2 KPI

| KPI | Target po 30 dniach | Pomiar |
|-----|---------------------|--------|
| Liczba przepisów w bazie / user | > 10 | `count(Recipe where ownerId=user)` |
| % userów którzy ugotowali przepis | > 50% | `count distinct userId where lastCookedAt IS NOT NULL` |
| % userów z planem tygodnia | > 30% | `count distinct userId in MealPlanEntry > 7d back` |
| Średnia liczba slot'ów wypełnionych w tygodniu | > 10 (z 28) | `avg(count by user, week)` |
| Avg items added per `shopForRecipe` call | 5-10 | `avg(length addedItems)` |
| % importów z URL kończących się sukcesem | > 80% | tracking importów, errors |
| % używania AI sugestii planu | > 20% sesji w `/plan` | tracking eventów |
| Cook Mode usage | > 40% przepisów ugotowanych przez Cook Mode | event `cookmode_completed` |

---

## 3. Analiza konkurencji (skrótowa)

### 3.1 Bezpośrednia konkurencja

| App | Plusy | Minusy | Czego się uczymy |
|-----|-------|--------|--------------------|
| **Paprika 3** | Świetny import z URL, klasa enterprise dla recipes | Brak rodzinnego udostępniania, drogi (płatny), brak AI | Import z URL musi być wzorowy. UX edycji składników bardzo polerowany. |
| **Mealime** | Excellent meal planning + shopping list integration | Tylko aplikacja, brak custom recipes, USA-only diet | Workflow „plan → lista" jest sensem istnienia. Skopiować i podrasować. |
| **Plan to Eat** | Solidny meal planner + shopping | Stary UX, drogi | Konsolidacja składników (sumowanie cebul) jest standardem. |
| **Notion / Obsidian recipes** | Pełna kontrola | Zero automatyzacji, manualne wszystko | Naszą przewagą jest *automatyka*. Nie kopiujemy podejścia „przepis jako dokument". |
| **AnyList** | Świetna lista zakupów + przepisy | Słaba integracja AI | Sharing rodzinny ma sens, idziemy w tym kierunku. |
| **Crouton** | Bardzo ładny natywny iOS | Tylko Apple, brak teams | Mobile UX bar jest wysoki. |

### 3.2 Pośrednia konkurencja

- **Yuka / Kitchen Stories / Tasty** — biblioteki przepisów. NIE konkurujemy — nie chcemy być wydawcą, chcemy być narzędziem dla *własnych* przepisów (+ import).
- **Reddit r/mealprep, FB grupy** — źródło przepisów. Wzmacniamy import z URL jako most.

### 3.3 Nasza przewaga konkurencyjna

1. **Pełna integracja z istniejącym systemem (Zakupy, Notatki, Tasks, Home).** Konkurencja to oddzielne apki.
2. **AI cross-cutting:** sugestie z spiżarni, plan tygodnia, parser składników, import OCR.
3. **Polskie + angielskie out-of-the-box** (większość konkurencji USA-only).
4. **Team sharing rodzinny** z osobnymi spiżarniami / planami / przepisami.
5. **Self-hosted feel** — bez tracking'u reklamowego, własne dane.
6. **Keyboard-first desktop** — żadna konkurencja nie ma tego dla power userów.

---

## 4. Analiza funkcji (priorytety)

### 4.1 Klasyfikacja MoSCoW

#### MUST (MVP — pierwsza wersja produkcyjna)

| Funkcja | Uzasadnienie |
|---------|--------------|
| CRUD przepisów (manual) | Bez tego nic nie zrobimy |
| Składniki z ilościami + jednostkami | Bez tego nie ma listy zakupów |
| Kroki przepisu | Bez tego nie ma „cook mode" |
| Tagi i filtry | Bez tego biblioteka 30+ przepisów jest niefunkcjonalna |
| „Dodaj składniki do listy zakupów" | Killer feature wg user requestu |
| Skala porcji | Trywialne, niezbędne |
| Team sharing | Bez tego nie ma sensu dla rodziny |
| Search po tytule | Podstawa nawigacji |

#### SHOULD (v1.0 — pełna wersja modułu)

| Funkcja | Uzasadnienie |
|---------|--------------|
| Plan posiłków (tydzień) | Drugi filar modułu |
| Generowanie listy z planu | Wzmacnia hipotezę H4 |
| Spiżarnia + integracja `skipPantry` | Trzeci filar |
| Cookbook'i | Organizacja przy 30+ przepisach |
| Import z URL | Niski bar wejścia |
| Cover image | Lista przepisów bez zdjęć jest brzydka |
| AI: parser składników z tekstu | Akcelerator wpisywania |
| AI: auto-kategoryzacja | Spójność danych |
| Cook Mode (fullscreen) | Killer feature mobile |
| Reordering DnD (składniki/kroki/plan) | Standard UX |

#### COULD (v1.1)

| Funkcja | Uzasadnienie |
|---------|--------------|
| AI: import ze zdjęcia (OCR + LLM) | Wow-feature, ale wymaga Vision API |
| AI: generacja przepisu z promptu | Dla power-userów |
| AI: sugestie ze spiżarni | „Co dziś gotuję?" |
| AI: plan tygodnia auto | Dla zaawansowanych |
| Auto-replenish spiżarni | Wygoda, ale wymaga skonfigurowania |
| Komentarze / oceny do przepisu | Wartość rośnie z team-em |
| Auto-fill spiżarni po DONE | Opcjonalne, ale eliminuje manual |
| Widget Home: „Co dziś gotuję" | Spina moduły |
| Voice Cook Mode (komendy) | Wow-feature, niski koszt jeśli już mamy STT |
| Wartości odżywcze (kalorie / makro) | Niche, ale potężne |

#### WON'T (poza scope MVP/v1.0)

- Publiczna baza przepisów (społeczność) — wymaga moderacji, ToS
- Marketplace przepisów (sprzedaż)
- Krawężniki dietetyczne (cukrzyca, alergie z medycznymi alertami)
- Integracja z dostawcami (zamów online)
- Skanowanie kodów kreskowych produktów (off-topic)
- Eksport do druku z layoutem 1:1 jak książka

---

## 5. Głęboka analiza: integracja z modułem Zakupy

### 5.1 Ścieżki danych

```
[Recipe.RecipeIngredient]
   │
   │ shopForRecipe(servings, skipPantry)
   │
   ├──→ Filter pantry?  ─── [PantryItem] ──→ skip if quantity >= needed
   │       │ NO
   │       ▼
   │   Scale by servings/recipe.servings
   │       │
   │       ▼
   ├──→ Map to Product (jeśli productId)
   │       │
   │       ▼
   ├──→ Categorize (jeśli brak productId)  ── lib/categorize.ts
   │       │
   │       ▼
   ├──→ Consolidate duplicates (po nazwie+jednostce)
   │       │
   │       ▼
   ├──→ Create Item[]  ──→ [ShoppingList]
   │       │
   │       ▼
   └──→ Link via ItemRecipeOrigin
```

### 5.2 Edge cases

| Case | Obsługa |
|------|---------|
| Składnik bez jednostki („szczypta soli") | Jednostka null, ilość null. Item powstaje jako „szczypta soli" bez quantity. |
| Składnik z jednostką ale bez ilości („sól do smaku") | Item z `quantity=null`, `unit="do smaku"`. |
| Spiżarnia ma 250g, przepis chce 400g | Item: 150g (różnica). UI w dialogu pokazuje „masz: 250g, dodam: 150g". |
| Spiżarnia ma 500g, przepis chce 400g | Item nie powstaje. UI pokazuje „masz: 500g, pomijam". |
| Składnik opcjonalny | Domyślnie ON w dialogu (user może zsnąć). Po stronie generatora — flaga `skipOptional`. |
| Dwa przepisy używają cebula 2 szt + 1 szt | Konsolidacja: 1 item „cebula 3 szt". `ItemRecipeOrigin` ma wpisy do obu przepisów (relation many-to-one — wymagałoby zmiany, lub one-to-many — fewer constraints). **Rozważ:** w MVP konsolidacja tylko gdy wszystkie składniki mają takie samo productId, inaczej osobne itemy. |
| Składnik z jednostkami niekompatybilnymi (200g i 1 szklanka) | Nie konsolidujemy. Osobne itemy. |
| Przepis ma składnik „brokuł", PantryItem ma „brokuł zielony" | Match po `productId` (jeśli oba pokazują na ten sam Product). Bez productId — brak match (UI pokazuje „nie znaleziono w spiżarni"). User może ręcznie połączyć. |

### 5.3 UX integracji

- **Z poziomu Recipe → Shopping:** dialog `ShopForRecipeDialog` (opisany w doc UX §11.7).
- **Z poziomu MealPlan → Shopping:** dialog `ShoppingFromPlanDialog` (opisany w UX §8.3).
- **Z poziomu Shopping → Recipe:** badge na item „🍽 z Carbonara" + klik = link do przepisu.
- **Z poziomu Shopping → Pantry:** auto-move po DONE (opcjonalne, settings).

### 5.4 Wzajemne wzbogacenia

- **Categorize.ts** już istnieje — Kuchnia z tego korzysta bez duplikacji.
- **Product useCount** naturalnie rośnie gdy używany w przepisach → lepsze sortowanie podpowiedzi w Shopping.
- **Stores (mapy)** — Item z `recipeOrigin` może być sortowany na liście według trasy w sklepie tak samo jak inne (bez zmian).

---

## 6. Głęboka analiza: AI w module

### 6.1 Use cases AI — szczegółowo

#### UC1: Parser składników z tekstu

**Trigger:** User wkleja blok tekstu w edytorze → klika „Parsuj".

**Wejście:** dowolny tekst typu:
```
400g spaghetti
200g boczku
4 jajka (lub same żółtka)
100g parmezanu
szczypta pieprzu
opcjonalnie: pietruszka
```

**Wyjście:** JSON:
```json
[
  {"name": "spaghetti", "quantity": 400, "unit": "g", "isOptional": false},
  {"name": "boczek", "quantity": 200, "unit": "g", "isOptional": false},
  {"name": "jajka", "quantity": 4, "unit": "szt", "note": "lub same żółtka", "isOptional": false},
  {"name": "parmezan", "quantity": 100, "unit": "g", "isOptional": false},
  {"name": "pieprz", "quantity": null, "unit": "szczypta", "isOptional": false},
  {"name": "pietruszka", "quantity": null, "unit": null, "isOptional": true}
]
```

**Model:** Haiku 4.5 (szybki, tani, wystarczająco dokładny).

**Fallback:** Regex parser (istniejący `parseQuantity.ts` rozszerzony do listy linii) — uruchamia się jeśli AI failuje, koszt zerowy.

**Test cases:**
- Poprawne formaty: `400g X`, `4 szt X`, `pół X`, `szczypta X`, `X (opcjonalnie)`, `1/2 X`
- Ciężkie: „2 średnie cebule", „garść X", „do smaku"
- Mieszane języki: pl + en (np. „1 cup mleka")

#### UC2: Import z URL

**Trigger:** User wkleja URL → klika „Importuj".

**Flow:**
1. Server fetchuje HTML.
2. Parsuje `<script type="application/ld+json">` → szuka `@type: Recipe` (Schema.org).
3. Jeśli znalazł → mapuje pole po polu → done.
4. Jeśli nie znalazł → fallback: ekstrakcja głównego tekstu (Readability) → LLM (Sonnet 4.6) z promptem „masz tekst strony, wyciągnij dane przepisu w schemacie X".
5. Zwraca `Recipe` (jeszcze niezapisany) → user widzi podgląd → akceptuje/edytuje → save.

**Edge cases:**
- Paywall (np. NYT Cooking) — fail z komunikatem „Strona wymaga subskrypcji".
- Strona w innym języku — LLM tłumaczy do pl.
- Strona ma 10 przepisów na jednej (np. blog z kompendium) — UI prosi user'a o wybór.

#### UC3: Import ze zdjęcia (OCR + Vision)

**Trigger:** User robi zdjęcie strony książki kucharskiej.

**Flow:**
1. Upload → Sharp resize do 2048px.
2. Wysyłka do Claude Sonnet 4.6 z Vision input + prompt „przeanalizuj zdjęcie, wyciągnij przepis".
3. JSON response → mapping na Recipe.
4. Preview + edit + save.

**Limity:** Jedno zdjęcie = jedna strona książki = jeden przepis. Multi-page → user robi kilka i scalają w jednym (manual UI „dodaj kolejne zdjęcie do tego przepisu").

#### UC4: Generacja przepisu z promptu

**Trigger:** User wpisuje „obiad z kurczaka na 4 osoby, polski, do 30 min".

**Flow:**
1. Server Action `generateRecipeFromPrompt(prompt)` → call Sonnet 4.6.
2. Prompt template forsuje JSON schema Recipe.
3. Response → preview + edit + save.

**Constraints w prompcie:**
- Domyślny system prompt informuje o preferencjach userów (lokalizacja PL, jednostki metryczne).
- Maks 2k token wygenerowane.
- Walidacja: czy zwrócony JSON ma min 3 składniki, min 2 kroki.

#### UC5: Sugestie ze spiżarni

**Trigger:** Klik „Co dziś gotuję?" lub auto-generowany widget na Home.

**Flow:**
1. Server fetchuje top 20 PantryItem (sortowanie: expiringSoon DESC).
2. Server fetchuje user's recipes (max 100).
3. Lokalna heurystyka: dla każdego przepisu policz % składników w spiżarni.
4. Top 5 → wysyła do LLM (Haiku) z promptem „wybierz 3 najlepsze biorąc pod uwagę expire date".
5. Zwraca 3 propozycje z uzasadnieniem (np. „bo zużywa mleko które kończy się jutro").

**Cache:** sugestie cachowane 1h (Redis-like in memory, bo serverless może być flaky).

#### UC6: Plan tygodnia AI

**Trigger:** User klika „✨ AI: zaproponuj plan" w `/plan`.

**Flow:**
1. Wizard preferencji (UX §8.4).
2. Server Action `suggestWeekPlan({weekStart, constraints})`.
3. Wysyłka do Opus 4.7 (drogi, ale jednorazowy) z dużym kontekstem:
   - Lista przepisów usera (tylko meta: title, mealType, cuisine, prepCook, tags).
   - Spiżarnia (top 30 produktów).
   - Constraints.
   - Poprzednie plany (max 2 ostatnie tygodnie — żeby unikać powtórek jeśli wybrano).
4. Response: array 28 slot'ów (7 dni × 4 sloty) z `recipeId` lub null + uzasadnienie.
5. UI: pokazuje propozycję, user akceptuje per slot lub all-in.

**Rate limit:** max 3× dziennie per user (drogi model).

#### UC7: Zamienniki składników

**Trigger:** Brak składnika → klik „🔁 zamiennik" przy składniku.

**Flow:**
1. Server Action `suggestSubstitute(ingredientId)` → call Haiku z kontekstem przepisu.
2. Zwraca 3 zamienniki + tekst „dlaczego".

**Use case:** Alergia, brak w sklepie, brak w spiżarni.

### 6.2 Tracking AI

Wszystkie wywołania AI logowane do `UserActivity`:
```typescript
{
  userId,
  type: "ai_kitchen",
  metadata: {
    feature: "parse_ingredients" | "import_url" | "import_image" | "generate" | "suggest_pantry" | "plan_week" | "substitute",
    model: "haiku-4.5" | "sonnet-4.6" | "opus-4.7",
    inputTokens: number,
    outputTokens: number,
    cost: number,        // szacunkowy w USD
    success: boolean,
    durationMs: number,
  }
}
```

Pozwala na:
- Limity per user.
- Monitoring kosztów (admin dashboard).
- Wyłączenie konkretnej funkcji per user jeśli generuje straty.

### 6.3 Etyka AI

- User zawsze widzi że zawartość jest AI-generowana (badge „✨ AI").
- Możliwość edycji wszystkiego co AI wygenerowało.
- Nigdy nie zapisujemy treści bez akceptacji user'a (preview → save).
- LLM nie ma dostępu do danych innych userów (każde wywołanie wstrzykuje tylko dane bieżącego usera/teamu).

---

## 7. Analiza ryzyk

### 7.1 Techniczne

| Ryzyko | Wpływ | Mitygacja |
|--------|-------|-----------|
| Cold start Render + Vision API timeout | M | Async processing dla import-ze-zdjęcia (job queue, status polling) |
| Cost overrun na LLM | H | Rate limiting, monitoring, alert >$10/mo |
| Migracja schema kruszy istniejące dane | H | Dry-run migracji na kopii prod DB przed wdrożeniem |
| Konflikt z innymi modułami (Tag globalny) | L | Już używamy Tag w Notes — kompatybilne |
| Slow query przy 1000+ przepisach w team | M | Indeksy + paginacja w `getRecipes()` |
| LLM zwraca błędny JSON | M | Zod walidacja + fallback do regex/manual edit |
| Race condition w MealPlan (dwóch userów team edytuje ten sam slot) | M | Last-write-wins + optimistic UI + revalidatePath po każdej zmianie |

### 7.2 Produktowe

| Ryzyko | Wpływ | Mitygacja |
|--------|-------|-----------|
| User dodaje 1 przepis i przestaje | H | Onboarding z 3-4 startowymi przepisami, mocny CTA na import URL |
| Spiżarnia rozjeżdża się z rzeczywistością → user przestaje ufać | H | Tryb StockTake na 1 klik, reminder co tydzień |
| Plan AI generuje nonsensy → user traci zaufanie | H | Constraints walidowane, każda sugestia z uzasadnieniem, łatwy „regeneruj" |
| Cook Mode pożera bateriere (wakelock) | L | Limit wakelock 60 min, user może wyłączyć w settings |
| User nie wie czym Spiżarnia różni się od Listy zakupów | M | Onboarding tooltip, pierwsze entry guided, ikona w sidebarze |

### 7.3 Biznesowe

| Ryzyko | Wpływ | Mitygacja |
|--------|-------|-----------|
| Wzrost kosztów (LLM + hosting + R2) | M | Rate limiting per user, paid tier dla power users |
| Adopcja niższa niż H1-H5 | M | Beta release z grupą BETA_TESTER, feedback loop, pivot |

---

## 8. Roadmapa

### 8.1 Faza 0 — Pre-implementation (1 tydzień)

- Zatwierdzenie 3 dokumentów (architektura, UX, analiza)
- Decyzje otwarte (§15 doc arch.)
- Setup R2 bucket (jeśli chcemy zdjęcia od MVP)
- Mini-mock w Figmie lub kod-skeleton

**Deliverable:** zatwierdzony plan, branch `feat/kitchen-0-skeleton`.

### 8.2 Faza 1 — MVP Recipes (2 tygodnie)

- Migration `0017_kitchen_module`
- `actions/recipes.ts` + `cookbooks.ts`
- `RecipeList`, `RecipeCard`, `RecipeView`, `RecipeEditor`
- `ShopForRecipeDialog` + `shopForRecipe()`
- Permissions setup
- Sidebar entry
- Manual testing

**Deliverable:** użyteczny moduł Recipes (bez plan / pantry / AI). Beta release dla siebie.

### 8.3 Faza 2 — Plan posiłków (1-2 tygodnie)

- `actions/mealPlans.ts`
- `MealPlanWeek` z DnD
- `generateShoppingListFromPlan()`
- Widget Home: „Co dziś gotuję"

**Deliverable:** Plan + lista z planu.

### 8.4 Faza 3 — Spiżarnia (1-2 tygodnie)

- `actions/pantry.ts`
- `PantryList`, `StockTakeMode`
- Integracja `skipPantry` w `shopForRecipe`
- Widget Home: „Termin ważności"

**Deliverable:** pełen trzy-filar (recipes + plan + pantry).

### 8.5 Faza 4 — AI integration (2-3 tygodnie)

- Parser składników (Haiku)
- Import URL (Sonnet)
- Auto-kategoryzacja przepisu
- Sugestie ze spiżarni
- Rate limiting + tracking

**Deliverable:** wszystkie podstawowe funkcje AI.

### 8.6 Faza 5 — Polish + v1.0 (1-2 tygodnie)

- Cook Mode (fullscreen + wakelock + timery)
- Zdjęcia (R2 upload)
- Import OCR (Vision)
- Plan tygodnia AI (Opus)
- Drobne polerki UX (animacje, onboarding)

**Deliverable:** v1.0 — pełny moduł, gotowy do beta-release w społeczności.

### 8.7 Faza 6 — v2.0 (długi termin)

- Voice mode w Cook Mode
- Wartości odżywcze
- Eksport PDF / druk
- Publiczna baza (społeczność) — wymaga moderacji
- Integracje (Google Calendar dla planu, ekspert dla zamówień online)

### 8.8 Sumaryczny estimate

- **MVP (Faza 0-1):** 2-3 tygodnie
- **v1.0 (Faza 0-5):** 8-10 tygodni
- **v2.0:** kolejne 4-6 tygodni

(Przy założeniu jednego developera, part-time.)

---

## 9. Wzorce wykorzystywane z istniejącego kodu

### 9.1 Re-use bez modyfikacji

- `src/lib/categorize.ts` — kategoryzacja składników.
- `src/lib/parseQuantity.ts` — parsing inline w inputach.
- `src/lib/permissions.ts` — RBAC framework.
- `src/lib/server-utils.ts` (`requireAuth`, `getUserTeamIds`) — auth helpers.
- `src/components/ui/*` — Radix wrapper components.
- `src/hooks/useKeyboardShortcuts.ts` — shortcuts engine.
- `Tag` model — współdzielone tagi.

### 9.2 Re-use z drobnymi rozszerzeniami

- `src/lib/llm-client.ts` — dodać nowe funkcje dla kitchen (zachować strukturę).
- `src/actions/items.ts` — dodać `addItemFromRecipe` (alias na `addItemStructured` z `recipeOrigin`).
- `AppShell.tsx` — dodać entry „Kuchnia" w sidebarze + mobile selectorze.
- `CommandPalette.tsx` — dodać sekcję „Kuchnia".

### 9.3 Nowe wzorce do wprowadzenia

- **Bottom sheet** (Radix Dialog z mobile-first position) — nie używamy jeszcze. Skopiować patterny z Vaul lub własna implementacja.
- **Drag-and-drop** (`@dnd-kit`) — nie używamy jeszcze.
- **Wakelock API** — nowe.
- **Voice STT** (v2.0) — nowe.

---

## 10. Wpływ na inne moduły

### 10.1 Shopping

- **Plusy:** więcej wpływów na listy, wzrost użycia.
- **Zmiany:** dodanie pola `recipeOrigin` na `Item` (relation), badge w UI, opcjonalny auto-fill pantry po DONE.
- **Ryzyka:** brak.

### 10.2 Tasks

- Brak zmian w MVP. W v2.0 potencjalna integracja (prep tasks).

### 10.3 Notes

- Współdzielony `Tag` — koegzystencja.
- W przyszłości: konwersja Notatka → Przepis (parser LLM).

### 10.4 Home (AI dashboard)

- Dodatkowe widgety (opisane w §11.4 doc arch.).
- Pozytywny wpływ — Home staje się ciekawsze.

### 10.5 Admin

- Nowe permissions do nadawania.
- Admin może edytować/usuwać dowolny przepis (przyciski w UI gated `RECIPE_EDIT_ANY`).

---

## 11. Dane analityczne do gromadzenia (instrumentacja)

Lista zdarzeń `UserActivity.type`:

```
kitchen_view              | wejście do modułu
recipe_create
recipe_edit
recipe_delete
recipe_view               | otwarcie przepisu
recipe_import_url
recipe_import_image
recipe_generate_ai
recipe_shop_clicked       | klik „dodaj do listy"
recipe_shop_completed     | dialog zamknięty z dodaniem
mealplan_view
mealplan_entry_set
mealplan_generate_shop
mealplan_suggest_ai
pantry_view
pantry_item_add
pantry_stocktake
pantry_autoreplenish_run
cookmode_start
cookmode_completed
cookmode_timer_used
ai_kitchen                | każde wywołanie AI z meta
```

Pozwala na cohort analysis i tracking adoption per feature.

---

## 12. Specyfikacja AI promptów (wzorce)

### 12.1 Wspólny system message

```
Jesteś asystentem kulinarnym w aplikacji WorldOfMag.
Mówisz po polsku, ale rozpoznajesz oba języki (pl, en).
Używasz metrycznego systemu jednostek (g, kg, ml, l, szt).
Zawsze zwracasz JSON wg podanego schematu. Nie dodajesz tekstów wprowadzających ani podsumowań.
Jeśli nie potrafisz wykonać zadania, zwracasz `{"error": "...", "reason": "..."}`.
```

### 12.2 Per use-case prompts są w `src/lib/llm-prompts/kitchen/`:

- `parseIngredients.ts`
- `importFromUrl.ts`
- `importFromImage.ts`
- `generateRecipe.ts`
- `suggestFromPantry.ts`
- `planWeek.ts`
- `substituteIngredient.ts`

Każdy plik exportuje:
```typescript
export const systemMessage: string;
export const userTemplate: (input: T) => string;
export const outputSchema: ZodSchema;
```

---

## 13. Dostępność i lokalizacja

### 13.1 Lokalizacja (i18n)

- MVP: tylko polski (zgodnie z całą aplikacją).
- v2.0: rozważyć angielski (jeśli adoption rośnie).
- AI prompts respektują locale usera.

### 13.2 A11y

- WCAG 2.1 AA target.
- Wszystkie wymagania w doc UX §14.

---

## 14. Bezpieczeństwo

### 14.1 Walidacja inputu

- Wszystkie Server Actions z Zod validation.
- Markdown w `notes`, `steps.text` sanitized przy renderze (DOMPurify lub remark).
- Upload zdjęć: walidacja MIME + magic bytes + max size 5MB.

### 14.2 Authorization

- Każda mutacja: `requireAuth()` + `assertXAccess()`.
- Public recipes: read-only dla nie-ownerów.

### 14.3 Rate limiting

- AI: limity per user (§6.2 doc arch.).
- Uploads: max 100 zdjęć / user / dzień.
- Mutacje: brak globalnego limitu (auth wystarczy).

### 14.4 LLM safety

- Prompt injection: input usera w `<user_input>` tag, system message instruuje by ignorować instrukcje z `user_input`.
- Output walidacja Zod, błąd → fallback bez crash'a.

---

## 15. Co odpadło z listy pomysłów (i dlaczego)

Podczas projektowania rozważałem wiele pomysłów. Większość odpadła. Lista z uzasadnieniem (żeby nie wracać do nich bez powodu):

| Pomysł | Dlaczego odpadł |
|--------|------------------|
| Scanner kodów kreskowych do pantry | Out-of-scope, wymaga natywnego API, niska wartość |
| Powiadomienia push przy zbliżającym się terminie | Wymaga push notification infra (Web Push), v2.0 |
| Społeczność i sharing publiczny | Wymaga moderacji, ToS, ryzyko misuse |
| Integracja z dostawcami (Frisco, Carrefour) | Niezgodne z modelem self-hosted, kruche API |
| AI auto-gotujący (np. „idziemy" w czasie rzeczywistym) | Gimmick, low value vs. effort |
| Wersjonowanie przepisów (Git-like) | Over-engineered |
| Wieloosobowa edycja na żywo (collab cursor) | Over-engineered, mała wartość |
| Pomiary składników (kalorie per gram własną bazą) | Lepiej delegować do AI / API zewn. |
| Lista listków zakupów per sklep z różnymi cenami | Wymaga DB cen, niestabilne, niska wartość |
| AI sommelier (winowe pary do przepisu) | Funny ale niche |
| Dieta / coaching | Off-topic, ryzyko medyczne |
| Recipe meal kit (subskrypcja składników) | Wymaga supply chain, off-topic |
| Dark patterns („recipe of the day" reklama) | Konflikt z filozofią produktu |
| Reklamy / sponsored recipes | Nie monetyzujemy, self-hosted |
| Generator zdjęć przepisów AI | Hallucinacje, prawne ryzyko, niska wartość |

---

## 16. Konkluzja i rekomendacja

Moduł Kuchnia ma silne uzasadnienie biznesowe i UX-owe. Architektonicznie pasuje do istniejącego stylu, nie wymaga przepisywania czegokolwiek, daje natychmiastową wartość przez integrację z Shopping.

**Rekomendacja: zatwierdzić plan i rozpocząć od Fazy 1 (MVP Recipes + ShopForRecipe).** Plan i Spiżarnia w kolejnych iteracjach po feedback z używania MVP.

Główne ryzyka są kontrolowane:
- Koszty AI → rate limiting + monitoring.
- Adopcja → onboarding + seed przepisy.
- Spiżarnia drift → StockTake mode.

---

## 17. Załączniki

- `recipes-architecture.md` — pełna architektura (DB, actions, integracje)
- `recipes-ux.md` — pełna specyfikacja UX
- `recipes-summary.md` — wstęp dla nowej sesji Claude Code

---

**Koniec dokumentu analitycznego v1.0.**
$kitchen_analysis_2026_05_20$,
  'proposal',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Kuchnia — Raport końcowy sesji',
  'kitchen-summary-2026-05-20',
  $kitchen_summary_2026_05_20$# Kuchnia — Raport końcowy z sesji przygotowawczej

**Wersja:** 1.0
**Data:** 2026-05-20
**Sesja:** sesja przygotowawcza (Claude Opus 4.7) — branch `claude/recipes-meal-planning-ZxFOF`
**Status:** Brak implementacji — tylko dokumentacja przygotowawcza

---

## 1. Streszczenie zarządcze

Sesja przygotowawcza dla nowego działu **„Kuchnia"** w aplikacji WorldOfMag. Brief od użytkownika dotyczył przepisów + planowania posiłków + integracji z Zakupami. W trakcie sesji zaprojektowałem **jeden parasolowy moduł „Kuchnia"** zawierający 4 podstrony (Przepisy, Plan posiłków, Spiżarnia, Książki kucharskie) z głęboką integracją AI i istniejącego systemu.

W repozytorium dodano **4 dokumenty** (3 specyfikacje + ten raport) zarówno jako pliki markdown w `worldofmag/docs/recipes/` jak i jako rekordy w tabeli `Report` (kategoria `proposal`) widoczne w `/admin/reports`.

**Nie wprowadzono żadnych zmian w kodzie aplikacji.** Następna sesja Claude Code, otrzymując prompt z §6, ma wszystko czego potrzebuje by zaimplementować moduł.

---

## 2. Brief od użytkownika (rekapitulacja)

Użytkownik zlecił:

1. Stworzenie nowego działu „Receptury i Kuchnia" w aplikacji.
2. Funkcjonalności: dodawanie przepisów (składniki + kroki), „zrób zakupy do przepisu", tagi, planowanie posiłków na tydzień, wspólna baza receptur teamu.
3. Rozważenie czy potrzebny jest drugi dział „Żywienie" lub czy połączyć w jeden „Żywność/Kuchnia".
4. Przemyślenie funkcji + AI integracji.
5. UX perfect na mobile i desktop.
6. Trzy dokumenty: architektoniczny, UX, analityczny.
7. Dodanie wszystkich dokumentów jako raporty admin.
8. Raport końcowy z opisem sesji + prompt dla nowej sesji.

Oczekiwany efekt: profesjonalna dokumentacja gotowa do implementacji przez nową sesję Claude Code.

---

## 3. Co zrobiłem

### 3.1 Eksploracja kodu (przed projektowaniem)

Przeczytałem:
- `worldofmag/CLAUDE.md` — pełne instrukcje projektu
- `worldofmag/prisma/schema.prisma` — wszystkie modele DB
- `worldofmag/src/actions/reports.ts` — jak działa system raportów
- `worldofmag/src/actions/items.ts` (fragmenty) — jak działa Shopping
- `worldofmag/src/components/shell/AppShell.tsx` (fragmenty) — gdzie wstawić sidebar entry
- `worldofmag/src/app/admin/reports/page.tsx` — UI raportów
- Modele: `Recipe` (nowy), `Report`, `Item`, `ShoppingList`, `Product`, `Tag`, `Team`, `Note`, `TaskProject`

### 3.2 Decyzje architektoniczne

| Pytanie z briefa | Moja odpowiedź | Uzasadnienie |
|------------------|-----------------|--------------|
| Czy jeden czy dwa moduły? | **Jeden moduł „Kuchnia"** z 4 podstronami | Synergia danych, prostsza nawigacja, AI łączy filary |
| Co w podstronach? | Przepisy + Plan posiłków + Spiżarnia + Książki kucharskie | Pokrywa cały workflow „od pomysłu do gotowania" |
| Czy oddzielny model „Żywienie"? | Nie | Pantry + plan + przepisy realizują żywienie bez osobnego modułu |
| Czy nutrition (kalorie)? | v2.0, nie MVP | Niche, wymaga API zewnętrznych |
| Czy zdjęcia w MVP? | Tylko cover URL z importu URL. Pełen upload → v1.0 (R2). | Redukcja zakresu MVP |
| Czy AI ma być od początku? | MVP bez AI. AI od fazy 4. | Funkcje AI mają wartość tylko gdy jest co przeszukiwać |

### 3.3 Pliki utworzone

| Plik | Lokalizacja | Rola |
|------|-------------|------|
| `recipes-architecture.md` | `worldofmag/docs/recipes/` | Pełna architektura: DB schema (10 nowych modeli), Server Actions API, integracje, AI, RBAC, deployment |
| `recipes-ux.md` | `worldofmag/docs/recipes/` | Specyfikacja UX: 23 sekcje (persona, screeny mobile+desktop, komponenty, klawiatura, animacje, a11y, gesty) |
| `recipes-analysis.md` | `worldofmag/docs/recipes/` | Analiza: hipotezy + KPI, konkurencja, MoSCoW, AI use-cases, ryzyka, roadmapa, wpływ na moduły |
| `recipes-summary.md` | `worldofmag/docs/recipes/` | Ten raport |
| `scripts/seed-recipes-reports.js` | `worldofmag/scripts/` | Skrypt seedujący 4 raporty do tabeli Report |

### 3.4 Raporty w DB

Skrypt `scripts/seed-recipes-reports.js` upsertuje 4 rekordy do tabeli `Report` z:
- `category: "proposal"`
- `slug: kitchen-architecture-2026-05-20` / `kitchen-ux-2026-05-20` / `kitchen-analysis-2026-05-20` / `kitchen-summary-2026-05-20`
- `title`: pełne polskie tytuły
- `content`: zawartość z plików markdown (czytane przy seedowaniu)
- `authorId`: ID użytkownika tyka.szymon@gmail.com (lookup po email)

Sposób uruchomienia (lokalnie lub na Render):

```bash
cd worldofmag
node scripts/seed-recipes-reports.js
```

Skrypt jest idempotentny (upsert po slug) — można uruchamiać wielokrotnie.

---

## 4. Pomysły rozważane podczas projektowania

### 4.1 Pomysły WŁĄCZONE do planu

Wymienione w dokumentach. Najważniejsze:

- **„Cook Mode" fullscreen** z wakelockiem i tap-zones (mobile killer feature)
- **Konsolidacja składników w generowaniu listy** (3 przepisy używające cebulę → 3 szt cebuli)
- **`recipeOrigin` na Item** — pozwala cofnąć dodanie, statystyki gotowania, badge na liście
- **Auto-replenish ze spiżarni** — dolny próg → auto-dodaj do listy
- **Auto-feed do spiżarni po DONE w Shopping** (opt-in)
- **AI parser składników** (paste tekst → strukturalna lista)
- **AI import z URL** (JSON-LD + LLM fallback)
- **AI sugestie ze spiżarni** („Co dziś z tego co mam?")
- **AI plan tygodnia** z constraints
- **Książki kucharskie** jako grupowanie przepisów
- **Tryb StockTake** dla szybkiej inwentaryzacji
- **Wspólny `Tag` z Notes** (no duplikacja)
- **Custom title w MealPlan** („obiad u babci" — bez przepisu)
- **DnD reordering** (`@dnd-kit`)

### 4.2 Pomysły ODRZUCONE (z uzasadnieniem)

Pełna lista w `recipes-analysis.md` §15. Najważniejsze:

| Pomysł | Powód odrzucenia |
|--------|--------------------|
| Scanner kodów kreskowych | Out-of-scope, wymaga natywnego API |
| Publiczna baza społecznościowa | Wymaga moderacji, ToS, ryzyko misuse |
| Integracja z dostawcami (Frisco itp.) | Niezgodne z self-hosted, kruche API |
| Wieloosobowa edycja na żywo | Over-engineered |
| Versioning przepisów (Git-like) | Over-engineered |
| Pomiary kalorii z własnej bazy | Lepiej delegować do AI / API |
| Push notifications o terminie | Wymaga push infra (v2.0) |
| AI generator zdjęć przepisów | Hallucinacje, ryzyko prawne |
| AI sommelier | Funny ale niche |
| Dieta / coaching | Off-topic, ryzyko medyczne |
| Marketplace przepisów | Out-of-scope |
| Skanowanie czeków sklepowych | Niska wartość vs. koszt |

### 4.3 Pomysły otwarte (decyzja na fazę 0 implementacji)

Lista pytań w `recipes-architecture.md` §15:
1. Publiczna baza przepisów (community) — tak/nie?
2. Czy zdjęcia w MVP są niezbędne?
3. Voice mode w Cook Mode — kiedy?
4. Limit rozmiaru `notes` (50 000 znaków)?
5. Repetitive meals w MealPlan (np. owsianka codziennie)?
6. Hosting zdjęć — R2 vs. URL z neta?
7. `customTitle` w MealPlanEntry — zostawić?
8. Integracja z Kalendarzem Google (gdy powstanie moduł Kalendarz)?

---

## 5. Spis treści dokumentów (krótka mapa)

### 5.1 `recipes-architecture.md` (16 sekcji)

1. Streszczenie zarządcze
2. Decyzja: jeden moduł czy dwa? (Opcja A — Kuchnia)
3. Schemat bazy danych (10 nowych modeli Prisma + zmiany w User/Team/Product/Tag/Item)
4. Routing i struktura plików (App Router + komponenty)
5. Integracje z istniejącymi modułami (Shopping, Notes, Tasks, Home, Teams)
6. Integracja AI/LLM (11 use-cases, modele, rate limiting)
7. Permissions / RBAC (13 nowych slugów)
8. Upload plików (Cloudflare R2)
9. Caching i wydajność
10. Testy
11. Migracja danych / BC
12. Wdrożenie etapami (6 faz)
13. Ryzyka i mitygacje
14. Dependencies do dodania
15. Otwarte pytania
16. Załączniki

### 5.2 `recipes-ux.md` (23 sekcje)

1. Persona i konteksty użycia
2. Filozofia projektowa
3. Mapa ekranów
4. Lista przepisów (`/kitchen/recipes`)
5. Widok przepisu
6. Edycja przepisu
7. Cook Mode (fullscreen)
8. Plan posiłków
9. Spiżarnia
10. Książki kucharskie
11. Komponenty dzielone
12. Klawiatura — globalne skróty
13. Stany pośrednie (loading, errors, offline)
14. Dostępność (a11y)
15. Wizualne tokens — extensions
16. Animacje (minimalistyczne)
17. Mobile-specific UX (gesty, klawisze, PWA)
18. Cross-module UX
19. Onboarding
20. Specyfikacja techniczna komponentów
21. Testy UX (manualne checklisty)
22. Najczęstsze błędy UX do uniknięcia
23. Załączniki

### 5.3 `recipes-analysis.md` (17 sekcji)

1. Cel modułu
2. Hipotezy i metryki sukcesu (5 hipotez + 8 KPI)
3. Analiza konkurencji
4. Analiza funkcji (MoSCoW)
5. Integracja z Zakupami (ścieżki danych + edge cases)
6. Analiza AI (7 use-cases szczegółowo + etyka + tracking)
7. Analiza ryzyk (techniczne, produktowe, biznesowe)
8. Roadmapa (6 faz, estimate 8-10 tygodni do v1.0)
9. Wzorce wykorzystywane z istniejącego kodu
10. Wpływ na inne moduły
11. Dane analityczne do gromadzenia
12. Specyfikacja AI promptów (wzorce)
13. Dostępność i lokalizacja
14. Bezpieczeństwo
15. Co odpadło z listy pomysłów
16. Konkluzja i rekomendacja
17. Załączniki

### 5.4 `recipes-summary.md` (ten plik)

Brief + co zrobiłem + pomysły + prompt dla nowej sesji.

---

## 6. PROMPT dla nowej sesji Claude Code (do skopiowania)

Poniżej gotowy prompt do wklejenia w nowej sesji Claude Code. Prompt zakłada że nowa sesja startuje w katalogu repozytorium `styka/home` na branchu `claude/recipes-meal-planning-ZxFOF` (lub po pull/checkout tej gałęzi).

> Jeśli sesja startuje na innym branchu — wymień `git fetch && git checkout claude/recipes-meal-planning-ZxFOF` jako pierwszy krok.

---

### ── KOPIUJ OD TUTAJ ─────────────────────────────────────────────

Wprowadzasz nowy moduł **„Kuchnia"** do aplikacji WorldOfMag (Next.js 14 + Prisma + Postgres + Tailwind, repo `styka/home`).

**Pełna specyfikacja jest już w repo.** Twoim zadaniem jest implementacja zgodnie z planem, NIE wymyślanie od nowa.

## Krok 1 — Wczytaj specyfikacje

Przeczytaj kolejno te pliki — to są twoje ostateczne wytyczne:

1. `worldofmag/CLAUDE.md` — instrukcje projektu (musisz znać konwencje)
2. `worldofmag/docs/recipes/recipes-architecture.md` — DB schema, Server Actions API, integracje, AI, RBAC, deployment, dependencies
3. `worldofmag/docs/recipes/recipes-ux.md` — screen-by-screen UX (mobile + desktop), komponenty, klawiatura, gesty, a11y
4. `worldofmag/docs/recipes/recipes-analysis.md` — MoSCoW, AI use-cases szczegółowo, ryzyka, roadmapa, KPI
5. `worldofmag/docs/recipes/recipes-summary.md` — kontekst sesji przygotowawczej + listę pomysłów odrzuconych (żeby nie wracać)

Te same dokumenty są też w bazie danych jako Report (admin → /admin/reports), kategoria `proposal`, slugi:
- `kitchen-architecture-2026-05-20`
- `kitchen-ux-2026-05-20`
- `kitchen-analysis-2026-05-20`
- `kitchen-summary-2026-05-20`

Jeśli lokalna kopia plików md nie istnieje — pobierz je z `Report.content` przez `prisma studio` lub query.

## Krok 2 — Zatwierdź otwarte pytania (jeśli user dostępny)

W `recipes-architecture.md` §15 są 8 otwartych pytań. Przed startem implementacji **zapytaj usera** o decyzje. Jeśli user każe pominąć ten krok — przyjmij rekomendowane defaulty:

1. Publiczna baza społeczność: **NIE** (poza scope)
2. Zdjęcia w MVP: **NIE** (tylko cover URL z importu URL — pełen upload v1.0)
3. Voice mode: **v2.0** (nie MVP)
4. Limit `notes`: **50 000 znaków**
5. Repetitive meals: **NIE w MVP** (manual copy między dniami wystarczy)
6. Hosting zdjęć: **Cloudflare R2** (kiedy faza 5)
7. `customTitle` w MealPlanEntry: **TAK, zostawić**
8. Integracja Google Calendar: **odłożone do powstania modułu Kalendarz**

## Krok 3 — Zacznij od Fazy 1 (MVP Recipes)

Zgodnie z roadmapą w `recipes-analysis.md` §8 i `recipes-architecture.md` §12. Faza 0 (skeleton) i Faza 1 (MVP Recipes + ShopForRecipe) to **pierwszy przyrost wdrożeniowy**.

### Faza 0 (skeleton):
- [ ] Stwórz Prisma migrację `0017_kitchen_module` zgodnie z §3 architektury (10 nowych modeli + relations na User/Team/Product/Tag/Item).
- [ ] Dodaj nowe permissions slugi do `src/lib/permissions.ts` zgodnie z §7.1 architektury.
- [ ] Dodaj sidebar entry „Kuchnia" w `src/components/shell/AppShell.tsx` (ikona ChefHat, kolor `--accent-orange`, href `/kitchen`).
- [ ] Stwórz routing skeleton w `src/app/kitchen/` (puste page.tsx z „Wkrótce" + redirect z `/kitchen` na `/kitchen/recipes`).
- [ ] Tabbed nav komponent (Przepisy | Plan | Spiżarnia | Książki) w `KitchenLayout.tsx`.
- [ ] Commit + push branch.

### Faza 1 (MVP Recipes):
- [ ] `src/actions/recipes.ts` — pełen API zgodnie z §4.3.1 architektury (CRUD + ingredient/step CRUD + shopForRecipe).
- [ ] `src/actions/cookbooks.ts` — CRUD.
- [ ] Komponenty: RecipeList, RecipeCard, RecipeFilters, RecipeView, RecipeEditor (z IngredientList, StepList), ShopForRecipeDialog, ServingSelector. Szczegóły UX w `recipes-ux.md` §4-6 i §11.
- [ ] Manualne wpisywanie przepisów (bez AI, bez importu URL).
- [ ] Auth check `assertRecipeAccess` w każdej mutacji.
- [ ] Test ścieżki end-to-end: stwórz przepis → otwórz widok → kliknij „Do listy zakupów" → zobacz pozycje na liście.
- [ ] Commit + push.

## Krok 4 — Tworzenie commitów

Małe commity, jeden commit per logiczna jednostka (jedna migracja, jeden komponent, jeden actions file). Wiadomości po polsku (zgodnie ze stylem repo):

```
feat(kitchen): migracja 0017_kitchen_module — schema dla nowego modułu
feat(kitchen): actions/recipes.ts — pełen CRUD przepisów
feat(kitchen): RecipeList + RecipeCard — biblioteka przepisów na mobile/desktop
feat(kitchen): ShopForRecipeDialog — integracja z modułem Zakupy
```

## Krok 5 — Po każdym błędzie dopisz lekcję

CLAUDE.md mówi: każdy bug/błąd/konflikt → wpis w `doświadczenia.md`. Pamiętaj o tej zasadzie zwłaszcza przy:
- migracji Prismy (na Render może być inaczej niż lokalnie)
- integracji z istniejącym Item / categorize / parseQuantity
- konfliktach przy `select` w Prismie (lekcja z 2026-05-20 w `doświadczenia.md`)

## Krok 6 — Zatrzymaj się po Fazie 1

Po skończeniu Fazy 1 **zatrzymaj się i pokaż userowi**. Faza 2-5 to kolejne PR-y, nie próbuj robić wszystkiego naraz. User da feedback i decyzję czy iść dalej z Plan / Pantry / AI.

## Czego NIE robisz

- ❌ Nie modyfikujesz katalogu `_old/`, `src/` (legacy AngularJS), `pom.xml` (legacy Spring Boot)
- ❌ Nie tworzysz testów jeśli nie ma istniejącego setupu (zaproponuj userowi)
- ❌ Nie zmieniasz typu `Item.status` na Prisma enum (CLAUDE.md gotcha #4)
- ❌ Nie sugerujesz Vercel / Fly.io (CLAUDE.md gotcha #1-2)
- ❌ Nie dodajesz funkcji AI w Fazie 1 (są fazą 4 wg roadmapy)
- ❌ Nie tworzysz `prompt()` / `alert()` / `confirm()` (lekcja z 2026-05-20)
- ❌ Nie dodajesz Server Action bez `requireAuth()` (lekcja z 2026-05-20)

## Dependencies do zainstalowania na początku Fazy 0

```bash
cd worldofmag
npm install @dnd-kit/core @dnd-kit/sortable date-fns
```

(Sprawdź czy któreś już są w `package.json`.)

## Branch i flow

Pracujesz na `claude/recipes-meal-planning-ZxFOF`. NIE rób merge'a do `master` — to decyzja usera po review.

---

### ── KOPIUJ DO TUTAJ ─────────────────────────────────────────────

---

## 7. Sanity check przed użyciem promptu

Przed wysłaniem promptu do nowej sesji upewnij się że:

- [ ] Branch `claude/recipes-meal-planning-ZxFOF` jest wypchnięty na origin.
- [ ] Pliki w `worldofmag/docs/recipes/*.md` są w gicie i wypchnięte.
- [ ] Skrypt `worldofmag/scripts/seed-recipes-reports.js` jest wypchnięty.
- [ ] (Opcjonalnie) Skrypt został uruchomiony lokalnie lub na Render, raporty są widoczne w `/admin/reports`.

Komenda do weryfikacji raportów w DB (lokalnie):

```bash
cd worldofmag
npx prisma studio
# → tabela Report → filter slug starts with "kitchen-"
```

---

## 8. Następne kroki dla usera

1. Przejrzyj 3 dokumenty (architektura, UX, analiza).
2. Odpowiedz na otwarte pytania z `recipes-architecture.md` §15 (lub zaakceptuj defaulty).
3. (Opcjonalnie) Uruchom `node scripts/seed-recipes-reports.js` — wstawi raporty do DB. (Można też zostawić tylko jako pliki md.)
4. Otwórz nową sesję Claude Code, wklej prompt z §6.
5. Po Fazie 1 — review, feedback, decyzja czy kontynuować z Fazą 2.

---

## 9. Statystyki sesji

- Czas: ~1h (sesja przygotowawcza, bez implementacji)
- Pliki utworzone: 5 (4 dokumenty md + 1 skrypt JS)
- Linie utworzone: ~2200 linii dokumentacji
- Pliki zmodyfikowane: 0 (zero ingerencji w kod aplikacji)
- Commitów: 1 (planowane)
- Branch: `claude/recipes-meal-planning-ZxFOF`

---

**Koniec raportu końcowego v1.0.**

*Powodzenia w implementacji 👨‍🍳*
$kitchen_summary_2026_05_20$,
  'proposal',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

