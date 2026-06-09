-- M11: ulubieni/obserwowani wykonawcy (per użytkownik).
CREATE TABLE "ServiceFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceFavorite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceFavorite_userId_providerId_key" ON "ServiceFavorite"("userId", "providerId");
CREATE INDEX "ServiceFavorite_userId_idx" ON "ServiceFavorite"("userId");
ALTER TABLE "ServiceFavorite" ADD CONSTRAINT "ServiceFavorite_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
