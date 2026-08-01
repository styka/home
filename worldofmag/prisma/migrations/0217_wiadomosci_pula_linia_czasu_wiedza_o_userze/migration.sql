-- 039: Wiadomości — wspólna pula materiału + linia czasu tematu + odrzucone gorące tematy,
-- oraz przekrojowa WIEDZA O UŻYTKOWNIKU.
--
-- ⚠️ UWAGA — TA MIGRACJA MA JEDEN KROK NIEODWRACALNY.
-- Na samym końcu usuwamy tabelę "NewsKnowledge" wraz z jej zawartością (wersjonowany stan wiedzy
-- per temat × źródło). To ŚWIADOMA DECYZJA WŁAŚCICIELA: linia czasu zastępuje tamten mechanizm
-- całkowicie, a właściciel wprost wybrał usunięcie starej wiedzy zamiast jej przenoszenia.
-- Nie ma kroku wstecz na bazie — odzyskanie treści wymaga przywrócenia bazy w czasie (Neon PITR)
-- wg `worldofmag/docs/devops/runbook-deploy-rollback.md`. Reszta migracji jest addytywna.
--
-- Statusy i rodzaje to TEXT + zawężający typ TypeScript (C-12), nigdy enum Prisma.

-- ─── NewsArticle — wspólna pula materiału ───────────────────────────────────
-- Dziś ten sam artykuł zapisywany jest osobno dla każdego tematu, a kanał RSS pobierany raz na
-- temat (i jeszcze raz przy gorących tematach). Pula rozcina „pobranie" od „analizy": każde źródło
-- pobieramy RAZ, a przypisanie do tematów jest osobnym, tanim etapem. Bez tego gorące tematy nie
-- mają z czego korzystać po zakończeniu odświeżania.
CREATE TABLE "NewsArticle" (
    "id"       TEXT NOT NULL,
    "ownerId"  TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url"      TEXT NOT NULL,
    "title"    TEXT NOT NULL,
    -- Skrót z kanału RSS — materiał wejściowy do klasyfikacji i streszczeń.
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl"    TEXT,
    -- Data publikacji wg kanału.
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsArticle_ownerId_sourceId_url_key" ON "NewsArticle"("ownerId", "sourceId", "url");
CREATE INDEX "NewsArticle_ownerId_publishedAt_idx" ON "NewsArticle"("ownerId", "publishedAt");

ALTER TABLE "NewsArticle"
    ADD CONSTRAINT "NewsArticle_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NewsArticle"
    ADD CONSTRAINT "NewsArticle_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── NewsTimelineEntry — linia czasu tematu ─────────────────────────────────
-- Zastępuje wersjonowaną wiedzę: zamiast narastającego opisu „stanu wiedzy" per źródło mamy listę
-- suchych faktów z DATĄ ZDARZENIA. Odcisk faktu jest zaporą przed zapisaniem tej samej informacji
-- drugi raz innymi słowami.
CREATE TABLE "NewsTimelineEntry" (
    "id"      TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    -- Data ZDARZENIA z treści materiału, nie data pobrania.
    "eventDate" TIMESTAMP(3) NOT NULL,
    -- Skąd wzięliśmy datę: "exact" | "approx" | "published".
    "dateConfidence" TEXT NOT NULL DEFAULT 'published',
    -- Jedno zdanie suchego faktu.
    "fact"        TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "sourceId"    TEXT,
    "articleId"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsTimelineEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsTimelineEntry_topicId_fingerprint_key" ON "NewsTimelineEntry"("topicId", "fingerprint");
CREATE INDEX "NewsTimelineEntry_topicId_eventDate_idx" ON "NewsTimelineEntry"("topicId", "eventDate");

ALTER TABLE "NewsTimelineEntry"
    ADD CONSTRAINT "NewsTimelineEntry_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "NewsTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Usunięcie źródła nie może kasować faktu — fakt zostaje, traci tylko znacznik pochodzenia.
ALTER TABLE "NewsTimelineEntry"
    ADD CONSTRAINT "NewsTimelineEntry_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── NewsHiddenTopic — odrzucone gorące tematy ──────────────────────────────
-- Odcisk tytułu (`lib/textKey.ts`) zamiast id, bo gorący temat nie jest wierszem w bazie — powstaje
-- na nowo przy każdym przebiegu i model nie powtórzy tytułu znak w znak.
CREATE TABLE "NewsHiddenTopic" (
    "id"          TEXT NOT NULL,
    "ownerId"     TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsHiddenTopic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsHiddenTopic_ownerId_fingerprint_key" ON "NewsHiddenTopic"("ownerId", "fingerprint");

ALTER TABLE "NewsHiddenTopic"
    ADD CONSTRAINT "NewsHiddenTopic_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── UserFact — wiedza o użytkowniku ────────────────────────────────────────
-- Przekrojowa, nie „newsowa": fakty służą każdemu modułowi, który generuje treść pod użytkownika
-- (dziś Pogoda). Odrzucony fakt zostaje w tabeli ze statusem "rejected", żeby nie wrócił przy
-- kolejnym wnioskowaniu — kasowanie wiersza oznaczałoby proponowanie go w kółko.
CREATE TABLE "UserFact" (
    "id"      TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    -- "interests" | "activity" | "lifestyle" | "constraints" | "content"
    "category" TEXT NOT NULL,
    -- Treść faktu jednym zdaniem, po polsku.
    "text" TEXT NOT NULL,
    -- "guess" | "likely" | "confirmed" — trafia do promptu jako słowo, nie liczba.
    "confidence" TEXT NOT NULL DEFAULT 'guess',
    -- "inferred" | "confirmed" | "admin" — fakt ustawiony przez administratora nie jest
    -- nadpisywany automatycznym wnioskowaniem.
    "origin" TEXT NOT NULL DEFAULT 'inferred',
    -- "active" | "rejected"
    "status" TEXT NOT NULL DEFAULT 'active',
    -- Skąd konkretnie wyciągnięty (np. „zapisane pomysły pogodowe") — dla wglądu, nie dla logiki.
    "evidence"    TEXT,
    "fingerprint" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserFact_ownerId_fingerprint_key" ON "UserFact"("ownerId", "fingerprint");
CREATE INDEX "UserFact_ownerId_status_idx" ON "UserFact"("ownerId", "status");

ALTER TABLE "UserFact"
    ADD CONSTRAINT "UserFact_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Zmiany w istniejących tabelach (addytywne) ─────────────────────────────
-- Powiązanie pozycji tematu z artykułem w puli. Opcjonalne, bo pozycje sprzed tej zmiany powstały
-- bez puli i nie mają czego wskazywać.
ALTER TABLE "NewsItem" ADD COLUMN "articleId" TEXT;

ALTER TABLE "NewsItem"
    ADD CONSTRAINT "NewsItem_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "NewsItem_articleId_idx" ON "NewsItem"("articleId");

-- Moment ostatniego pobrania PULI — wspólny dla wszystkich tematów, bo pobranie przestało być
-- czynnością pojedynczego tematu. NULL = nigdy nie pobrano (pierwszy przebieg bierze okno 24 h).
ALTER TABLE "NewsPref" ADD COLUMN "lastFetchedAt" TIMESTAMP(3);

-- ─── Krok nieodwracalny ─────────────────────────────────────────────────────
-- Wersjonowana wiedza (temat × źródło) ustępuje linii czasu. Patrz ostrzeżenie na górze pliku.
DROP TABLE IF EXISTS "NewsKnowledge";
