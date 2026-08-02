-- 041: Kontrola nad AI — kiedy generuje, ile kosztuje, co robi bez pytania.
--
-- Migracja jest W CAŁOŚCI ADDYTYWNA (dwie nowe tabele, jedna nowa kolumna z wartością domyślną,
-- idempotentny seed konfiguracji). Poprzednia wersja kodu działa na nowym schemacie, więc wycofanie
-- kodu nie wymaga kroku wstecz na bazie. To odróżnia 041 od 039 (DROP TABLE) i 040 (DROP COLUMN).

-- ─── AiSectionPref ──────────────────────────────────────────────────────────
-- Tryb odświeżania sekcji AI, per użytkownik i rodzaj sekcji.
--
-- Osobna tabela, a nie kolumny w "AssistantPref": sekcji jest dziś pięć i będzie ich przybywać z
-- każdym modułem korzystającym z modelu. Kolumna per sekcja oznaczałaby migrację przy każdym
-- dołożeniu, a wiersz — nie.
--
-- "sectionKind" trzyma te same wartości co `AiContentKind` w kodzie (weather.ideas, news.hotTopics,
-- storage.insights, pets.insights, kitchen.planWeek). "mode" to TEXT + zawężający typ TypeScript
-- (C-12) — nigdy enum Prisma.
CREATE TABLE "AiSectionPref" (
    "id"          TEXT NOT NULL,
    "ownerId"     TEXT NOT NULL,
    "sectionKind" TEXT NOT NULL,
    -- "onDemand" | "onChange" | "always"
    "mode"        TEXT NOT NULL DEFAULT 'onDemand',
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSectionPref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiSectionPref_ownerId_sectionKind_key"
    ON "AiSectionPref"("ownerId", "sectionKind");

ALTER TABLE "AiSectionPref"
    ADD CONSTRAINT "AiSectionPref_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── NewsRefreshRun ─────────────────────────────────────────────────────────
-- Trwała historia przebiegów odświeżania Wiadomości.
--
-- Nowa tabela, a nie odczyt z "Job": `cleanupOldJobs` kasuje zakończone zadania po 24 godzinach, a
-- `Job.result` i tak trzyma wyłącznie OSTATNI przebieg. Zgłoszenie mówi wprost o odczycie kosztu
-- „po fakcie", czyli o czymś, co przeżywa sprzątanie kolejki.
--
-- "usage" zapisujemy SUROWE — handler zadania nie ma sesji, więc bramka widoczności kosztu
-- (`visibleUsage`) działa przy ODCZYCIE, dokładnie tak samo jak dla `Job.result` od 039.
CREATE TABLE "NewsRefreshRun" (
    "id"            TEXT NOT NULL,
    "ownerId"       TEXT NOT NULL,
    "startedAt"     TIMESTAMP(3) NOT NULL,
    "finishedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- "done" | "failed"
    "status"        TEXT NOT NULL DEFAULT 'done',
    -- Liczby z wyniku przebiegu — pozwalają odróżnić przebiegi od siebie, a nie tylko po godzinie.
    "sources"       INTEGER NOT NULL DEFAULT 0,
    "fetched"       INTEGER NOT NULL DEFAULT 0,
    "assigned"      INTEGER NOT NULL DEFAULT 0,
    "summarized"    INTEGER NOT NULL DEFAULT 0,
    "timelineAdded" INTEGER NOT NULL DEFAULT 0,
    "usage"         TEXT,
    "error"         TEXT,

    CONSTRAINT "NewsRefreshRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NewsRefreshRun_ownerId_finishedAt_idx"
    ON "NewsRefreshRun"("ownerId", "finishedAt");

ALTER TABLE "NewsRefreshRun"
    ADD CONSTRAINT "NewsRefreshRun_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── AssistantPref.autoApprove ──────────────────────────────────────────────
-- Auto-zatwierdzanie BEZPIECZNYCH akcji asystenta. Akcje niszczące pytają zawsze, niezależnie od
-- tej wartości — dlatego domyślnie `false` jest bezpiecznym startem, a nie ostrożnością na wyrost.
ALTER TABLE "AssistantPref"
    ADD COLUMN "autoApprove" BOOLEAN NOT NULL DEFAULT false;

-- ─── Systemowe domyślne trybów sekcji AI ────────────────────────────────────
-- Domyślne dla użytkowników BEZ własnej preferencji. Trzymamy je w "Config", a nie w wierszu
-- "AiSectionPref" z pustym właścicielem, bo w PostgreSQL `NULL != NULL` — indeks unikalny
-- ("ownerId","sectionKind") NIE chroniłby wierszy systemowych przed duplikatami. Ten sam wzorzec co
-- `assistant_followups_enabled` (0214) i `ai_cost_badge_enabled` (0215).
--
-- Wartość początkowa: wszystkie sekcje „na żądanie" — to jest sedno zgłoszenia (nic nie generuje się
-- samo). Administrator może to zmienić w /admin/llm.
--
-- `id` NIE ma wartości domyślnej po stronie bazy (Prisma nadaje cuid w aplikacji), więc podajemy je
-- jawnie. `DO NOTHING`, a nie `DO UPDATE` — ponowne uruchomienie nie może cofnąć decyzji admina.
INSERT INTO "Config" ("id", "key", "value", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'ai_section_default_modes',
    '{"weather.ideas":"onDemand","news.hotTopics":"onDemand","storage.insights":"onDemand","pets.insights":"onDemand","kitchen.planWeek":"onDemand"}',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
