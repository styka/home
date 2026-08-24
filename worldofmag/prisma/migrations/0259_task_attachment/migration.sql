-- 099: załącznik zadania.
--
-- Powstaje dla JEDNEGO konsumenta (C-35): zrzut wskazanego elementu dołączany do zgłoszenia
-- z trybu wskazywania („robaczek"). Kształt jest kalką `NoteAttachment` / `HealthAttachment` /
-- `VehicleAttachment` — obraz trzymamy jako data URL w kolumnie `url`, tak jak w tamtych trzech.
--
-- Bez `workspaceId` i bez `ownerId`: to rekord PODRZĘDNY. Właściciela ma przez zadanie, a znika
-- razem z nim (kaskada FK) — dokładnie jak pozostałe tabele załączników.
CREATE TABLE IF NOT EXISTS "TaskAttachment" (
    "id"        TEXT NOT NULL,
    "taskId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    -- Rodzaj jako kolumna tekstowa + unia w TypeScripcie (C-12) — zero enumów Prisma.
    "kind"      TEXT NOT NULL DEFAULT 'screenshot',
    "url"       TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");

ALTER TABLE "TaskAttachment"
    ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
