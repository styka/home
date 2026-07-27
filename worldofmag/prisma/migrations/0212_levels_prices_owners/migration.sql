-- 034: poziomy pracy asystenta, cennik modeli w panelu admina i właściciele encji słownikowych.
-- Migracja jest IDEMPOTENTNA (można ją odpalić ponownie) i nie kasuje żadnych danych.

-- ─── 1. LlmAssignment: wymiar POZIOMU (economy | standard | max) ─────────────
-- Dotychczas jeden wiersz na typ operacji = jeden zestaw ustawień. Dokładamy kolumnę `level`
-- i klucz złożony, żeby admin mógł zdefiniować wszystkie trzy poziomy (C-12: zwykły TEXT, nie enum).
ALTER TABLE "LlmAssignment" ADD COLUMN IF NOT EXISTS "level" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "LlmAssignment" ALTER COLUMN "model" DROP NOT NULL;

DO $$
BEGIN
  -- Podmieniamy klucz główny tylko wtedy, gdy jest jeszcze jednokolumnowy (operationType).
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'LlmAssignment_pkey'
      AND conrelid = '"LlmAssignment"'::regclass
      AND array_length(conkey, 1) = 1
  ) THEN
    ALTER TABLE "LlmAssignment" DROP CONSTRAINT "LlmAssignment_pkey";
    ALTER TABLE "LlmAssignment" ADD CONSTRAINT "LlmAssignment_pkey" PRIMARY KEY ("operationType", "level");
  END IF;
END $$;

-- 1a. Poziom OSZCZĘDNY — odtwarza dotychczasowe zachowanie kodu: tryb „economy" kierował każde
-- wywołanie asystenta na typ `dispatch` (funkcja `effectiveOperation`), czyli na model, który admin
-- przypisał do najprostszych operacji. Zapisujemy to teraz WPROST, żeby admin to widział i mógł
-- zmienić. Tylko operacje asystenta (dispatch/reasoning) — obraz, generowanie i mowa dziedziczą.
INSERT INTO "LlmAssignment" ("operationType", "level", "providerId", "model", "temperature", "maxTokens", "effort", "updatedAt")
SELECT a."operationType", 'economy', d."providerId", d."model", d."temperature", d."maxTokens", d."effort", CURRENT_TIMESTAMP
FROM "LlmAssignment" a
CROSS JOIN (
  SELECT "providerId", "model", "temperature", "maxTokens", "effort"
  FROM "LlmAssignment" WHERE "operationType" = 'dispatch' AND "level" = 'standard' LIMIT 1
) d
WHERE a."level" = 'standard' AND a."operationType" IN ('dispatch', 'reasoning')
ON CONFLICT ("operationType", "level") DO NOTHING;

-- 1b. Poziom MAKSYMALNY — odtwarza dotychczasowe `boostEffort`: model admina bez zmian, wysiłek
-- podniesiony o jeden stopień.
INSERT INTO "LlmAssignment" ("operationType", "level", "providerId", "model", "temperature", "maxTokens", "effort", "updatedAt")
SELECT a."operationType", 'max', a."providerId", a."model", a."temperature", a."maxTokens",
  CASE COALESCE(a."effort", 'none')
    WHEN 'none' THEN 'low'
    WHEN 'low' THEN 'medium'
    ELSE 'high'
  END,
  CURRENT_TIMESTAMP
FROM "LlmAssignment" a
WHERE a."level" = 'standard' AND a."operationType" IN ('dispatch', 'reasoning')
ON CONFLICT ("operationType", "level") DO NOTHING;

-- ─── 2. UserLlmPref: WŁASNY poziom użytkownika ──────────────────────────────
-- Świadomie BEZ `maxTokens` — limit odpowiedzi zostaje w rękach administratora.
-- `providerId` bez klucza obcego (snapshot, jak `AiCall.userId`): skasowanie dostawcy przez admina
-- nie może wysadzić ustawień użytkownika, a resolver i tak sprawdza istnienie i `enabled`.
CREATE TABLE IF NOT EXISTS "UserLlmPref" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "providerId"    TEXT,
  "model"         TEXT,
  "effort"        TEXT,
  "temperature"   DOUBLE PRECISION,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserLlmPref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserLlmPref_userId_operationType_key" ON "UserLlmPref"("userId", "operationType");
CREATE INDEX IF NOT EXISTS "UserLlmPref_userId_idx" ON "UserLlmPref"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserLlmPref_userId_fkey') THEN
    ALTER TABLE "UserLlmPref"
      ADD CONSTRAINT "UserLlmPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 3. LlmModelPrice: cennik modeli edytowalny w panelu admina ─────────────
-- Dotąd cennik był zaszyty w kodzie (src/lib/llm/pricing.ts), więc jego aktualizacja wymagała
-- wdrożenia nowej wersji aplikacji. Wartości startowe = dokładnie to, co było w kodzie.
CREATE TABLE IF NOT EXISTS "LlmModelPrice" (
  "id"             TEXT NOT NULL,
  "modelPrefix"    TEXT NOT NULL,
  "label"          TEXT,
  "inputPer1M"     DOUBLE PRECISION NOT NULL,
  "outputPer1M"    DOUBLE PRECISION NOT NULL,
  "cacheReadMult"  DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  "cacheWriteMult" DOUBLE PRECISION NOT NULL DEFAULT 1.25,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LlmModelPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LlmModelPrice_modelPrefix_key" ON "LlmModelPrice"("modelPrefix");

INSERT INTO "LlmModelPrice" ("id", "modelPrefix", "label", "inputPer1M", "outputPer1M", "cacheReadMult", "cacheWriteMult", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'claude-sonnet-5',        'Claude Sonnet 5',      3.0,  15.0, 0.1, 1.25, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'claude-haiku-4-5',       'Claude Haiku 4.5',     1.0,   5.0, 0.1, 1.25, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'claude-opus-4',          'Claude Opus 4',        5.0,  25.0, 0.1, 1.25, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'claude-sonnet-4',        'Claude Sonnet 4',      3.0,  15.0, 0.1, 1.25, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'claude-haiku',           'Claude Haiku',         1.0,   5.0, 0.1, 1.25, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'llama-3.3-70b',          'Llama 3.3 70B (Groq)', 0.59,  0.79, 0.1, 1.25, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'llama-3.1-8b',           'Llama 3.1 8B (Groq)',  0.05,  0.08, 0.1, 1.25, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'meta-llama/llama-4',     'Llama 4 Scout (Groq)', 0.11,  0.34, 0.1, 1.25, CURRENT_TIMESTAMP)
ON CONFLICT ("modelPrefix") DO NOTHING;

-- ─── 4. Właściciele encji tworzonych przez użytkowników ─────────────────────
-- NULL/NULL = rekord systemowy, wspólny dla wszystkich kont (jak słowniki systemowe).
-- FK z ON DELETE SET NULL: skasowanie konta nie kasuje wspólnego słownika, tylko czyni go systemowym.
ALTER TABLE "NoteGroup"   ADD COLUMN IF NOT EXISTS "ownerId"     TEXT;
ALTER TABLE "NoteGroup"   ADD COLUMN IF NOT EXISTS "ownerTeamId" TEXT;
ALTER TABLE "Tag"         ADD COLUMN IF NOT EXISTS "ownerId"     TEXT;
ALTER TABLE "Tag"         ADD COLUMN IF NOT EXISTS "ownerTeamId" TEXT;
-- ItemHistory to prywatne podpowiedzi zakupowe — bez wariantu zespołowego (jak `Store`).
ALTER TABLE "ItemHistory" ADD COLUMN IF NOT EXISTS "ownerId"     TEXT;

CREATE INDEX IF NOT EXISTS "NoteGroup_ownerId_idx"     ON "NoteGroup"("ownerId");
CREATE INDEX IF NOT EXISTS "NoteGroup_ownerTeamId_idx" ON "NoteGroup"("ownerTeamId");
CREATE INDEX IF NOT EXISTS "Tag_ownerTeamId_idx"       ON "Tag"("ownerTeamId");
CREATE INDEX IF NOT EXISTS "ItemHistory_ownerId_idx"   ON "ItemHistory"("ownerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NoteGroup_ownerId_fkey') THEN
    ALTER TABLE "NoteGroup" ADD CONSTRAINT "NoteGroup_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NoteGroup_ownerTeamId_fkey') THEN
    ALTER TABLE "NoteGroup" ADD CONSTRAINT "NoteGroup_ownerTeamId_fkey"
      FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tag_ownerId_fkey') THEN
    ALTER TABLE "Tag" ADD CONSTRAINT "Tag_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tag_ownerTeamId_fkey') THEN
    ALTER TABLE "Tag" ADD CONSTRAINT "Tag_ownerTeamId_fkey"
      FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemHistory_ownerId_fkey') THEN
    ALTER TABLE "ItemHistory" ADD CONSTRAINT "ItemHistory_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4a. Backfill: wszystko, co powinno mieć właściciela a go nie ma, dostaje ADMINISTRATORA
-- (decyzja właściciela — realnie z aplikacji korzysta dziś tylko on). Administratora wyliczamy
-- z RBAC, nie z zaszytego adresu e-mail. Świeża instalacja bez administratora = rekordy zostają
-- systemowe i nic się nie psuje.
DO $$
DECLARE admin_id TEXT;
BEGIN
  SELECT ur."userId" INTO admin_id
  FROM "UserRole" ur
  JOIN "RolePermission" rp ON rp."role" = ur."role"
  JOIN "Permission" p ON p."id" = rp."permissionId" AND p."slug" = 'module.admin'
  JOIN "User" u ON u."id" = ur."userId"
  ORDER BY u."createdAt" ASC
  LIMIT 1;

  IF admin_id IS NOT NULL THEN
    UPDATE "NoteGroup"   SET "ownerId" = admin_id WHERE "ownerId" IS NULL AND "ownerTeamId" IS NULL;
    UPDATE "Tag"         SET "ownerId" = admin_id WHERE "ownerId" IS NULL AND "ownerTeamId" IS NULL;
    UPDATE "ItemHistory" SET "ownerId" = admin_id WHERE "ownerId" IS NULL;
  END IF;
END $$;

-- 4b. Unikalność nazwy przenosimy z GLOBALNEJ na „w obrębie właściciela" — inaczej drugi
-- użytkownik nie mógłby założyć etykiety o tej samej nazwie. Indeksy tworzymy PO backfillu,
-- żeby nie natrafić na duplikaty w trakcie.
DROP INDEX IF EXISTS "Tag_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_ownerId_name_key" ON "Tag"("ownerId", "name");

DROP INDEX IF EXISTS "ItemHistory_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ItemHistory_ownerId_name_key" ON "ItemHistory"("ownerId", "name");
