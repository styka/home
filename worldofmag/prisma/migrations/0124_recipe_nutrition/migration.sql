-- K2: wartości odżywcze przepisu (na 1 porcję).
ALTER TABLE "Recipe" ADD COLUMN "kcal" INTEGER;
ALTER TABLE "Recipe" ADD COLUMN "protein" DOUBLE PRECISION;
ALTER TABLE "Recipe" ADD COLUMN "carbs" DOUBLE PRECISION;
ALTER TABLE "Recipe" ADD COLUMN "fat" DOUBLE PRECISION;
