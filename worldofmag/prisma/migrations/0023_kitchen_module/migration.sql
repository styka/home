-- ─── Kitchen / Recipes module ─────────────────────────────────────────────

-- Cookbook
CREATE TABLE "Cookbook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '📚',
    "color" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cookbook_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Cookbook_ownerId_idx" ON "Cookbook"("ownerId");
CREATE INDEX "Cookbook_ownerTeamId_idx" ON "Cookbook"("ownerTeamId");
ALTER TABLE "Cookbook" ADD CONSTRAINT "Cookbook_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cookbook" ADD CONSTRAINT "Cookbook_ownerTeamId_fkey"
  FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recipe
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "introMarkdown" TEXT DEFAULT '',
    "notes" TEXT DEFAULT '',
    "servings" INTEGER NOT NULL DEFAULT 2,
    "prepMinutes" INTEGER,
    "cookMinutes" INTEGER,
    "difficulty" TEXT NOT NULL DEFAULT 'easy',
    "cuisine" TEXT,
    "mealType" TEXT,
    "coverImageUrl" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "cookbookId" TEXT,
    "cookCount" INTEGER NOT NULL DEFAULT 0,
    "lastCookedAt" TIMESTAMP(3),
    "rating" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");
CREATE INDEX "Recipe_ownerId_idx" ON "Recipe"("ownerId");
CREATE INDEX "Recipe_ownerTeamId_idx" ON "Recipe"("ownerTeamId");
CREATE INDEX "Recipe_cookbookId_idx" ON "Recipe"("cookbookId");
CREATE INDEX "Recipe_mealType_difficulty_idx" ON "Recipe"("mealType", "difficulty");
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_ownerTeamId_fkey"
  FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_cookbookId_fkey"
  FOREIGN KEY ("cookbookId") REFERENCES "Cookbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RecipeIngredient
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "groupName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");
CREATE INDEX "RecipeIngredient_productId_idx" ON "RecipeIngredient"("productId");
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RecipeStep
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "durationMin" INTEGER,
    "temperature" TEXT,
    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecipeStep_recipeId_order_idx" ON "RecipeStep"("recipeId", "order");
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RecipeImage
CREATE TABLE "RecipeImage" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RecipeImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecipeImage_recipeId_idx" ON "RecipeImage"("recipeId");
ALTER TABLE "RecipeImage" ADD CONSTRAINT "RecipeImage_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RecipeTag (M:N na istniejącym Tag)
CREATE TABLE "RecipeTag" (
    "recipeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "RecipeTag_pkey" PRIMARY KEY ("recipeId", "tagId")
);
ALTER TABLE "RecipeTag" ADD CONSTRAINT "RecipeTag_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeTag" ADD CONSTRAINT "RecipeTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RecipeRating
CREATE TABLE "RecipeRating" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeRating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecipeRating_recipeId_userId_key" ON "RecipeRating"("recipeId", "userId");
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MealPlanEntry
CREATE TABLE "MealPlanEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "slot" TEXT NOT NULL,
    "recipeId" TEXT,
    "customTitle" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 2,
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "cookedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MealPlanEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MealPlanEntry_ownerId_date_idx" ON "MealPlanEntry"("ownerId", "date");
CREATE INDEX "MealPlanEntry_ownerTeamId_date_idx" ON "MealPlanEntry"("ownerTeamId", "date");
CREATE INDEX "MealPlanEntry_date_idx" ON "MealPlanEntry"("date");
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_ownerTeamId_fkey"
  FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PantryItem
CREATE TABLE "PantryItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "location" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "minQuantity" DOUBLE PRECISION,
    "autoShop" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PantryItem_ownerId_idx" ON "PantryItem"("ownerId");
CREATE INDEX "PantryItem_ownerTeamId_idx" ON "PantryItem"("ownerTeamId");
CREATE INDEX "PantryItem_productId_idx" ON "PantryItem"("productId");
CREATE INDEX "PantryItem_expiresAt_idx" ON "PantryItem"("expiresAt");
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_ownerTeamId_fkey"
  FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ItemRecipeOrigin (soft-link Item → Recipe)
CREATE TABLE "ItemRecipeOrigin" (
    "itemId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 2,
    "ingredientId" TEXT,
    CONSTRAINT "ItemRecipeOrigin_pkey" PRIMARY KEY ("itemId")
);
CREATE INDEX "ItemRecipeOrigin_recipeId_idx" ON "ItemRecipeOrigin"("recipeId");
ALTER TABLE "ItemRecipeOrigin" ADD CONSTRAINT "ItemRecipeOrigin_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemRecipeOrigin" ADD CONSTRAINT "ItemRecipeOrigin_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Permissions seed for kitchen module ─────────────────────────────────

INSERT INTO "Permission" ("id", "slug", "name", "description") VALUES
  (gen_random_uuid()::text, 'module.kitchen',        'Kuchnia',                 'Dostęp do modułu Kuchnia'),
  (gen_random_uuid()::text, 'kitchen.recipe.create', 'Twórz przepisy',          'Tworzenie własnych przepisów'),
  (gen_random_uuid()::text, 'kitchen.recipe.edit',   'Edytuj własne przepisy',  'Edycja przepisów których jesteś właścicielem'),
  (gen_random_uuid()::text, 'kitchen.recipe.delete', 'Usuwaj własne przepisy',  'Usuwanie własnych przepisów'),
  (gen_random_uuid()::text, 'kitchen.mealplan.edit', 'Edytuj plan posiłków',    'Tworzenie i edycja wpisów planu posiłków'),
  (gen_random_uuid()::text, 'kitchen.pantry.edit',   'Edytuj spiżarnię',        'Zarządzanie zawartością spiżarni'),
  (gen_random_uuid()::text, 'kitchen.ai',            'Funkcje AI w Kuchni',     'Dostęp do funkcji AI w module Kuchnia (parsowanie, import, sugestie)')
ON CONFLICT ("slug") DO NOTHING;

-- USER: dostęp do modułu + CRUD własnych zasobów
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'USER', p."id"
FROM "Permission" p
WHERE p."slug" IN (
  'module.kitchen',
  'kitchen.recipe.create',
  'kitchen.recipe.edit',
  'kitchen.recipe.delete',
  'kitchen.mealplan.edit',
  'kitchen.pantry.edit'
)
ON CONFLICT ("role", "permissionId") DO NOTHING;

-- BETA_TESTER: USER + AI
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'BETA_TESTER', p."id"
FROM "Permission" p
WHERE p."slug" IN (
  'module.kitchen',
  'kitchen.recipe.create',
  'kitchen.recipe.edit',
  'kitchen.recipe.delete',
  'kitchen.mealplan.edit',
  'kitchen.pantry.edit',
  'kitchen.ai'
)
ON CONFLICT ("role", "permissionId") DO NOTHING;

-- ADMIN: wszystkie nowe permissions
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'ADMIN', p."id"
FROM "Permission" p
WHERE p."slug" IN (
  'module.kitchen',
  'kitchen.recipe.create',
  'kitchen.recipe.edit',
  'kitchen.recipe.delete',
  'kitchen.mealplan.edit',
  'kitchen.pantry.edit',
  'kitchen.ai'
)
ON CONFLICT ("role", "permissionId") DO NOTHING;
