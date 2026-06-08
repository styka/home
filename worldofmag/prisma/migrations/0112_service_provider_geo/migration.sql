-- M5: lokalizacja wykonawcy (filtr w promieniu + dystans).
ALTER TABLE "ServiceProvider" ADD COLUMN "lat" DOUBLE PRECISION;
ALTER TABLE "ServiceProvider" ADD COLUMN "lon" DOUBLE PRECISION;
