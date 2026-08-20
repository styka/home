-- 082 — dwie nowe tabele. Wyłącznie DDL; dane katalogu idą osobną migracją (0255), żeby przegląd
-- zmiany schematu nie tonął w czterystu wierszach seedu.
--
-- DDL pisany RĘCZNIE, nie z `prisma migrate diff` (C-15): diff generuje „doprowadzenie bazy do
-- schematu", więc zaproponowałby skasowanie wszystkiego, co żyje wyłącznie w surowym SQL-u
-- (indeksy pg_trgm, częściowy indeks list zakupów, wyzwalacze przestrzeni).
--
-- Wycofanie: DROP TABLE "NewsSourceCatalog"; DROP TABLE "WeatherPref";
-- Bezpieczne — obie tabele są nowe, żadna istniejąca nie jest ruszana.

-- ─── Systemowa biblioteka źródeł RSS ──────────────────────────────────────
--
-- Bez `workspaceId` i bez `ownerId`: to słownik SYSTEMOWY, jak `Category` z `userId=null,
-- teamId=null`. Czyta go każdy zalogowany, edytuje wyłącznie administrator. Własność przestrzeni
-- oznaczałaby czterysta wierszy kopii na użytkownika i poprawkę adresu, która nie dociera do nikogo.
CREATE TABLE IF NOT EXISTS "NewsSourceCatalog" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "rssUrl"      TEXT NOT NULL,
    "homepageUrl" TEXT NOT NULL DEFAULT '',
    "descriptor"  TEXT NOT NULL DEFAULT '',
    "country"     TEXT NOT NULL DEFAULT '',
    "language"    TEXT NOT NULL DEFAULT '',
    "category"    TEXT NOT NULL DEFAULT 'inne',
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "checkStatus" TEXT NOT NULL DEFAULT 'unknown',
    "checkedAt"   TIMESTAMP(3),
    "checkNote"   TEXT NOT NULL DEFAULT '',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsSourceCatalog_pkey" PRIMARY KEY ("id")
);

-- Klucz naturalny wpisu. To on czyni seed idempotentnym (`ON CONFLICT ("key") DO NOTHING`),
-- rozpoznaje „już dodane" i chroni import przed duplikatami.
CREATE UNIQUE INDEX IF NOT EXISTS "NewsSourceCatalog_key_key" ON "NewsSourceCatalog"("key");

-- Zapytanie z przeglądarki biblioteki filtruje po włączeniu i kraju; panel administratora po
-- kategorii. Przy czterystu wierszach to jeszcze nie jest kwestia wydajności, ale katalog ma rosnąć.
CREATE INDEX IF NOT EXISTS "NewsSourceCatalog_enabled_country_idx" ON "NewsSourceCatalog"("enabled", "country");
CREATE INDEX IF NOT EXISTS "NewsSourceCatalog_category_idx" ON "NewsSourceCatalog"("category");

-- ─── Preferencja układu listy obserwatorów pogody ─────────────────────────
--
-- Odpowiednik `NewsPref`: jedna preferencja na przestrzeń osobistą, unikalność na `workspaceId`.
-- Kolumna jest NOT NULL i BEZ wartości domyślnej — nie ma tu czego wypełniać wstecz, więc wyzwalacz
-- `omnia_fill_workspace` się nie zakłada (dotyczy tabel z NULLOWALNYM `workspaceId`), a przestrzeń
-- podaje `wlasnoscOsobistaDoZapisu` przy każdym zapisie.
CREATE TABLE IF NOT EXISTS "WeatherPref" (
    "id"             TEXT NOT NULL,
    "watchersLayout" TEXT NOT NULL DEFAULT 'status',
    "watchersFilter" TEXT NOT NULL DEFAULT '',
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId"    TEXT NOT NULL,

    CONSTRAINT "WeatherPref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeatherPref_workspaceId_key" ON "WeatherPref"("workspaceId");

ALTER TABLE "WeatherPref"
    ADD CONSTRAINT "WeatherPref_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
