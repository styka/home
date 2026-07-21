-- Diagnostyka asystenta AI: log per-wywołanie musi obejmować także NIEUDANE
-- wywołania (status + treść błędu) oraz wiązać je z rozmową (conversationId) i
-- liczbą prób (retry), żeby admin widział przebieg backendu krok po kroku.
ALTER TABLE "AiCall" ADD COLUMN IF NOT EXISTS "status" INTEGER;
ALTER TABLE "AiCall" ADD COLUMN IF NOT EXISTS "errorText" TEXT;
ALTER TABLE "AiCall" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
ALTER TABLE "AiCall" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "AiCall_conversationId_idx" ON "AiCall" ("conversationId");
