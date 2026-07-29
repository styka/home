-- 0214: przełącznik propozycji kolejnych pytań („follow-upy") pod odpowiedzią asystenta.
--
-- Follow-upy kosztują tokeny przy KAŻDEJ odpowiedzi, więc administrator ma móc je wyłączyć
-- z panelu (`/admin/llm`) bez wdrażania nowej wersji aplikacji. Wartość startowa `1` zachowuje
-- dotychczasowe zachowanie — samo wdrożenie niczego nie wygasza.
--
-- `DO NOTHING`, a NIE `DO UPDATE`: ponowne uruchomienie migracji nie może cofnąć decyzji admina.
-- `id` NIE ma wartości domyślnej po stronie bazy (Prisma nadaje cuid w aplikacji), więc w SQL-u
-- trzeba je podać jawnie — tak samo jak w migracjach seedujących uprawnienia i raporty.
INSERT INTO "Config" ("id", "key", "value", "updatedAt")
VALUES (gen_random_uuid()::text, 'assistant_followups_enabled', '1', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
