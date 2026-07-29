-- 0214: przełącznik propozycji kolejnych pytań („follow-upy") pod odpowiedzią asystenta.
--
-- Follow-upy kosztują tokeny przy KAŻDEJ odpowiedzi, więc administrator ma móc je wyłączyć
-- z panelu (`/admin/llm`) bez wdrażania nowej wersji aplikacji. Wartość startowa `1` zachowuje
-- dotychczasowe zachowanie — samo wdrożenie niczego nie wygasza.
--
-- `DO NOTHING`, a NIE `DO UPDATE`: ponowne uruchomienie migracji nie może cofnąć decyzji admina.
INSERT INTO "Config" ("key", "value", "updatedAt")
VALUES ('assistant_followups_enabled', '1', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
