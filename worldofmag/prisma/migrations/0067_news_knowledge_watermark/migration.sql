-- Wiadomości: znacznik świeżości bazy wiedzy (najnowsza data publikacji wchłonięta
-- w danej wersji). Pozwala pobierać tylko wiadomości nowsze niż znacznik (koniec okna 24h).

ALTER TABLE "NewsKnowledge" ADD COLUMN "lastPublishedAt" TIMESTAMP(3);
