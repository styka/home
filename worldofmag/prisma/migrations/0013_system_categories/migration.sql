-- Insert Polish system categories (userId=NULL, teamId=NULL)
-- These replace the hardcoded BASE_CATEGORIES in src/lib/categories.ts
INSERT INTO "Category" ("id", "name", "emoji", "createdAt")
VALUES
  (gen_random_uuid()::text, 'Warzywa i owoce',      '🥕', NOW()),
  (gen_random_uuid()::text, 'Nabiał i jaja',         '🧀', NOW()),
  (gen_random_uuid()::text, 'Mięso i ryby',          '🥩', NOW()),
  (gen_random_uuid()::text, 'Piekarnia',             '🍞', NOW()),
  (gen_random_uuid()::text, 'Suche produkty',        '🌾', NOW()),
  (gen_random_uuid()::text, 'Napoje',                '🍺', NOW()),
  (gen_random_uuid()::text, 'Mrożone',               '🧊', NOW()),
  (gen_random_uuid()::text, 'Przekąski i słodycze',  '🍫', NOW()),
  (gen_random_uuid()::text, 'Przyprawy i oleje',     '🫙', NOW()),
  (gen_random_uuid()::text, 'Zioła i przyprawy',     '🌿', NOW()),
  (gen_random_uuid()::text, 'Chemia i higiena',      '🧴', NOW()),
  (gen_random_uuid()::text, 'Konserwy i przetwory',  '🥫', NOW()),
  (gen_random_uuid()::text, 'Inne',                  '📦', NOW())
ON CONFLICT DO NOTHING;

-- Migrate existing data: English category names → Polish
-- Items table
UPDATE "Item" SET "category" = 'Warzywa i owoce'     WHERE "category" = 'Produce';
UPDATE "Item" SET "category" = 'Nabiał i jaja'        WHERE "category" = 'Dairy & Eggs';
UPDATE "Item" SET "category" = 'Mięso i ryby'         WHERE "category" = 'Meat & Fish';
UPDATE "Item" SET "category" = 'Piekarnia'            WHERE "category" = 'Bakery';
UPDATE "Item" SET "category" = 'Suche produkty'       WHERE "category" = 'Dry Goods & Pasta';
UPDATE "Item" SET "category" = 'Napoje'               WHERE "category" = 'Drinks';
UPDATE "Item" SET "category" = 'Mrożone'              WHERE "category" = 'Frozen';
UPDATE "Item" SET "category" = 'Przekąski i słodycze' WHERE "category" = 'Snacks & Sweets';
UPDATE "Item" SET "category" = 'Przyprawy i oleje'    WHERE "category" = 'Condiments & Oils';
UPDATE "Item" SET "category" = 'Zioła i przyprawy'    WHERE "category" = 'Spices & Herbs';
UPDATE "Item" SET "category" = 'Chemia i higiena'     WHERE "category" = 'Cleaning & Hygiene';
UPDATE "Item" SET "category" = 'Konserwy i przetwory' WHERE "category" = 'Canned & Preserved';
UPDATE "Item" SET "category" = 'Inne'                 WHERE "category" = 'Other';

-- Product catalog table
UPDATE "Product" SET "category" = 'Warzywa i owoce'     WHERE "category" = 'Produce';
UPDATE "Product" SET "category" = 'Nabiał i jaja'        WHERE "category" = 'Dairy & Eggs';
UPDATE "Product" SET "category" = 'Mięso i ryby'         WHERE "category" = 'Meat & Fish';
UPDATE "Product" SET "category" = 'Piekarnia'            WHERE "category" = 'Bakery';
UPDATE "Product" SET "category" = 'Suche produkty'       WHERE "category" = 'Dry Goods & Pasta';
UPDATE "Product" SET "category" = 'Napoje'               WHERE "category" = 'Drinks';
UPDATE "Product" SET "category" = 'Mrożone'              WHERE "category" = 'Frozen';
UPDATE "Product" SET "category" = 'Przekąski i słodycze' WHERE "category" = 'Snacks & Sweets';
UPDATE "Product" SET "category" = 'Przyprawy i oleje'    WHERE "category" = 'Condiments & Oils';
UPDATE "Product" SET "category" = 'Zioła i przyprawy'    WHERE "category" = 'Spices & Herbs';
UPDATE "Product" SET "category" = 'Chemia i higiena'     WHERE "category" = 'Cleaning & Hygiene';
UPDATE "Product" SET "category" = 'Konserwy i przetwory' WHERE "category" = 'Canned & Preserved';
UPDATE "Product" SET "category" = 'Inne'                 WHERE "category" = 'Other';

-- CategoryIconVariant categoryName field
UPDATE "CategoryIconVariant" SET "categoryName" = 'Warzywa i owoce'     WHERE "categoryName" = 'Produce';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Nabiał i jaja'        WHERE "categoryName" = 'Dairy & Eggs';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Mięso i ryby'         WHERE "categoryName" = 'Meat & Fish';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Piekarnia'            WHERE "categoryName" = 'Bakery';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Suche produkty'       WHERE "categoryName" = 'Dry Goods & Pasta';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Napoje'               WHERE "categoryName" = 'Drinks';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Mrożone'              WHERE "categoryName" = 'Frozen';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Przekąski i słodycze' WHERE "categoryName" = 'Snacks & Sweets';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Przyprawy i oleje'    WHERE "categoryName" = 'Condiments & Oils';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Zioła i przyprawy'    WHERE "categoryName" = 'Spices & Herbs';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Chemia i higiena'     WHERE "categoryName" = 'Cleaning & Hygiene';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Konserwy i przetwory' WHERE "categoryName" = 'Canned & Preserved';
UPDATE "CategoryIconVariant" SET "categoryName" = 'Inne'                 WHERE "categoryName" = 'Other';

-- StoreNode category field
UPDATE "StoreNode" SET "category" = 'Warzywa i owoce'     WHERE "category" = 'Produce';
UPDATE "StoreNode" SET "category" = 'Nabiał i jaja'        WHERE "category" = 'Dairy & Eggs';
UPDATE "StoreNode" SET "category" = 'Mięso i ryby'         WHERE "category" = 'Meat & Fish';
UPDATE "StoreNode" SET "category" = 'Piekarnia'            WHERE "category" = 'Bakery';
UPDATE "StoreNode" SET "category" = 'Suche produkty'       WHERE "category" = 'Dry Goods & Pasta';
UPDATE "StoreNode" SET "category" = 'Napoje'               WHERE "category" = 'Drinks';
UPDATE "StoreNode" SET "category" = 'Mrożone'              WHERE "category" = 'Frozen';
UPDATE "StoreNode" SET "category" = 'Przekąski i słodycze' WHERE "category" = 'Snacks & Sweets';
UPDATE "StoreNode" SET "category" = 'Przyprawy i oleje'    WHERE "category" = 'Condiments & Oils';
UPDATE "StoreNode" SET "category" = 'Zioła i przyprawy'    WHERE "category" = 'Spices & Herbs';
UPDATE "StoreNode" SET "category" = 'Chemia i higiena'     WHERE "category" = 'Cleaning & Hygiene';
UPDATE "StoreNode" SET "category" = 'Konserwy i przetwory' WHERE "category" = 'Canned & Preserved';
UPDATE "StoreNode" SET "category" = 'Inne'                 WHERE "category" = 'Other';

-- ItemHistory table
UPDATE "ItemHistory" SET "category" = 'Warzywa i owoce'     WHERE "category" = 'Produce';
UPDATE "ItemHistory" SET "category" = 'Nabiał i jaja'        WHERE "category" = 'Dairy & Eggs';
UPDATE "ItemHistory" SET "category" = 'Mięso i ryby'         WHERE "category" = 'Meat & Fish';
UPDATE "ItemHistory" SET "category" = 'Piekarnia'            WHERE "category" = 'Bakery';
UPDATE "ItemHistory" SET "category" = 'Suche produkty'       WHERE "category" = 'Dry Goods & Pasta';
UPDATE "ItemHistory" SET "category" = 'Napoje'               WHERE "category" = 'Drinks';
UPDATE "ItemHistory" SET "category" = 'Mrożone'              WHERE "category" = 'Frozen';
UPDATE "ItemHistory" SET "category" = 'Przekąski i słodycze' WHERE "category" = 'Snacks & Sweets';
UPDATE "ItemHistory" SET "category" = 'Przyprawy i oleje'    WHERE "category" = 'Condiments & Oils';
UPDATE "ItemHistory" SET "category" = 'Zioła i przyprawy'    WHERE "category" = 'Spices & Herbs';
UPDATE "ItemHistory" SET "category" = 'Chemia i higiena'     WHERE "category" = 'Cleaning & Hygiene';
UPDATE "ItemHistory" SET "category" = 'Konserwy i przetwory' WHERE "category" = 'Canned & Preserved';
UPDATE "ItemHistory" SET "category" = 'Inne'                 WHERE "category" = 'Other';
