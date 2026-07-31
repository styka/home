-- 037: Pogoda — biblioteka pomysłów „Co robić?" + przełącznik licznika kosztów AI.
--
-- Migracja jest WYŁĄCZNIE addytywna (nowa tabela + idempotentny seed konfiguracji), więc stara
-- wersja kodu działa na nowym schemacie — rollback nie wymaga kroku wstecz na bazie.

-- ─── WeatherIdea ────────────────────────────────────────────────────────────
-- Propozycja „co robić", z którą użytkownik COŚ ZROBIŁ: obejrzał szczegóły, zapisał ją albo
-- zablokował. Wiersz powstaje leniwie — sama wygenerowana lista nie ląduje w bazie (powtórne
-- wejście na /pogoda tego samego dnia obsługuje pamięć podręczna promptu w chatComplete).
--
-- `category` i `state` to TEXT + zawężający typ TypeScript (C-12) — nigdy enum Prisma.
CREATE TABLE "WeatherIdea" (
    "id"            TEXT NOT NULL,
    "ownerId"       TEXT NOT NULL,
    -- Odcisk tytułu (małe litery, bez diakrytyków i interpunkcji). Klucz naturalny propozycji:
    -- po nim rozpoznajemy powtórkę („już rozważana") i egzekwujemy blokadę („nie proponuj").
    "fingerprint"   TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "summary"       TEXT NOT NULL DEFAULT '',
    -- "outdoor" | "trip" | "home" | "other"
    "category"      TEXT NOT NULL DEFAULT 'other',
    -- "considered" | "saved" | "blocked"
    "state"         TEXT NOT NULL DEFAULT 'considered',
    "locationLabel" TEXT NOT NULL DEFAULT '',
    "lat"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lon"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    -- Wygenerowany szczegółowy plan (markdown). NULL = propozycja tylko zapisana/zablokowana.
    "detail"        TEXT,
    "detailAt"      TIMESTAMP(3),
    -- Ile razy generowano szczegóły ("Generuj ponownie" podbija licznik).
    "detailRuns"    INTEGER NOT NULL DEFAULT 0,
    -- Zużycie ostatniej generacji (JSON) — licznik kosztu przy ZAPISANEJ treści musi działać
    -- także po ponownym wejściu do aplikacji, gdy nie ma już świeżego wyniku z modelu.
    "detailUsage"   TEXT,
    "viewCount"     INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherIdea_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeatherIdea_ownerId_fingerprint_key" ON "WeatherIdea"("ownerId", "fingerprint");
CREATE INDEX "WeatherIdea_ownerId_state_idx" ON "WeatherIdea"("ownerId", "state");

ALTER TABLE "WeatherIdea"
    ADD CONSTRAINT "WeatherIdea_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Przełącznik licznika kosztów AI ────────────────────────────────────────
-- Domyślnie WŁĄCZONY ('1'). Wzorzec 1:1 z 0214 (assistant_followups_enabled): brak wiersza też
-- oznacza „włączone", więc seed jest wygodą, nie warunkiem poprawności.
--
-- `id` NIE ma wartości domyślnej po stronie bazy (Prisma nadaje cuid w aplikacji), więc podajemy je
-- jawnie. `DO NOTHING`, a nie `DO UPDATE` — ponowne uruchomienie nie może cofnąć decyzji admina.
INSERT INTO "Config" ("id", "key", "value", "updatedAt")
VALUES (gen_random_uuid()::text, 'ai_cost_badge_enabled', '1', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
