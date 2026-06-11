-- S6: cena jednostkowa pozycji zakupowej (suma → auto-wydatek w Portfelu).
ALTER TABLE "Item" ADD COLUMN "price" DOUBLE PRECISION;
