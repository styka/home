-- Tekst odczytany ze zdjęcia przepisu przez LLM (OCR), zapisany jako Markdown.
-- NULL = jeszcze nie analizowano; '' (pusty) = analizowano, brak tekstu.
ALTER TABLE "RecipeImage" ADD COLUMN "ocrMarkdown" TEXT;
