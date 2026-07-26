-- 031: ustawienia asystenta AI PER UŻYTKOWNIK (nie per urządzenie).
-- Trzyma stałe preferencje („custom instructions"), poziom pracy asystenta
-- (standard | economy) oraz wybór głosu lektora dla syntezy serwerowej.
-- Wzorzec: DashboardPref (userId @unique + kaskada po usunięciu konta).
-- Statusy/rodzaje to kolumny TEXT + typ TS (union) — bez enumów Prisma (C-12).

CREATE TABLE IF NOT EXISTS "AssistantPref" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "instructions" TEXT NOT NULL DEFAULT '',
  "level"        TEXT NOT NULL DEFAULT 'standard',
  "voiceKind"    TEXT NOT NULL DEFAULT 'browser',
  "voiceId"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantPref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AssistantPref_userId_key" ON "AssistantPref"("userId");

ALTER TABLE "AssistantPref" DROP CONSTRAINT IF EXISTS "AssistantPref_userId_fkey";
ALTER TABLE "AssistantPref" ADD CONSTRAINT "AssistantPref_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
