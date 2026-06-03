-- Dolny pasek (mobile) z osobno konfigurowalną kolejnością ikon, niezależną od menu bocznego.
-- Domyślnie pusty ("[]") — aplikacja interpretuje brak jako domyślny zestaw (home/tasks/shopping).
ALTER TABLE "UserMenuPref" ADD COLUMN IF NOT EXISTS "tabBar" TEXT NOT NULL DEFAULT '[]';
