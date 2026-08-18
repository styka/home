-- 081 (zadanie 26, Faza 5) — WSPÓŁDZIELONY RATE-LIMIT.
--
-- Zastępuje `Map` w pamięci procesu (`platform/ai/rateLimit.ts`). Rozdz. 11.2: „przenieś na Redis
-- albo tabelę z atomowym INSERT … ON CONFLICT DO UPDATE". Wybrana jest tabela — Redisa w tym
-- wdrożeniu nie ma, a dokładanie usługi dla dwóch liczników byłoby nowym elementem do utrzymania
-- (i nowym trybem awarii: limiter, który przestaje działać, gdy padnie cache).
--
-- Dwa nośniki, bo pilnują dwóch RÓŻNYCH rzeczy:
--   * `RateLimitBucket` — ile ŻĄDAŃ w oknie czasu. Licznik rośnie, okno przesuwa się skokowo.
--   * `RateLimitLease`  — ile operacji trwa TERAZ. Nie licznik, tylko SLOTY z terminem ważności.

CREATE TABLE "RateLimitBucket" (
  "key"     TEXT NOT NULL,
  "count"   INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- Sprzątanie po wygasłych oknach (zadanie okresowe) chodzi po terminie, nie po kluczu.
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket" ("resetAt");

-- Klucz główny to (klucz, NUMER SLOTU), a nie identyfikator dzierżawy — i to jest cała sztuczka.
-- Zajęcie slotu jest wtedy jednym `INSERT … ON CONFLICT DO UPDATE … WHERE wygasł`, czyli operacją
-- atomową na poziomie wiersza. Wariant „policz aktywne, wstaw jeśli mniej niż N" wymagałby blokady
-- doradczej albo poziomu izolacji SERIALIZABLE: dwie równoległe próby widzą ten sam stan i obie
-- przechodzą. Tutaj serializację robi sam indeks unikalny.
--
-- `holder` jest po to, żeby zwolnienie dzierżawy nie mogło zwolnić CUDZEJ: gdy nasza dzierżawa
-- wygaśnie i slot przejmie ktoś inny, nasze `finally` trafia w warunek `holder = <nasz>` i nie
-- kasuje niczego.
CREATE TABLE "RateLimitLease" (
  "key"       TEXT NOT NULL,
  "slot"      INTEGER NOT NULL,
  "holder"    TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitLease_pkey" PRIMARY KEY ("key", "slot")
);

CREATE INDEX "RateLimitLease_expiresAt_idx" ON "RateLimitLease" ("expiresAt");
