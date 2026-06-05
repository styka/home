-- Grupy projektów (model ProjectGroup, tabela historycznie „TaskView" via @@map):
-- dodaj opcjonalny kolor na kropkę-znacznik przynależności projektu do grupy.
-- Idempotentne (re-run-safe).
ALTER TABLE "TaskView" ADD COLUMN IF NOT EXISTS "color" TEXT;
