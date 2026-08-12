-- Faza 2 przebudowy, zadanie 9 — PRZESTRZENIE I NADANIA (rozdz. 8.3 architektury docelowej).
--
-- Migracja robi DWIE rzeczy i obie są konieczne razem:
--   1. tworzy cztery tabele fundamentu współdzielenia,
--   2. WYPEŁNIA je danymi z istniejących zespołów i kont (rozdz. 8.10, kroki 1 i 2).
--
-- Dlaczego backfill jest TUTAJ, a nie w seedzie: seed nie odpala się automatycznie po wdrożeniu
-- (patrz CLAUDE.md, „Seed data does not run automatically after deploy"), więc niezmiennik
-- „każdy użytkownik ma przestrzeń osobistą" wszedłby w życie dopiero, gdyby ktoś pamiętał.
--
-- Co ta migracja ROBI aplikacji: nic. Nowe tabele nie mają jeszcze ani jednego czytelnika —
-- dostęp liczy się dalej przez `ownerId`/`ownerTeamId`. Przełączenie odczytów to zadania 10 i 11.
--
-- Idempotencja: wszystkie wstawienia mają ON CONFLICT, więc powtórne wykonanie sekcji backfillu
-- nie tworzy duplikatów. To nie jest ozdoba — wdrożenie potrafi migrację powtórzyć.
--
-- Wycofanie: DROP TABLE "ResourceInvitation", "ResourceGrant", "WorkspaceMember", "Workspace";
-- Bezpieczne bez wycofywania kodu, bo nic z tych tabel nie czyta.

-- DropIndex
DROP INDEX "Note_content_trgm_idx";

-- DropIndex
DROP INDEX "Note_title_trgm_idx";

-- AlterTable
ALTER TABLE "AssistantPref" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LlmModelPrice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserLlmPref" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "personalUserId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateTable
CREATE TABLE "ResourceGrant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "role" TEXT NOT NULL,
    "inherited" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceInvitation" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_personalUserId_key" ON "Workspace"("personalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_teamId_key" ON "Workspace"("teamId");

-- CreateIndex
CREATE INDEX "Workspace_kind_idx" ON "Workspace"("kind");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE INDEX "ResourceGrant_subjectType_subjectId_idx" ON "ResourceGrant"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ResourceGrant_resourceType_resourceId_idx" ON "ResourceGrant"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceGrant_workspaceId_idx" ON "ResourceGrant"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceGrant_resourceType_resourceId_subjectType_subjectId_key" ON "ResourceGrant"("resourceType", "resourceId", "subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceInvitation_token_key" ON "ResourceInvitation"("token");

-- CreateIndex
CREATE INDEX "ResourceInvitation_email_idx" ON "ResourceInvitation"("email");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_personalUserId_fkey" FOREIGN KEY ("personalUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceGrant" ADD CONSTRAINT "ResourceGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ══════════════════════════════════════════════════════════════════════════════════════
-- BACKFILL — rozdz. 8.10, kroki 1 i 2. Wyłącznie INSERT do NOWYCH tabel: żaden istniejący
-- wiersz nie jest zmieniany ani kasowany, więc najgorszy skutek błędu to niekompletne
-- lustro, nigdy utrata danych.
-- ══════════════════════════════════════════════════════════════════════════════════════

-- Krok 1a: przestrzeń zespołowa dla każdego zespołu.
-- `Team.kind` ("team" | "household") NIE przenosi się na `Workspace.kind` — rodzaj przestrzeni
-- ma dwie wartości (osobista / zespołowa), a rozróżnienie wewnątrz zespołu zostaje po stronie
-- zespołu (spec §8).
INSERT INTO "Workspace" ("id", "kind", "name", "teamId", "createdAt")
SELECT gen_random_uuid()::text, 'team', t."name", t."id", t."createdAt"
FROM "Team" t
ON CONFLICT ("teamId") DO NOTHING;

-- Krok 1b: członkowie zespołu → członkowie przestrzeni. Mapowanie ról wg rozdz. 8.10:
-- OWNER→owner, ADMIN→admin, wszystko inne→member.
INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "createdAt")
SELECT w."id", tm."userId",
       CASE tm."role" WHEN 'OWNER' THEN 'owner' WHEN 'ADMIN' THEN 'admin' ELSE 'member' END,
       tm."joinedAt"
FROM "TeamMember" tm
JOIN "Workspace" w ON w."teamId" = tm."teamId"
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

-- Krok 1c: WŁAŚCICIEL ZESPOŁU — osobno i PO kroku 1b, świadomie.
-- `Team.ownerId` jest niezależny od tabeli członków: właściciel może nie mieć wiersza
-- `TeamMember` (nic tego nie wymusza), a wtedy odwzorowanie „po członkach" wygląda na kompletne
-- i po cichu go gubi. DO UPDATE, a nie DO NOTHING — jeśli właściciel figuruje wśród członków
-- z niższą rolą, rola właściciela musi wygrać.
INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "createdAt")
SELECT w."id", t."ownerId", 'owner', t."createdAt"
FROM "Team" t
JOIN "Workspace" w ON w."teamId" = t."id"
ON CONFLICT ("workspaceId", "userId") DO UPDATE SET "role" = 'owner';

-- Krok 2a: przestrzeń osobista dla każdego istniejącego konta.
INSERT INTO "Workspace" ("id", "kind", "name", "personalUserId", "createdAt")
SELECT gen_random_uuid()::text, 'personal', 'Moja przestrzeń', u."id", CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("personalUserId") DO NOTHING;

-- Krok 2b: właściciel swojej przestrzeni osobistej.
INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "createdAt")
SELECT w."id", w."personalUserId", 'owner', w."createdAt"
FROM "Workspace" w
WHERE w."personalUserId" IS NOT NULL
ON CONFLICT ("workspaceId", "userId") DO UPDATE SET "role" = 'owner';
