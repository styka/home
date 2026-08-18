-- 080 (zadanie 25, rozdz. 9.5) — LISTA ZAKUPÓW, NA KTÓRĄ TRAFIAJĄ BRAKI Z MAGAZYNU.
--
-- Druga para reakcji międzymodułowej z rozdz. 9.5 (pierwsza — Zakupy→Portfel — weszła w 073).
-- Magazyn ogłasza `magazynowanie.stan.zmieniony`; Zakupy same decydują, czy i gdzie brak ląduje.
-- Dlatego flaga stoi na `ShoppingList`, a nie w ustawieniach Magazynu: to ZAKUPY są właścicielem
-- reguły „ta lista przyjmuje automatyczne uzupełnienia".
ALTER TABLE "ShoppingList" ADD COLUMN "autoReplenish" BOOLEAN NOT NULL DEFAULT false;

-- NAJWYŻEJ JEDNA TAKA LISTA NA PRZESTRZEŃ — niezmiennik pilnowany przez BAZĘ, nie przez kod akcji.
--
-- Powód jest ten sam, co przy wyzwalaczu z 055: akcja to jedna droga zapisu, a nie jedyna. Gdyby
-- „jedna na przestrzeń" trzymał tylko `updateMany` w akcji, dwa równoległe kliknięcia albo jeden
-- zapis surowym SQL-em zostawiłyby dwie listy oznaczone — i subskrybent zacząłby dopisywać braki
-- do przypadkowej z nich, bo `findFirst` nie ma po czym wybrać. Objaw: „braki lądują raz tu, raz
-- tam", bez żadnego błędu.
--
-- Indeks CZĘŚCIOWY (`WHERE`), bo ograniczenie dotyczy wyłącznie list oznaczonych: przestrzeń może
-- mieć dowolnie wiele list zwykłych. Prisma nie umie wyrazić indeksu warunkowego — stąd wpis
-- w `src/lib/db/schema-drift-allowed.json`.
CREATE UNIQUE INDEX "ShoppingList_autoReplenish_workspace_key"
  ON "ShoppingList" ("workspaceId")
  WHERE "autoReplenish";
