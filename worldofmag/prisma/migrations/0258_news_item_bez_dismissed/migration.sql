-- 086 (AC-4): koniec martwego statusu `DISMISSED`.
--
-- „Odrzuć" i „Przeczytane" zapisywały dwie różne wartości, ale **żaden odczyt ich nie rozróżniał**:
-- nic nie liczyło, nie pokazywało ani nie filtrowało `DISMISSED`. Z punktu widzenia użytkownika obie
-- akcje robiły dokładnie to samo — zdejmowały wiadomość z listy. Zostaje jedna akcja, więc martwa
-- wartość znika też z danych: gdyby została, unia w TypeScripcie musiałaby ją wiecznie znać, a każdy
-- czytający kod pytałby, czym się różni (czyli dokładnie o to, o co zapytał właściciel).
--
-- Kształt tabeli bez zmian — `status` pozostaje kolumną tekstową (C-12).
UPDATE "NewsItem" SET "status" = 'ACKNOWLEDGED' WHERE "status" = 'DISMISSED';
