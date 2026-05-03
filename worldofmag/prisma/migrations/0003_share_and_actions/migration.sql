-- CreateTable Share
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'VIEW',
    "grantedById" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateTable ActionComponent
CREATE TABLE "ActionComponent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "defaultParams" TEXT,

    CONSTRAINT "ActionComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable Action
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "componentId" TEXT NOT NULL,
    "params" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurPattern" TEXT,
    "recurInterval" INTEGER,
    "recurDaysOfWeek" TEXT,
    "recurDayOfMonth" INTEGER,
    "recurMonthOfYear" INTEGER,
    "nextDueDateBasis" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "lastAdvancedAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActionComponent_name_key" ON "ActionComponent"("name");

-- CreateIndex
CREATE INDEX "Share_resourceType_resourceId_idx" ON "Share"("resourceType", "resourceId");
CREATE INDEX "Share_recipientUserId_idx" ON "Share"("recipientUserId");
CREATE INDEX "Share_recipientTeamId_idx" ON "Share"("recipientTeamId");

-- CreateIndex
CREATE INDEX "Action_ownerUserId_idx" ON "Action"("ownerUserId");
CREATE INDEX "Action_ownerTeamId_idx" ON "Action"("ownerTeamId");
CREATE INDEX "Action_status_idx" ON "Action"("status");
CREATE INDEX "Action_dueDate_idx" ON "Action"("dueDate");

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Share" ADD CONSTRAINT "Share_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Share" ADD CONSTRAINT "Share_recipientTeamId_fkey" FOREIGN KEY ("recipientTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ActionComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
