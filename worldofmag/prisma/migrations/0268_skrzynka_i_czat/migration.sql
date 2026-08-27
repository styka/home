-- 107 (spec 107-skrzynka-i-komunikator) — SKRZYNKA ODBIORCZA I KOMUNIKATOR.
--
-- Dwie rzeczy naraz, bo dotyczą jednego zgłoszenia: rodzaj sprawy w powiadomieniach
-- („mam coś zrobić" kontra „ktoś czegoś ode mnie chce") oraz cztery tabele czatu.
--
-- UWAGA (C-15): DDL poniżej powstał z `prisma migrate diff`, ale wzięta jest z niego WYŁĄCZNIE
-- część dotycząca tej zmiany. Wygenerowany diff otwierał się dziewięcioma instrukcjami, które
-- NIE są tą zmianą, tylko granicą tego, co `schema.prisma` potrafi wyrazić:
--   * DROP INDEX na trzech indeksach trigramowych (`Note_content_trgm_idx`, `Note_title_trgm_idx`,
--     `YoutubeVideo_transkrypcja_trgm_idx`) — skasowałyby wyszukiwanie w Notatkach i YouTube,
--   * pięć `ALTER COLUMN "updatedAt" DROP DEFAULT`,
--   * DROP TABLE "_KopiaWlasnosci".
-- Wszystkie są wypisane w `src/lib/db/schema-drift-allowed.json`. Przepisanie diffa bez czytania
-- byłoby awarią danych.

-- ─── 1. Rodzaj powiadomienia ────────────────────────────────────────────────
-- Wartość domyślna jest bezpieczna dla WSZYSTKIEGO, co już jest w bazie: przypomnienia zostają
-- tam, gdzie były. Kolumna to `String` + unia TS, nigdy enum (C-12).
ALTER TABLE "Notification" ADD COLUMN "rodzaj" TEXT NOT NULL DEFAULT 'zadanie';

CREATE INDEX "Notification_userId_rodzaj_readAt_idx" ON "Notification"("userId", "rodzaj", "readAt");

-- Backfill: udostępnienia zasobów powiadamiają już dziś (`src/lib/sharingGrants.ts`), więc bez tego
-- jednego zdania wpadłyby do listy „Do zrobienia" — czyli dokładnie tam, skąd ta zmiana ma je
-- wyjąć. Idempotentne: powtórzenie ustawia tę samą wartość.
UPDATE "Notification" SET "rodzaj" = 'relacja' WHERE "module" = 'sharing';

-- ─── 2. Czat ────────────────────────────────────────────────────────────────
-- Dostęp do rozmowy wynika z UCZESTNICTWA, nie z własności — stąd brak kolumn `ownerId`/
-- `ownerTeamId` i brak wyzwalacza `omnia_fill_workspace`. `workspaceId` jest tu tożsamością kanału
-- zespołowego (jak w `WorkspaceMember` i `ResourceGrant`), a nie lustrem własności.

CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "rodzaj" TEXT NOT NULL,
    "workspaceId" TEXT,
    "tytul" TEXT,
    "ostatniaAktywnosc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "przeczytaneDo" TIMESTAMP(3),
    "pisalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tresc" TEXT NOT NULL,
    "odpowiedzNaId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("id")
);

-- „Dokładnie jeden kanał na przestrzeń zespołu". W PostgreSQL NULL-e w indeksie unikalnym są
-- różne, więc rozmów prywatnych (workspaceId IS NULL) ten indeks nie ogranicza.
CREATE UNIQUE INDEX "ChatConversation_workspaceId_key" ON "ChatConversation"("workspaceId");
CREATE INDEX "ChatConversation_ostatniaAktywnosc_idx" ON "ChatConversation"("ostatniaAktywnosc");
CREATE INDEX "ChatParticipant_userId_idx" ON "ChatParticipant"("userId");
CREATE UNIQUE INDEX "ChatParticipant_conversationId_userId_key" ON "ChatParticipant"("conversationId", "userId");
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
CREATE INDEX "ChatMessage_odpowiedzNaId_idx" ON "ChatMessage"("odpowiedzNaId");
CREATE INDEX "ChatReaction_messageId_idx" ON "ChatReaction"("messageId");
-- Ta sama reakcja drugi raz jest JEJ COFNIĘCIEM (AC-23) — indeks unikalny jest tu regułą.
CREATE UNIQUE INDEX "ChatReaction_messageId_userId_emoji_key" ON "ChatReaction"("messageId", "userId", "emoji");

ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- `SET NULL`, nie kaskada: usunięcie cytowanej wiadomości nie może zabrać odpowiedzi na nią.
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_odpowiedzNaId_fkey" FOREIGN KEY ("odpowiedzNaId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 3. Uprawnienie modułu (C-22, wzorzec 0262_modul_youtube) ───────────────
INSERT INTO "Permission" ("id", "slug", "name", "description") VALUES
  (gen_random_uuid()::text, 'module.czat', 'Czat', 'Dostęp do modułu Czat — rozmowy prywatne i kanały zespołów')
ON CONFLICT ("slug") DO NOTHING;

-- ADMIN dostaje uprawnienie od razu; pozostałe role nadaje się w /admin/access.
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'ADMIN', p."id"
FROM "Permission" p WHERE p."slug" = 'module.czat'
ON CONFLICT ("role", "permissionId") DO NOTHING;
