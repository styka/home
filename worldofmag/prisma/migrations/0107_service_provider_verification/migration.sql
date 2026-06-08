-- M7: weryfikacja wykonawcy (NIP + badge zaufania ustawiany przez admina).
ALTER TABLE "ServiceProvider" ADD COLUMN "nip" TEXT;
ALTER TABLE "ServiceProvider" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
