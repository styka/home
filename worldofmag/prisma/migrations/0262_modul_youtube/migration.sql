-- 102 (spec 102-youtube-transkrypcje) — MODUŁ YOUTUBE.
--
-- Cztery tabele + uprawnienie modułu + indeks trigramowy do szukania po transkrypcjach.
--
-- UWAGA (C-15): DDL poniżej powstał z `prisma migrate diff`, ale jest z niego wzięta WYŁĄCZNIE
-- część dotycząca tej zmiany. Wygenerowany diff otwierał się siedmioma instrukcjami, które NIE są
-- tą zmianą, tylko granicą tego, co `schema.prisma` potrafi wyrazić — i skasowałyby na produkcji
-- indeksy pełnotekstowe Notatek oraz tabelę kopii własności. Wszystkie są wypisane
-- w `src/lib/db/schema-drift-allowed.json`. Przepisanie diffa bez czytania byłoby awarią danych.

-- CreateTable
CREATE TABLE "YoutubeChannel" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT,
    "thumbnailUrl" TEXT,
    "zrodlo" TEXT NOT NULL DEFAULT 'reczne',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFetchedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "YoutubeChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeVideo" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "thumbnailUrl" TEXT,
    "durationSec" INTEGER,
    "stan" TEXT NOT NULL DEFAULT 'nowy',
    "transkrypcjaStan" TEXT NOT NULL DEFAULT 'oczekuje',
    "transkrypcja" TEXT,
    "transkrypcjaJezyk" TEXT,
    "ocena" INTEGER,
    "ocenaPowod" TEXT,
    "ocenaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "channelId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "YoutubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubePref" (
    "id" TEXT NOT NULL,
    "domyslnaDlugosc" TEXT NOT NULL DEFAULT 'srednie',
    "lastRefreshAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "YoutubePref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YoutubeChannel_workspaceId_idx" ON "YoutubeChannel"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeChannel_workspaceId_channelId_key" ON "YoutubeChannel"("workspaceId", "channelId");

-- CreateIndex
CREATE INDEX "YoutubeVideo_workspaceId_stan_publishedAt_idx" ON "YoutubeVideo"("workspaceId", "stan", "publishedAt");

-- CreateIndex
CREATE INDEX "YoutubeVideo_workspaceId_ocena_idx" ON "YoutubeVideo"("workspaceId", "ocena");

-- CreateIndex
CREATE INDEX "YoutubeVideo_channelId_idx" ON "YoutubeVideo"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeVideo_workspaceId_videoId_key" ON "YoutubeVideo"("workspaceId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeConnection_userId_key" ON "YoutubeConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubePref_workspaceId_key" ON "YoutubePref"("workspaceId");

-- AddForeignKey
ALTER TABLE "YoutubeChannel" ADD CONSTRAINT "YoutubeChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeVideo" ADD CONSTRAINT "YoutubeVideo_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "YoutubeChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeVideo" ADD CONSTRAINT "YoutubeVideo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeConnection" ADD CONSTRAINT "YoutubeConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubePref" ADD CONSTRAINT "YoutubePref_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Uprawnienie modułu (C-22, wzorzec 0026_pets_module) ────────────────────
INSERT INTO "Permission" ("id", "slug", "name", "description") VALUES
  (gen_random_uuid()::text, 'module.youtube', 'YouTube', 'Dostęp do modułu YouTube — obserwowane kanały, transkrypcje i streszczenia')
ON CONFLICT ("slug") DO NOTHING;

-- ADMIN dostaje uprawnienie od razu; pozostałe role nadaje się w /admin/access.
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'ADMIN', p."id"
FROM "Permission" p WHERE p."slug" = 'module.youtube'
ON CONFLICT ("role", "permissionId") DO NOTHING;

-- ─── Szukanie po transkrypcjach (AC-14) ─────────────────────────────────────
-- Trigramowy indeks GIN przyspiesza `transkrypcja ILIKE '%fraza%'` — ten sam wzorzec, którym
-- działa wyszukiwanie w Notatkach (0201). `schema.prisma` nie umie wyrazić indeksu GIN
-- z operatorem trigramowym, więc `migrate diff` ZAWSZE zaproponuje jego usunięcie; świadomy
-- wyjątek stoi w `src/lib/db/schema-drift-allowed.json`.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "YoutubeVideo_transkrypcja_trgm_idx"
  ON "YoutubeVideo" USING gin ("transkrypcja" gin_trgm_ops);
