-- CreateTable
CREATE TABLE "LlmProvider" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'openai_compat',
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LlmProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmAssignment" (
    "operationType" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LlmAssignment_pkey" PRIMARY KEY ("operationType")
);

-- CreateIndex
CREATE INDEX "LlmAssignment_providerId_idx" ON "LlmAssignment"("providerId");

-- AddForeignKey
ALTER TABLE "LlmAssignment" ADD CONSTRAINT "LlmAssignment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migracja danych: utwórz domyślnego dostawcę Groq z istniejącego klucza
-- (Config.groq_api_key) i przypisz wszystkie typy operacji do tego dostawcy,
-- zachowując dotychczasowe modele. Idempotentne — robi to także scripts/migrate.js.
DO $$
DECLARE
    v_provider_id TEXT;
    v_key TEXT;
BEGIN
    SELECT "value" INTO v_key FROM "Config" WHERE "key" = 'groq_api_key';

    IF NOT EXISTS (SELECT 1 FROM "LlmProvider") THEN
        v_provider_id := 'groq_default';
        INSERT INTO "LlmProvider" ("id", "label", "kind", "baseUrl", "apiKey", "enabled", "createdAt", "updatedAt")
        VALUES (v_provider_id, 'Groq (domyślny)', 'openai_compat', 'https://api.groq.com/openai/v1', COALESCE(v_key, ''), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    ELSE
        SELECT "id" INTO v_provider_id FROM "LlmProvider" ORDER BY "createdAt" ASC LIMIT 1;
    END IF;

    INSERT INTO "LlmAssignment" ("operationType", "providerId", "model", "updatedAt") VALUES
        ('dispatch',   v_provider_id, 'llama-3.1-8b-instant',                    CURRENT_TIMESTAMP),
        ('reasoning',  v_provider_id, 'llama-3.3-70b-versatile',                 CURRENT_TIMESTAMP),
        ('vision',     v_provider_id, 'meta-llama/llama-4-scout-17b-16e-instruct', CURRENT_TIMESTAMP),
        ('generation', v_provider_id, 'llama-3.3-70b-versatile',                 CURRENT_TIMESTAMP)
    ON CONFLICT ("operationType") DO NOTHING;
END $$;
