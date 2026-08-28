-- 111 — dwie niezależne poprawki w jednej migracji, obie ADDYTYWNE (nowa tabela + nowe kolumny
-- z wartościami domyślnymi), więc stary kod działa na nowym schemacie i wycofanie feature'a nie
-- wymaga cofania migracji.
--
-- ─── 1. STRESZCZENIE PAMIĘTANE OSOBNO DLA KAŻDEGO POZIOMU ──────────────────────────────────────
--
-- Zgłoszenie właściciela: „jak streszczę na poziom krótki a następnie znowu na poziom średni to
-- jest wygenerowane streszczenie około dwa razy dłuższe, mimo że na początku miało być średnie".
--
-- Przyczyna była podwójna i obie połowy siedzą w kodzie, nie w danych: (a) przebieg odświeżania
-- streszcza WSADOWO ze skrótu z kanału RSS, a zmiana poziomu DOCIĄGA pełny artykuł — ten sam
-- poziom przy kilkakrotnie większym materiale daje dłuższy tekst; (b) `resummarizeItem` w ogóle
-- nie sprawdzało, czy dany poziom już kiedyś powstał, więc każde przełączenie było nową, płatną
-- generacją. Ta tabela usuwa (b): powrót na poziom, który już był, wraca do TEGO SAMEGO tekstu.
--
-- Dlaczego osobna tabela, a nie trzy kolumny na `NewsItem`: każdy poziom ma własny czas powstania
-- i własną informację o tym, z czego powstał (pełny artykuł czy sam skrót z kanału). Trzy komplety
-- kolumn `summaryShort/summaryShortAt/summaryShortFromArticle` to dziewięć kolumn na to samo.
--
-- Dlaczego BEZ `workspaceId` i bez kolumn właściciela: `NewsItem` też ich nie ma — własność płynie
-- przez `NewsTopic.workspaceId`. Dołożenie tu nullowalnego `workspaceId` uruchomiłoby wymóg
-- wyzwalacza z `check:workspace-fill` dla własności, której ta tabela nie niesie.
CREATE TABLE IF NOT EXISTS "NewsItemSummary" (
    "id"          TEXT NOT NULL,
    "itemId"      TEXT NOT NULL,
    -- "short" | "medium" | "long" — kolumna tekstowa + zawężający typ TypeScript, nigdy enum (C-12).
    "length"      TEXT NOT NULL,
    "text"        TEXT NOT NULL,
    -- Czy powstało z pełnej treści artykułu, czy tylko ze skrótu z kanału. To jest jedyne miejsce,
    -- w którym widać, DLACZEGO dwa poziomy tej samej pozycji mogą różnić się szczegółowością.
    "fromArticle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsItemSummary_pkey" PRIMARY KEY ("id")
);

-- Unikat jest tu regułą, nie optymalizacją: jedna pozycja ma DOKŁADNIE jedno streszczenie na
-- poziom. Bez niego dwa równoległe ponowienia zapisałyby dwa wiersze i „powrót do tego samego
-- tekstu" przestałby być jednoznaczny.
CREATE UNIQUE INDEX IF NOT EXISTS "NewsItemSummary_itemId_length_key"
    ON "NewsItemSummary" ("itemId", "length");
CREATE INDEX IF NOT EXISTS "NewsItemSummary_itemId_idx" ON "NewsItemSummary" ("itemId");

DO $$
BEGIN
    ALTER TABLE "NewsItemSummary"
        ADD CONSTRAINT "NewsItemSummary_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "NewsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- PRZENIESIENIE STANU BIEŻĄCEGO. Bez tego pierwsze przełączenie poziomu po wdrożeniu zgubiłoby
-- tekst, który użytkownik właśnie czyta — i wyglądałoby dokładnie jak usterka, którą naprawiamy.
-- `summaryFailed` odsiewa pozycje, w których w `summary` leży surowy skrót z kanału, a nie
-- streszczenie: zapamiętanie go jako „streszczenia poziomu X" utrwaliłoby nieudaną generację.
-- `ON CONFLICT DO NOTHING` czyni całość idempotentną (C-14).
INSERT INTO "NewsItemSummary" ("id", "itemId", "length", "text", "fromArticle", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "summaryLength", "summary", false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "NewsItem"
WHERE "summaryFailed" = false AND length(btrim("summary")) > 0
ON CONFLICT ("itemId", "length") DO NOTHING;

-- ─── 2. AUTOMATYCZNE WNIOSKOWANIE WIEDZY O UŻYTKOWNIKU ─────────────────────────────────────────
--
-- Zgłoszenie właściciela: „myślałem że wiedza o userze będzie rosła nie tylko gdy user wprost
-- odpowie na pytania, ale także z samego wykonywania akcji w aplikacji".
--
-- Miał rację w ostrzejszej postaci, niż napisał: zadanie `user.facts` było kolejkowane z DOKŁADNIE
-- jednego miejsca w całej aplikacji — przycisku „Poszukaj hipotez". Nic nie uruchamiało go samo,
-- więc wiedza nie mogła rosnąć z korzystania.
--
-- `autoFacts` domyślnie WŁĄCZONE: automat domyślnie wyłączony nie spełniłby zgłoszenia.
-- `factsStamp` to odcisk materiału z ostatniego przebiegu — równy odcisk znaczy „nic nie przybyło",
-- więc model nie jest wołany. Bez tego pola automat płaciłby za przebieg także wtedy, gdy nie ma
-- z czego wnioskować, czyli w większości dób.
ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "autoFacts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "factsLastRunAt" TIMESTAMP(3);
ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "factsStamp" TEXT;
