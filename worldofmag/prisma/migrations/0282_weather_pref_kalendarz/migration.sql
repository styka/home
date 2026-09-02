-- 115 (Z-INT-15): przełącznik paska prognozy we wspólnym kalendarzu. Domyślnie WŁĄCZONY
-- (czysty odczyt bez kosztu AI); automat musi być wyłączalny — stąd kolumna, nie stała.
ALTER TABLE "WeatherPref" ADD COLUMN "kalendarzPrognoza" BOOLEAN NOT NULL DEFAULT true;
