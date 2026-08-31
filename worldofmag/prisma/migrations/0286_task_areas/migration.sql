-- 117: Obszary w module Zadania — drzewo per projekt + przypisanie zadania do obszaru.
CREATE TABLE "TaskArea" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskArea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskArea_projectId_parentId_idx" ON "TaskArea"("projectId", "parentId");

ALTER TABLE "TaskArea" ADD CONSTRAINT "TaskArea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cascade świadomie: tryb „usuń poddrzewo" kasuje korzeń, a FK zdejmuje gałąź.
ALTER TABLE "TaskArea" ADD CONSTRAINT "TaskArea_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TaskArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD COLUMN "areaId" TEXT;

CREATE INDEX "Task_areaId_idx" ON "Task"("areaId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "TaskArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
