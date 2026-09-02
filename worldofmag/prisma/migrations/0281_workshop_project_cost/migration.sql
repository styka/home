-- 115 (Z-INT-05): koszt projektu warsztatowego — nullable; księgowanie do Portfela jawne.
ALTER TABLE "WorkshopProject" ADD COLUMN "cost" DOUBLE PRECISION;
