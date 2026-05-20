# Kuchnia — Dokument architektoniczny

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
