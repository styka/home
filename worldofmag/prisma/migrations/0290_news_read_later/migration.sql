-- 124: „do doczytania" — znacznik odłożenia wiadomości, ortogonalny do statusu przeczytania.
-- Boolean jak "summaryFailed" (fakt dwustanowy, nie status); odłożona pozycja pozostaje PENDING,
-- więc nie znika ze strumienia, a akcje zbiorcze ją omijają.
ALTER TABLE "NewsItem" ADD COLUMN "readLater" BOOLEAN NOT NULL DEFAULT false;
