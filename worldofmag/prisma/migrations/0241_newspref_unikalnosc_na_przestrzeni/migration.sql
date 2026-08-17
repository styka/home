-- 078 (zadanie 11, etap 4 część 2) — UNIKALNOŚĆ `NewsPref` PRZENOSI SIĘ NA PRZESTRZEŃ.
--
-- PO CO. `NewsPref.ownerId` ma `UNIQUE` i to ta unikalność trzyma regułę „jedna preferencja
-- Wiadomości na konto". Dopóki istnieje, każdy odczyt tej tabeli musi iść przez kolumnę
-- własnościową: `findUnique`/`upsert` przyjmują wyłącznie klucz UNIKALNY, więc samo przepisanie
-- filtra na `workspaceId` nawet się nie kompiluje. To jedyna rzecz, przez którą ta tabela nadal
-- zależy od `ownerId`.
--
-- DLACZEGO PRZENIESIENIE JEST TU ŚCISŁE, a nie „w przybliżeniu takie samo". `NewsPref` nie zna
-- współwłasności zespołowej — kolumny `ownerTeamId` nie ma wcale. Dla takiej tabeli równoważność
-- `ownerId = X` ⟺ „przestrzeń OSOBISTA użytkownika X" jest dokładna (lustro z zadania 9 trzyma
-- dokładnie jedną przestrzeń osobistą na konto — niezmiennik z unikalnego indeksu na
-- `Workspace.personalUserId`). Zatem „jedna preferencja na konto" = „jedna na przestrzeń".
--
-- To NIE jest ten sam przypadek co `Tag` i `ItemHistory` z `workspace-nullable.json`. Tam
-- unikalność obejmuje rekordy SYSTEMOWE (`ownerId IS NULL`), a w PostgreSQL `NULL <> NULL`, więc
-- indeks na nullowalnej kolumnie przestałby chronić dokładnie te wiersze, dla których powstał.
-- Tutaj `workspaceId` jest NOT NULL (migracja 0235), więc pułapki nie ma.
--
-- KONTROLA PRZED ZMIANĄ. `CREATE UNIQUE INDEX` sam odrzuciłby duplikaty, ale komunikat Postgresa
-- („could not create unique index") nie mówi, CO jest nie tak. Skoro migracja i tak ma się zatrzymać,
-- niech zatrzyma się z informacją, która wystarcza do naprawy — i niech zrobi to PRZED zdjęciem
-- starego indeksu, żeby nieudana migracja nie zostawiała tabeli bez żadnej ochrony unikalności.

DO $$
DECLARE
  duplikaty integer;
BEGIN
  SELECT COUNT(*) INTO duplikaty FROM (
    SELECT "workspaceId" FROM "NewsPref" GROUP BY "workspaceId" HAVING COUNT(*) > 1
  ) d;

  IF duplikaty > 0 THEN
    RAISE EXCEPTION
      'omnia: % przestrzeni ma po kilka wierszy NewsPref, więc unikalności nie da się przenieść z ownerId na workspaceId. Znaczy to, że lustro przestrzeni jest rozjechane (dwa konta wskazują tę samą przestrzeń) albo backfill 0227 przypisał wiersze błędnie. Napraw dane przed ponowną migracją.',
      duplikaty;
  END IF;
END $$;

-- Kolejność: najpierw nowa ochrona, potem zdjęcie starej. Odwrotna zostawiłaby okno, w którym
-- tabela nie ma żadnej unikalności.
CREATE UNIQUE INDEX "NewsPref_workspaceId_key" ON "NewsPref"("workspaceId");

DROP INDEX IF EXISTS "NewsPref_workspaceId_idx";

-- `ownerId UNIQUE` zostaje do chwili usunięcia kolumny — w fazie podwójnego zapisu obie reguły
-- mają obowiązywać, bo obie kolumny są nadal zapisywane.
