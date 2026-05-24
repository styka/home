-- ─── QA module: hierarchical test scenarios ───────────────────────────────

-- Epic (top-level grouping per module)
CREATE TABLE "QaEpic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QaEpic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QaEpic_slug_key" ON "QaEpic"("slug");
CREATE INDEX "QaEpic_module_order_idx" ON "QaEpic"("module", "order");

-- User Story (groups scenarios within an epic)
CREATE TABLE "QaUserStory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "epicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QaUserStory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QaUserStory_slug_key" ON "QaUserStory"("slug");
CREATE INDEX "QaUserStory_epicId_order_idx" ON "QaUserStory"("epicId", "order");
ALTER TABLE "QaUserStory" ADD CONSTRAINT "QaUserStory_epicId_fkey"
  FOREIGN KEY ("epicId") REFERENCES "QaEpic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Test Scenario (atomic test case)
CREATE TABLE "QaTestScenario" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'positive',
    "priority" TEXT NOT NULL DEFAULT 'P1',
    "content" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "authorId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QaTestScenario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QaTestScenario_slug_key" ON "QaTestScenario"("slug");
CREATE INDEX "QaTestScenario_storyId_order_idx" ON "QaTestScenario"("storyId", "order");
CREATE INDEX "QaTestScenario_priority_idx" ON "QaTestScenario"("priority");
CREATE INDEX "QaTestScenario_type_idx" ON "QaTestScenario"("type");
ALTER TABLE "QaTestScenario" ADD CONSTRAINT "QaTestScenario_storyId_fkey"
  FOREIGN KEY ("storyId") REFERENCES "QaUserStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QaTestScenario" ADD CONSTRAINT "QaTestScenario_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
