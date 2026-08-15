-- Zadanie 21 przebudowy — DZIENNIK ZDARZEŃ DOMENOWYCH, otwarcie Fazy 4 (rozdz. 9.4).
--
-- Rozdz. 9.1 stawia diagnozę, której dziś nic nie sygnalizuje: Omnia realizuje trzy różne rodzaje
-- integracji jednym mechanizmem — bezpośrednim wywołaniem. Reguła rozstrzygająca brzmi: brak
-- odpowiedzi ZATRZYMUJE operację → kontrakt; brak odpowiedzi ją tylko OPÓŹNIA → zdarzenie.
-- Dziś zakończenie listy zakupów księguje wydatek w Portfelu wywołaniem synchronicznym, więc
-- awaria Portfela zabiera zakupy.
--
-- CO TA MIGRACJA ROBI APLIKACJI: nic widocznego. Powstaje tabela, do której trzej producenci
-- zaczną pisać. Czytelnika NIE MA i tak ma być — publikację dowozi zadanie 22. Outbox bez
-- czytelnika jest poprawnym stanem pośrednim; odwrotna kolejność budowałaby czytelnik na źródle,
-- które może kłamać.
--
-- BEZ KLUCZY OBCYCH, świadomie — tak samo jak w `AuditLog`. Dziennik zdarzeń jest zapisem
-- historycznym: skasowanie przestrzeni albo konta nie może kaskadowo usunąć śladu, że coś się
-- wydarzyło. Cena: sprzątanie musi być jawne (zadanie 30, retencja).
--
-- DWA INDEKSY, każdy pod inne zapytanie:
--   [deliveredAt, createdAt] — worker z zadania 22 pyta „daj najstarsze niedostarczone";
--   [workspaceId, createdAt] — kanał czasu rzeczywistego z zadania 23 filtruje strumień przestrzeni.
--
-- Wycofanie: DROP TABLE "DomainEvent". Bezpieczne — nic z niej nie czyta, więc rollback samego
-- kodu (bez rollbacku migracji) zostawia pustą tabelę bez wpływu na aplikację.

CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DomainEvent_deliveredAt_createdAt_idx" ON "DomainEvent"("deliveredAt", "createdAt");
CREATE INDEX "DomainEvent_workspaceId_createdAt_idx" ON "DomainEvent"("workspaceId", "createdAt");
