-- 087 (zadanie 32, Faza 6) — METRYKI OPERACJI.
--
-- Rozdz. 11.7 wymienia siedem metryk na `/admin/health`. Cztery z nich (głębokość kolejki, wiek
-- najstarszego zadania, zdarzenia niedostarczone, koszt AI) da się policzyć z tabel, które już są.
-- Trzy — czas operacji z percentylem 95, błędy per moduł i KONFLIKTY EDYCJI per moduł — wymagają
-- zapamiętania czegoś, czego dziś nikt nie zapisuje.
--
-- **Dlaczego kubełki, a nie wiersz na operację.** Wiersz na operację to druga tabela rosnąca
-- w tempie ruchu (obok `AiCall`) i podwojenie zapisów przy każdej akcji. Tutaj agregat jest
-- **godzinowy**: instancja zlicza w pamięci i dosypuje co minutę jednym `UPDATE` na kubełek.
--
-- **Dlaczego histogram, a nie średnia.** Percentyla 95 nie da się policzyć ze średniej ani odtworzyć
-- z sumy — a to właśnie ona odpowiada na pytanie „czy komuś jest wolno", podczas gdy średnia
-- odpowiada „czy większości jest dobrze". Stąd stałe przedziały czasu: p95 wychodzi z nich
-- z dokładnością do przedziału, co w zupełności wystarcza do rozpoznania regresu.

CREATE TABLE "OperationMetric" (
  "id"            TEXT NOT NULL,
  -- Kubełek godzinowy w UTC, format `YYYY-MM-DDTHH`. Tekst, nie znacznik czasu: klucz naturalny
  -- i czytelny w `psql`, a porównania zakresowe na tekście ISO działają leksykograficznie.
  "bucket"        TEXT NOT NULL,
  "module"        TEXT NOT NULL,
  "action"        TEXT NOT NULL,
  "count"         INTEGER NOT NULL DEFAULT 0,
  "errors"        INTEGER NOT NULL DEFAULT 0,
  -- Konflikt edycji (`ConflictError` z zadania 15) — rosnąca liczba w JEDNYM module to sygnał,
  -- że akurat tam potrzebne jest współredagowanie (rozdz. 8.6). Bez tej metryki decyzja o CRDT
  -- byłaby zgadywaniem.
  "conflicts"     INTEGER NOT NULL DEFAULT 0,
  "durationSumMs" BIGINT  NOT NULL DEFAULT 0,
  "durationMaxMs" INTEGER NOT NULL DEFAULT 0,
  -- Histogram: liczba operacji, które zmieściły się w danym progu (ms). Ostatni przedział jest
  -- otwarty w górę.
  "b50"           INTEGER NOT NULL DEFAULT 0,
  "b100"          INTEGER NOT NULL DEFAULT 0,
  "b250"          INTEGER NOT NULL DEFAULT 0,
  "b500"          INTEGER NOT NULL DEFAULT 0,
  "b1000"         INTEGER NOT NULL DEFAULT 0,
  "b2500"         INTEGER NOT NULL DEFAULT 0,
  "b5000"         INTEGER NOT NULL DEFAULT 0,
  "b10000"        INTEGER NOT NULL DEFAULT 0,
  "bInf"          INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OperationMetric_pkey" PRIMARY KEY ("id")
);

-- Dosypywanie idzie `ON CONFLICT` po tej trójce, więc musi być unikalna.
CREATE UNIQUE INDEX "OperationMetric_bucket_module_action_key"
  ON "OperationMetric" ("bucket", "module", "action");

-- Odczyt na `/admin/health` to „ostatnie N godzin", czyli zakres po kubełku.
CREATE INDEX "OperationMetric_bucket_idx" ON "OperationMetric" ("bucket");
