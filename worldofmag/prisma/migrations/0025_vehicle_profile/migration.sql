-- ─── Truck routing (Trasy TIR): per-user vehicle profile ──────────────────

CREATE TABLE "VehicleProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "length" DOUBLE PRECISION NOT NULL DEFAULT 16.5,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 2.55,
    "axleload" DOUBLE PRECISION NOT NULL DEFAULT 11.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VehicleProfile_userId_key" ON "VehicleProfile"("userId");
ALTER TABLE "VehicleProfile" ADD CONSTRAINT "VehicleProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
