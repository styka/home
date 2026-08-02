-- 042: Ulubione widoki — prywatne zakładki nawigacyjne użytkownika.
--
-- Model celowo BEZ "ownerTeamId": to nie jest zasób współdzielony (C-21 dotyczy zasobów),
-- tylko preferencja użytkownika — dokładnie jak "UserMenuPref" i "DashboardPref", które
-- też mają samo powiązanie z kontem.
--
-- Unikalność [ownerId, path] gwarantuje, że ponowny zapis tego samego adresu nie tworzy
-- duplikatu (kryterium AC-9) — na poziomie bazy, a nie tylko sprawdzenia w kodzie.
CREATE TABLE IF NOT EXISTS "FavoriteView" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "path"      TEXT NOT NULL,
    "icon"      TEXT NOT NULL DEFAULT '⭐',
    "color"     TEXT,
    "order"     INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoriteView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FavoriteView_ownerId_path_key" ON "FavoriteView"("ownerId", "path");
CREATE INDEX IF NOT EXISTS "FavoriteView_ownerId_order_idx" ON "FavoriteView"("ownerId", "order");

-- "ADD CONSTRAINT" nie ma wariantu IF NOT EXISTS — wykonywane raz, razem z CREATE TABLE.
ALTER TABLE "FavoriteView"
  ADD CONSTRAINT "FavoriteView_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
