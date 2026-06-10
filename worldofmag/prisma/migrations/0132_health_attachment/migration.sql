-- Z1: repozytorium wyników — załączniki do wizyty/badania (PDF/zdjęcia).
CREATE TABLE "HealthAttachment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HealthAttachment_eventId_idx" ON "HealthAttachment"("eventId");
ALTER TABLE "HealthAttachment" ADD CONSTRAINT "HealthAttachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HealthEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
