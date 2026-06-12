-- M14: pracownicy firmy uslugowej + per-staff harmonogram i rezerwacje.
CREATE TABLE "ServiceStaff" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceStaff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceStaff_providerId_idx" ON "ServiceStaff"("providerId");
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceAvailability" ADD COLUMN "staffId" TEXT;
CREATE INDEX "ServiceAvailability_staffId_weekday_idx" ON "ServiceAvailability"("staffId", "weekday");
ALTER TABLE "ServiceAvailability" ADD CONSTRAINT "ServiceAvailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "ServiceStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRequest" ADD COLUMN "staffId" TEXT;
CREATE INDEX "ServiceRequest_staffId_status_idx" ON "ServiceRequest"("staffId", "status");
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "ServiceStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
