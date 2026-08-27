-- 106: ergonomia asystenta AI — zapisane rozmowy i sposób prezentacji.
--
-- Dwie kolumny na istniejących tabelach, obie z wartością domyślną odtwarzającą DZISIEJSZE
-- zachowanie: po wdrożeniu nikt, kto niczego nie ustawi, nie zobaczy żadnej zmiany.

-- Rozmowa na liście „Zapisane" (przeciwstawnej do „Historia"). Wszystkie istniejące rozmowy
-- zostają historyczne — lista zapisanych startuje pusta.
ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "saved" BOOLEAN NOT NULL DEFAULT false;

-- Obie listy czyta się OSOBNYM zapytaniem po tych trzech kolumnach. Istniejący indeks
-- ("userId", "updatedAt") zostaje — korzystają z niego odczyt pojedynczej rozmowy i dopisanie
-- wiadomości.
CREATE INDEX IF NOT EXISTS "AiConversation_userId_saved_updatedAt_idx"
  ON "AiConversation" ("userId", "saved", "updatedAt");

-- Sposób prezentacji asystenta na komputerze: 'window' (pływające okno) | 'content' (w obszarze
-- treści modułu). TEXT + zawężający typ TypeScript, nigdy enum Prisma (C-12).
ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "presentation" TEXT NOT NULL DEFAULT 'window';
