-- Z-240 (T-16): pełnotekstowe/indeksowane wyszukiwanie notatek zamiast skanującego ILIKE.
--
-- Podejście: rozszerzenie pg_trgm + indeksy GIN trigramowe na Note.title/content.
-- Przyspieszają istniejące zapytanie `col ILIKE '%q%'` (gin_trgm_ops wspiera ILIKE z
-- wiodącym wildcardem) BEZ zmiany zachowania/wyników i BEZ przepisywania logiki dostępu
-- na surowy SQL (zapytanie zostaje w Prisma). Ranking trafności robimy app-level.
--
-- ŚWIADOMY DRYF (za zgodą właściciela 2026-07-02): rozszerzenie i indeksy wyrażeniowe
-- NIE są wyrażalne w schema.prisma, więc żyją tylko w tej migracji → `prisma migrate diff`
-- pokaże je jako dryf. To bezpieczne: prod używa `migrate deploy` (stosuje pliki). NIE
-- uruchamiać `migrate dev`/auto-fix na prodzie (mógłby chcieć usunąć te indeksy).
-- IF NOT EXISTS wszędzie → idempotentnie.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Note_title_trgm_idx" ON "Note" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Note_content_trgm_idx" ON "Note" USING gin ("content" gin_trgm_ops);
