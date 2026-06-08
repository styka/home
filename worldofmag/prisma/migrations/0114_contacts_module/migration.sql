-- NM9: moduł Kontakty / osobisty CRM (własność 3-poziom).
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");
CREATE INDEX "Contact_ownerTeamId_idx" ON "Contact"("ownerTeamId");
