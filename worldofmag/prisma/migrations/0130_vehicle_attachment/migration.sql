-- F3: załączniki pojazdu (faktury, dowód rejestracyjny, OC).
CREATE TABLE "VehicleAttachment" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VehicleAttachment_vehicleId_idx" ON "VehicleAttachment"("vehicleId");
ALTER TABLE "VehicleAttachment" ADD CONSTRAINT "VehicleAttachment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
