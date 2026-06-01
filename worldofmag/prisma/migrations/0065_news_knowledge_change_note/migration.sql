-- Wiadomości: opis zmian per wersja bazy wiedzy.
-- changeNote (Markdown) = „co się zmieniło" w danej wersji względem poprzedniej;
-- dla wersji bazowej opisuje sposób zbudowania bazy + ostatnią znaną informację.

ALTER TABLE "NewsKnowledge" ADD COLUMN "changeNote" TEXT;
