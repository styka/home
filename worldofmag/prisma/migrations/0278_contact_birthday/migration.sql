-- Kontakty: data urodzin (lekki CRM). Nullable — kontakt bez urodzin jest normą, a istniejące
-- wiersze niczego nie muszą wypełniać wstecz. Przechowujemy pełną datę (rok bywa nieznany, ale
-- pole daty w UI i tak go wymaga; rok 1900 w praktyce nie występuje w danych użytkownika).
ALTER TABLE "Contact" ADD COLUMN "birthday" TIMESTAMP(3);
