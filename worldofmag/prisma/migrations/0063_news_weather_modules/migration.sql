-- Moduły Wiadomości (News) + Pogoda (Weather).
-- Wiadomości: źródła RSS, tematy z filtrem semantycznym, wersjonowana baza wiedzy
-- per (temat × źródło) oraz wykryte pozycje (świeżość 24h, status PENDING/ACK/DISMISSED).
-- Pogoda: lokalizacje + „obserwatory" (alerty); same dane pogodowe pobierane na żywo.

-- CreateTable
CREATE TABLE "NewsSource" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rssUrl" TEXT NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "leaning" TEXT NOT NULL DEFAULT 'center',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsTopic" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "semanticFilter" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsKnowledge" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "headline" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "summaryLength" TEXT NOT NULL DEFAULT 'medium',
    "noveltyNote" TEXT,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsPref" (
    "ownerId" TEXT NOT NULL,
    "defaultSummaryLength" TEXT NOT NULL DEFAULT 'medium',
    "activeSourceKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsPref_pkey" PRIMARY KEY ("ownerId")
);

-- CreateTable
CREATE TABLE "WeatherLocation" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeatherLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherWatcher" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'preset',
    "presetKey" TEXT,
    "query" TEXT,
    "horizon" TEXT NOT NULL DEFAULT 'week',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeatherWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsSource_ownerId_idx" ON "NewsSource"("ownerId");
CREATE UNIQUE INDEX "NewsSource_ownerId_key_key" ON "NewsSource"("ownerId", "key");
CREATE INDEX "NewsTopic_ownerId_idx" ON "NewsTopic"("ownerId");
CREATE INDEX "NewsKnowledge_topicId_sourceId_idx" ON "NewsKnowledge"("topicId", "sourceId");
CREATE UNIQUE INDEX "NewsKnowledge_topicId_sourceId_version_key" ON "NewsKnowledge"("topicId", "sourceId", "version");
CREATE INDEX "NewsItem_topicId_status_idx" ON "NewsItem"("topicId", "status");
CREATE UNIQUE INDEX "NewsItem_topicId_sourceId_url_key" ON "NewsItem"("topicId", "sourceId", "url");
CREATE INDEX "WeatherLocation_ownerId_idx" ON "WeatherLocation"("ownerId");
CREATE INDEX "WeatherWatcher_ownerId_idx" ON "WeatherWatcher"("ownerId");

-- AddForeignKey
ALTER TABLE "NewsSource" ADD CONSTRAINT "NewsSource_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsTopic" ADD CONSTRAINT "NewsTopic_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsKnowledge" ADD CONSTRAINT "NewsKnowledge_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "NewsTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsKnowledge" ADD CONSTRAINT "NewsKnowledge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "NewsTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsPref" ADD CONSTRAINT "NewsPref_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeatherLocation" ADD CONSTRAINT "WeatherLocation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeatherWatcher" ADD CONSTRAINT "WeatherWatcher_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
