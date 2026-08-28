-- 113 (spec 113-modul-roslin) — MODUŁ ROŚLINY.
--
-- Dziesięć tabel + uprawnienie modułu. Tabele są NOWE i nie ruszają niczego, co już istnieje —
-- jedyne powiązanie z resztą bazy to klucz obcy do `Workspace`. Dlatego w tym pliku nie ma ani
-- jednego `DROP`, ani jednego `ALTER … DROP COLUMN` (C-15), a wycofanie zmiany to `DROP TABLE`
-- w odwrotnej kolejności kluczy obcych.
--
-- TRZY RZECZY, KTÓRE ŁATWO NAPISAĆ INACZEJ I ZEPSUĆ:
--
--  1. **`workspaceId` jest WYMAGANY i bez wartości domyślnej.** Bramka `check:workspace-fill` żąda
--     wyzwalacza `omnia_fill_workspace` dla każdego modelu z *nullowalnym* `workspaceId`, a
--     jednocześnie odrzuca wyzwalacz na tabeli spoza pięcioosobowej listy wyjątków z 079 („pokryty
--     zbiór i lista wyjątków muszą być tym samym zbiorem"). Nullowalna przestrzeń na nowej tabeli
--     jest więc nieprzeprowadzalna przez bramkę. Nie ma tu też `DEFAULT` z 054 — to był domyślnik
--     dla tabel wypełnianych WSTECZ; na nowej tabeli nie ma czego wypełniać, a domyślnik uczyniłby
--     pole opcjonalnym w kliencie Prismy (lekcja `WeatherPref`, 082).
--
--  2. **Katalog gatunków to DWIE tabele, nie jedna.** `PlantSpeciesCatalog` jest systemowy i
--     dlatego NIE MA kolumny przestrzeni (odpowiednik `NewsSourceCatalog`); `PlantSpecies` to kopia
--     w przestrzeni użytkownika (odpowiednik `NewsSource`). Wynika to wprost z punktu 1: jedna
--     tabela nie może mieć przestrzeni jednocześnie wymaganej i nieobecnej. Efekt uboczny jest
--     pożądany — wyłączenie martwego wpisu w katalogu nikomu nie kasuje jego historii.
--
--  3. **`PlantCareEvent` to JEDNA tabela dla podlania i dla oprysku.** Pola ewidencyjne
--     (`applicationKind`, `permitNumber`, `locationText`, dawka, powierzchnia) są nullowalne i
--     wypełnia je wyłącznie tryb zawodowy. Rozbicie na „czynności hobbysty" i „zabiegi rolnika"
--     pozbawiłoby ewidencję z AC-24/AC-25 jednego źródła, a oś czasu rośliny musiałaby scalać dwie
--     tabele w kodzie.

-- ─── Katalog systemowy gatunków (bez przestrzeni — wzorzec NewsSourceCatalog) ───
CREATE TABLE "PlantSpeciesCatalog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "nameLatin" TEXT NOT NULL,
    "family" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "light" TEXT,
    "waterJson" TEXT,
    "soil" TEXT,
    "tempMinC" DOUBLE PRECISION,
    "phenologyJson" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantSpeciesCatalog_pkey" PRIMARY KEY ("id")
);

-- ─── Gatunek w przestrzeni użytkownika (kopia katalogu albo wpis własny) ───
CREATE TABLE "PlantSpecies" (
    "id" TEXT NOT NULL,
    "catalogKey" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'user',
    "namePl" TEXT NOT NULL,
    "nameLatin" TEXT NOT NULL,
    "family" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "light" TEXT,
    "waterJson" TEXT,
    "soil" TEXT,
    "tempMinC" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "PlantSpecies_pkey" PRIMARY KEY ("id")
);

-- ─── Przestrzeń roślinna (mieszkanie / ogród / produkcja / pole) ───
CREATE TABLE "PlantSpace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'home',
    "weatherLocationId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "PlantSpace_pkey" PRIMARY KEY ("id")
);

-- ─── Miejsce w przestrzeni — jedno pojęcie w czterech skalach ───
CREATE TABLE "PlantPlace" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'windowsill',
    "sun" TEXT NOT NULL DEFAULT 'unknown',
    "soil" TEXT,
    "areaValue" DOUBLE PRECISION,
    "areaUnit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantPlace_pkey" PRIMARY KEY ("id")
);

-- ─── Byt roślinny: egzemplarz, partia albo powierzchnia — JEDNA tabela ───
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "placeId" TEXT,
    "speciesId" TEXT,
    "name" TEXT NOT NULL,
    "customSpecies" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "quantityUnit" TEXT NOT NULL DEFAULT 'szt',
    "stage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "statusAt" TIMESTAMP(3),
    "sownAt" TIMESTAMP(3),
    "acquiredAt" TIMESTAMP(3),
    "parentId" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- ─── Harmonogram opieki. `reason` niesie UZASADNIENIE terminu (AC-9) ───
CREATE TABLE "PlantCareTask" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "plantId" TEXT,
    "placeId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'WATERING',
    "title" TEXT NOT NULL,
    "recurring" TEXT,
    "lastDoneAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantCareTask_pkey" PRIMARY KEY ("id")
);

-- ─── Zdarzenie-zabieg: wykonanie, oprysk z ewidencją ŚOR albo zbiór ───
CREATE TABLE "PlantCareEvent" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "plantId" TEXT,
    "placeId" TEXT,
    "taskId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'WATERING',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL DEFAULT 'DONE',
    "note" TEXT,
    -- Ewidencja stosowania środków ochrony roślin. Trzy ostatnie pola tej grupy to dokładnie te,
    -- które doszły do obowiązku od 1 stycznia 2026: rodzaj zastosowania, numer zezwolenia
    -- i dokładna lokalizacja zabiegu (AC-24).
    "productName" TEXT,
    "permitNumber" TEXT,
    "applicationKind" TEXT,
    "doseValue" DOUBLE PRECISION,
    "doseUnit" TEXT,
    "areaValue" DOUBLE PRECISION,
    "areaUnit" TEXT,
    "locationText" TEXT,
    "operator" TEXT,
    "conditions" TEXT,
    -- Karencja: funkcja („nie zbieraj przed") jest etapem 2, ale POLE zakładamy teraz, żeby etap 2
    -- nie był migracją na tabeli, która zdąży się zapełnić danymi (spec §5).
    "withdrawalDays" INTEGER,
    -- Zbiór jako rodzaj zdarzenia, nie osobna tabela.
    "quantity" DOUBLE PRECISION,
    "quantityUnit" TEXT,
    "pantryItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantCareEvent_pkey" PRIMARY KEY ("id")
);

-- ─── Dziennik rośliny ───
CREATE TABLE "PlantJournalEntry" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantJournalEntry_pkey" PRIMARY KEY ("id")
);

-- ─── Pomiar. `source` to szew pod sensory (etap 2) — patrz nagłówek pliku ───
CREATE TABLE "PlantMeasurement" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL DEFAULT 'HEIGHT_CM',
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'cm',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantMeasurement_pkey" PRIMARY KEY ("id")
);

-- ─── Zdarzenie zdrowotne (diagnoza). `outcome` odpowiada na „czy pomogło" ───
CREATE TABLE "PlantHealthEvent" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "symptom" TEXT,
    "diagnosis" TEXT,
    "confidence" TEXT,
    "recommendationJson" TEXT,
    "photoUrl" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantHealthEvent_pkey" PRIMARY KEY ("id")
);

-- ─── Indeksy ───
CREATE UNIQUE INDEX "PlantSpeciesCatalog_key_key" ON "PlantSpeciesCatalog"("key");
CREATE INDEX "PlantSpeciesCatalog_category_idx" ON "PlantSpeciesCatalog"("category");

CREATE INDEX "PlantSpecies_workspaceId_idx" ON "PlantSpecies"("workspaceId");
CREATE UNIQUE INDEX "PlantSpecies_workspaceId_nameLatin_key" ON "PlantSpecies"("workspaceId", "nameLatin");

CREATE INDEX "PlantSpace_workspaceId_idx" ON "PlantSpace"("workspaceId");

CREATE INDEX "PlantPlace_spaceId_idx" ON "PlantPlace"("spaceId");

CREATE INDEX "Plant_workspaceId_status_idx" ON "Plant"("workspaceId", "status");
CREATE INDEX "Plant_spaceId_idx" ON "Plant"("spaceId");
CREATE INDEX "Plant_placeId_idx" ON "Plant"("placeId");
CREATE INDEX "Plant_speciesId_idx" ON "Plant"("speciesId");
CREATE INDEX "Plant_parentId_idx" ON "Plant"("parentId");

CREATE INDEX "PlantCareTask_spaceId_idx" ON "PlantCareTask"("spaceId");
CREATE INDEX "PlantCareTask_plantId_idx" ON "PlantCareTask"("plantId");
CREATE INDEX "PlantCareTask_placeId_idx" ON "PlantCareTask"("placeId");
CREATE INDEX "PlantCareTask_nextDueAt_idx" ON "PlantCareTask"("nextDueAt");

CREATE INDEX "PlantCareEvent_spaceId_occurredAt_idx" ON "PlantCareEvent"("spaceId", "occurredAt");
CREATE INDEX "PlantCareEvent_plantId_idx" ON "PlantCareEvent"("plantId");
CREATE INDEX "PlantCareEvent_placeId_idx" ON "PlantCareEvent"("placeId");
CREATE INDEX "PlantCareEvent_taskId_idx" ON "PlantCareEvent"("taskId");

CREATE INDEX "PlantJournalEntry_plantId_occurredAt_idx" ON "PlantJournalEntry"("plantId", "occurredAt");

CREATE INDEX "PlantMeasurement_plantId_measuredAt_idx" ON "PlantMeasurement"("plantId", "measuredAt");

CREATE INDEX "PlantHealthEvent_plantId_occurredAt_idx" ON "PlantHealthEvent"("plantId", "occurredAt");

-- ─── Klucze obce ───
ALTER TABLE "PlantSpecies" ADD CONSTRAINT "PlantSpecies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlantSpace" ADD CONSTRAINT "PlantSpace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlantPlace" ADD CONSTRAINT "PlantPlace_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "PlantSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Plant" ADD CONSTRAINT "Plant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "PlantSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "PlantPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "PlantSpecies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Rodowód: skasowanie rośliny-matki NIE kasuje sadzonek. Kaskada byłaby tu utratą danych —
-- sadzonka jest osobnym bytem, który żyje własnym życiem (ten sam wybór co `Pet.sireId`).
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlantCareTask" ADD CONSTRAINT "PlantCareTask_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "PlantSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantCareTask" ADD CONSTRAINT "PlantCareTask_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantCareTask" ADD CONSTRAINT "PlantCareTask_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "PlantPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Zdarzenia przeżywają skasowanie rośliny i zadania: to jest HISTORIA MIEJSCA, z której liczy się
-- płodozmian (AC-26), a w trybie zawodowym — ewidencja o wymogu ustawowym. Kaskada po roślinie
-- kasowałaby zapisy, których prawo każe nie kasować.
ALTER TABLE "PlantCareEvent" ADD CONSTRAINT "PlantCareEvent_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "PlantSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantCareEvent" ADD CONSTRAINT "PlantCareEvent_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlantCareEvent" ADD CONSTRAINT "PlantCareEvent_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "PlantPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlantCareEvent" ADD CONSTRAINT "PlantCareEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PlantCareTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlantJournalEntry" ADD CONSTRAINT "PlantJournalEntry_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlantMeasurement" ADD CONSTRAINT "PlantMeasurement_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlantHealthEvent" ADD CONSTRAINT "PlantHealthEvent_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Uprawnienie modułu (C-22, wzorzec 0262_modul_youtube) ────────────────────
INSERT INTO "Permission" ("id", "slug", "name", "description") VALUES
  (gen_random_uuid()::text, 'module.rosliny', 'Rośliny', 'Dostęp do modułu Rośliny — przestrzenie roślinne, opieka, dziennik, katalog gatunków i ewidencja zabiegów')
ON CONFLICT ("slug") DO NOTHING;

-- ADMIN dostaje uprawnienie od razu; pozostałe role nadaje się w /admin/access.
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'ADMIN', p."id"
FROM "Permission" p WHERE p."slug" = 'module.rosliny'
ON CONFLICT ("role", "permissionId") DO NOTHING;
