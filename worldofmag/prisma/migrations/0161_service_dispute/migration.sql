-- M17: spory/moderacja zlecen marketplace.
CREATE TABLE "ServiceDispute" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceDispute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceDispute_status_createdAt_idx" ON "ServiceDispute"("status", "createdAt");
CREATE INDEX "ServiceDispute_requestId_idx" ON "ServiceDispute"("requestId");
ALTER TABLE "ServiceDispute" ADD CONSTRAINT "ServiceDispute_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
