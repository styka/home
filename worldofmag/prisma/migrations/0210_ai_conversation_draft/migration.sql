-- 032: brudnopis pola wiadomości asystenta, trzymany PRZY ROZMOWIE na koncie użytkownika.
--
-- Po co: gdy użytkownik zacznie pisać i nie wyśle (zamknie asystenta, przełączy wątek), treść
-- przepadała. Zapis na koncie (a nie w pamięci przeglądarki) sprawia, że tekst wraca także na
-- innym urządzeniu — spójnie z tym, jak od paczki 031 trzymamy preferencje asystenta.
--
-- Kolumna jest NULLOWALNA i addytywna, więc starszy kod działa z nią bez zmian (bezpieczny rollback
-- kodu bez cofania migracji). NULL/"" = brak brudnopisu.
ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "draft" TEXT;
