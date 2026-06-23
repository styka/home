-- Z-252: cena jednostkowa składnika przepisu (koszt przepisu / koszt porcji).
-- Kolumna dodatkowa, nullable — bezpieczna, nie wymaga backfillu.
ALTER TABLE "RecipeIngredient" ADD COLUMN IF NOT EXISTS "unitPrice" DOUBLE PRECISION;
