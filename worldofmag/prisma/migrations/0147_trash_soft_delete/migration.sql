-- H5: kosz / soft-delete (migawka usuniętej encji do przywrócenia).
CREATE TABLE "TrashItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrashItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrashItem_userId_deletedAt_idx" ON "TrashItem"("userId", "deletedAt");
ALTER TABLE "TrashItem" ADD CONSTRAINT "TrashItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
