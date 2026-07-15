-- 002-ai-architecture (T-2): log pojedynczego wywołania LLM.
-- Obserwowalność jednostkowa (koszt/tokeny/czas per model i typ operacji).
-- Log systemowy: BEZ FK do User (snapshot userId), by przeżył usunięcie usera.
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "operationType" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiCall_createdAt_idx" ON "AiCall"("createdAt");
CREATE INDEX "AiCall_model_idx" ON "AiCall"("model");
CREATE INDEX "AiCall_operationType_idx" ON "AiCall"("operationType");
