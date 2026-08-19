-- 080 (Z8, Z12): trzy preferencje użytkownika, każda pod jedno zgłoszenie właściciela.
--
-- Wartości domyślne dobrane tak, żeby użytkownik, który niczego nie ustawi, NIE zauważył zmiany:
--   readerRate 0.95  — dokładnie tyle wynosiło zaszyte `u.rate` w src/lib/tts.ts,
--   readerFollow true — tak zachowuje się dzisiejszy lektor (przewija za czytaniem),
--   favoritesCollapsed true — TU jest wyjątek i to jest treść zgłoszenia Z8: sekcja ulubionych
--     ma startować ZWINIĘTA, bo rozwinięta spycha pozycje modułów poniżej pierwszego ekranu.
--
-- `IF NOT EXISTS` na każdej kolumnie: migracja musi przejść także po ręcznym dołożeniu kolumny
-- na środowisku testowym, inaczej deploy stanie na błędzie zamiast na różnicy.

ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "readerRate"   DOUBLE PRECISION NOT NULL DEFAULT 0.95;
ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "readerFollow" BOOLEAN          NOT NULL DEFAULT true;
ALTER TABLE "UserMenuPref"  ADD COLUMN IF NOT EXISTS "favoritesCollapsed" BOOLEAN    NOT NULL DEFAULT true;
