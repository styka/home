-- 038: przekrojowa PAMIĘĆ TREŚCI generowanych przez AI + nasiona propozycji pogodowych.
--
-- Migracja jest WYŁĄCZNIE addytywna (nowa tabela + kolumny dopuszczające NULL), więc poprzednia
-- wersja kodu działa na nowym schemacie — rollback nie wymaga kroku wstecz na bazie.

-- ─── AiContent ──────────────────────────────────────────────────────────────
-- Jedno miejsce na treść wygenerowaną przez model, wspólne dla wszystkich modułów.
--
-- Powód istnienia: treść AI znikała po odświeżeniu strony i powstawała od nowa, choć użytkownik
-- o to nie prosił — płacił więc za to samo wielokrotnie i nie mógł wrócić do tego, co czytał.
-- Osobne rozwiązanie w każdym module oznaczałoby tę samą logikę nieaktualności napisaną trzy razy.
--
-- `kind` to TEXT + zawężający typ TypeScript (C-12), nigdy enum Prisma.
CREATE TABLE "AiContent" (
    "id"      TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    -- Rodzaj treści: "weather.ideas" | "weather.ideaDetail" | "storage.insights" | …
    "kind" TEXT NOT NULL,
    -- Co identyfikuje TĘ treść w obrębie rodzaju (np. lokalizacja|dzień|pora).
    "scopeKey" TEXT NOT NULL,
    -- Odcisk WARUNKÓW powstania. Różnica względem bieżących = treść nieaktualna (nie: nieważna).
    -- Świadomie nie ma wygasania po czasie: prognoza na ten sam dzień bywa korygowana, ale sam
    -- upływ godzin nie unieważnia planu spaceru.
    "inputHash" TEXT NOT NULL,
    -- Treść w postaci JSON (kształt zależy od rodzaju).
    "content" TEXT NOT NULL,
    -- Zużycie modelu (JSON) — licznik kosztu działa też przy treści odtworzonej z pamięci.
    "usage" TEXT,
    -- Ile razy użytkownik JAWNIE odświeżył (0 = treść z pierwszej generacji).
    "refreshes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiContent_ownerId_kind_scopeKey_key" ON "AiContent"("ownerId", "kind", "scopeKey");
CREATE INDEX "AiContent_ownerId_kind_idx" ON "AiContent"("ownerId", "kind");

ALTER TABLE "AiContent"
    ADD CONSTRAINT "AiContent_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Nasiona propozycji pogodowych ──────────────────────────────────────────
-- Opis pomysłu może powstać wiele dni po jego zaproponowaniu (leniwe generowanie). Bez zapisania
-- warunków z CHWILI ZAPROPONOWANIA plan opisywałby pogodę z dnia czytania, a nie z dnia, dla
-- którego pomysł powstał. Kolumny są opcjonalne — pomysły sprzed tej zmiany nasion nie mają.
ALTER TABLE "WeatherIdea" ADD COLUMN "seedDate" TEXT;
ALTER TABLE "WeatherIdea" ADD COLUMN "seedPart" TEXT;
ALTER TABLE "WeatherIdea" ADD COLUMN "seedWeather" TEXT;
