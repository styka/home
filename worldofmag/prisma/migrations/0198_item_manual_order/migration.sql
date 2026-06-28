-- Z-221 (T-03): ręczna kolejność pozycji na liście zakupów (DnD), per-kategoria.
-- `order` = pozycja w obrębie kategorii; sortowanie list: order ASC, potem priority/createdAt.
-- Default 0 → wszystkie istniejące pozycje zachowują dotychczasową kolejność (priority/createdAt),
-- dopóki użytkownik świadomie nie przeciągnie pozycji (wtedy dostają jawne indeksy). Ręczna
-- kolejność NADPISUJE sort po trasie sklepu (trasa porządkuje tylko nagłówki kategorii, nie pozycje).
-- IF NOT EXISTS — idempotentnie (konwencja projektu).
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
