-- Z-270: per-user ustawienia Zdrowia. aiOptIn domyślnie false (privacy-by-default
-- dla danych wrażliwych — asystent AI nie widzi danych zdrowotnych bez zgody).

-- CreateTable
CREATE TABLE "HealthSettings" (
    "userId" TEXT NOT NULL,
    "aiOptIn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "HealthSettings" ADD CONSTRAINT "HealthSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
