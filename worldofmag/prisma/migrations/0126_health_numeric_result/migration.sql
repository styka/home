-- Z2: wartość liczbowa wyniku badania + jednostka (do trendów).
ALTER TABLE "HealthEvent" ADD COLUMN "numericValue" DOUBLE PRECISION;
ALTER TABLE "HealthEvent" ADD COLUMN "unit" TEXT;
