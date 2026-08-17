-- Zadanie 11, ETAP 4 — WARUNEK WEJŚCIA: `NewsPref` dostaje własny klucz główny.
--
-- DLACZEGO TO MUSI POWSTAĆ PRZED `DROP COLUMN`. `NewsPref` była jedyną z 46 tabel, której kluczem
-- głównym było **samo `ownerId`** — kolumna, którą etap 4 usuwa. Skutek jest gorszy niż utrata
-- danych, bo cichszy: po usunięciu kolumny wiersz nie ma ŻADNEJ tożsamości, więc kopia z migracji
-- 0233 zna wartość, ale nie ma po czym dopasować jej z powrotem do wiersza. Ta jedna tabela była
-- **nieodtwarzalna z definicji**, niezależnie od jakości kopii.
--
-- Wyszło to dopiero przy PRÓBIE ODTWORZENIA, nie przy pisaniu kopii — i potwierdziła to sama
-- Prisma, która po zdjęciu `ownerId` odmawia przyjęcia schematu: *„Each model must have at least
-- one unique criteria that has only required fields"*.
--
-- CO ROBI:
--   1. dokłada `id` i wypełnia je dla istniejących wierszy,
--   2. przenosi klucz główny z `ownerId` na `id`,
--   3. zostawia `ownerId` UNIKALNYM — niezmiennik „jedna preferencja na użytkownika" trwa,
--      a `findUnique`/`upsert` po `ownerId` (7 miejsc w kodzie) działają bez zmiany,
--   4. **przekluczowuje kopię z 0233**, żeby wpisy `NewsPref` wskazywały na nowy klucz główny.
--      Bez punktu 4 kopia dalej opisywałaby wiersze po `ownerId` i po etapie 4 byłaby bezużyteczna
--      dokładnie dla tej tabeli, dla której powstała ta migracja.

ALTER TABLE "NewsPref" ADD COLUMN IF NOT EXISTS "id" TEXT;
UPDATE "NewsPref" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
ALTER TABLE "NewsPref" ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE "NewsPref" DROP CONSTRAINT IF EXISTS "NewsPref_pkey";
ALTER TABLE "NewsPref" ADD CONSTRAINT "NewsPref_pkey" PRIMARY KEY ("id");

-- Klucz obcy do `User` zostaje; dochodzi unikalność, która wcześniej wynikała z bycia PK.
CREATE UNIQUE INDEX IF NOT EXISTS "NewsPref_ownerId_key" ON "NewsPref"("ownerId");

-- Przekluczowanie kopii własności: wpisy `NewsPref` mają odtąd wskazywać na `id`, nie na `ownerId`.
-- Idempotentne — po ponownym uruchomieniu wstawi dokładnie te same wiersze.
DELETE FROM "_KopiaWlasnosci" WHERE "tabela" = 'NewsPref';
INSERT INTO "_KopiaWlasnosci" ("tabela", "klucz", "wiersz", "ownerId", "ownerTeamId")
SELECT 'NewsPref', 'id', "id", "ownerId", NULL
  FROM "NewsPref"
ON CONFLICT ("tabela", "wiersz") DO NOTHING;
