-- 115 (Z-INT-02): koszt wizyty/badania — nullable, bez żadnej automatyki (dane zdrowotne
-- wychodzą do Portfela wyłącznie jawnym przyciskiem).
ALTER TABLE "HealthEvent" ADD COLUMN "cost" DOUBLE PRECISION;
