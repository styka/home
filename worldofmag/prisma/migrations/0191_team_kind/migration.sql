-- Z-192: rodzaj zespołu — "team" (domyślny) lub "household" (preset rodziny/gospodarstwa).
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'team';
