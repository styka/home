-- 125: Obszary zamiast grup projektów.
--
-- Tabela "TaskView" (dotychczasowe grupy projektów) staje się nośnikiem OBSZARÓW-KATEGORII:
-- te same wiersze i id (stare adresy /tasks/zestaw/<id> przekierowują 1:1), a kolumna
-- "projectIds" zostaje NIETKNIĘTA jako dane źródłowe migracji (AC-8: bez kasowania źródła;
-- rollback = powrót starego kodu, który czyta projectIds jak dawniej).
--
-- Zmiany są czysto addytywne:
--  1) TaskView.parentId  — drzewo kategorii (obszar w obszarze); ON DELETE SET NULL, bo
--     usunięcie rodzica ma awansować dzieci na szczyt, nigdy kasować poddrzewa.
--  2) TaskProject.areaId — przypisanie projektu do obszaru (1:N); ON DELETE SET NULL, bo
--     usunięcie obszaru zdejmuje wyłącznie przypisanie (AC-7).
--  3) Przepisanie danych: „pierwsza grupa wygrywa" (order, createdAt, id) — idempotentnie
--     (tylko tam, gdzie areaId IS NULL) i odpornie na złom w projectIds (strażnik ~ '^\[').

ALTER TABLE "TaskView" ADD COLUMN IF NOT EXISTS "parentId" TEXT;

DO $$ BEGIN
  ALTER TABLE "TaskView"
    ADD CONSTRAINT "TaskView_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "TaskView"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "TaskView_workspaceId_parentId_idx" ON "TaskView"("workspaceId", "parentId");

ALTER TABLE "TaskProject" ADD COLUMN IF NOT EXISTS "areaId" TEXT;

DO $$ BEGIN
  ALTER TABLE "TaskProject"
    ADD CONSTRAINT "TaskProject_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "TaskView"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "TaskProject_areaId_idx" ON "TaskProject"("areaId");

-- Dane: każdemu projektowi bez przypisania — obszar z PIERWSZEJ grupy, która go zawiera.
UPDATE "TaskProject" p
SET "areaId" = (
  SELECT v."id" FROM "TaskView" v
  WHERE v."workspaceId" = p."workspaceId"
    AND v."projectIds" ~ '^\['
    AND v."projectIds"::jsonb ? p."id"
  ORDER BY v."order" ASC, v."createdAt" ASC, v."id" ASC
  LIMIT 1
)
WHERE p."areaId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "TaskView" v
    WHERE v."workspaceId" = p."workspaceId"
      AND v."projectIds" ~ '^\['
      AND v."projectIds"::jsonb ? p."id"
  );
