-- 116 — ADVANCED SKINS: drugi rodzaj skórki (zaawansowana, generowana przez LLM)
-- + trwały magazyn grafik skórek w bazie (decyzja właściciela: Neon, nie Drive/S3).
--
-- `Skin.kind` — "simple" | "advanced" (String + unia TS, C-12). Istniejące wiersze
-- dostają 'simple' przez DEFAULT, więc migracja jest addytywna i bezpieczna.
-- `Skin.definition` — JSON definicji zaawansowanej (NULL dla prostych).
--
-- `SkinAsset` — wzorzec własności jak `Skin` (tabela wyjątkowa z `ownerId`/`ownerTeamId`;
-- NULL/NULL = asset systemowy). ŚWIADOMIE bez `workspaceId` — precedens `Job` po 0245:
-- własność niesie `ownerId`, druga kolumna byłaby trzecim nośnikiem tej samej informacji.
-- `hash` (SHA-256) jest INDEKSEM, nie UNIQUE: deduplikacja działa w obrębie właściciela
-- i assetów systemowych; globalny unique łamałby kaskadę usuwania konta (asset
-- współdzielony między kontami znikałby razem z cudzym kontem).

ALTER TABLE "Skin" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'simple';
ALTER TABLE "Skin" ADD COLUMN "definition" TEXT;

CREATE TABLE "SkinAsset" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkinAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SkinAsset_hash_idx" ON "SkinAsset"("hash");
CREATE INDEX "SkinAsset_ownerId_idx" ON "SkinAsset"("ownerId");
CREATE INDEX "SkinAsset_ownerTeamId_idx" ON "SkinAsset"("ownerTeamId");

ALTER TABLE "SkinAsset" ADD CONSTRAINT "SkinAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkinAsset" ADD CONSTRAINT "SkinAsset_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
