-- Marketplace Etap A: M8 (czas trwania + włącznik rezerwacji na ofercie) + M2 (dostępność/sloty).
ALTER TABLE "ServiceListing" ADD COLUMN "durationMin" INTEGER;
ALTER TABLE "ServiceListing" ADD COLUMN "bookingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ServiceAvailability" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    CONSTRAINT "ServiceAvailability_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceAvailability_providerId_weekday_idx" ON "ServiceAvailability"("providerId", "weekday");
ALTER TABLE "ServiceAvailability" ADD CONSTRAINT "ServiceAvailability_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
