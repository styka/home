-- 078 (zadanie 11, etap 4 część 2) — WYZWALACZ PRZESTAJE MILCZEĆ O ROZJEŹDZIE.
--
-- PROBLEM, KTÓRY TO ROZWIĄZUJE. Etap 4 zamienia w ~250 miejscach `data: { ownerId: user.id }` na
-- `data: { ...(await wlasnoscDoZapisu(userId, teamId)) }`. Pomyłka w tej zamianie — podanie cudzego
-- `userId`, pominięcie `teamId`, przestawienie argumentów — **nie daje czerwonego builda**. `tsc`
-- widzi dwa poprawne stringi, ekran się renderuje, testy przechodzą. Objawem jest rekord zapisany
-- w CUDZEJ przestrzeni, czyli usterka, którą zauważa się wtedy, gdy ktoś zobaczy nie swoje dane.
-- Przy 92 plikach do konwersji „będę uważał" nie jest planem.
--
-- CO SIĘ ZMIENIA. Dotąd wyzwalacz `omnia_fill_workspace` wychodził natychmiast, gdy zapis podał
-- `workspaceId` — traktował podaną wartość jako świętą. Od teraz, w fazie podwójnego zapisu, ma
-- do dyspozycji DRUGIE, niezależne źródło tej samej informacji: kolumny własnościowe. Jeśli oba
-- źródła istnieją i wskazują różne przestrzenie, zapis jest odrzucany z komunikatem mówiącym, co
-- się nie zgadza. Cicha usterka staje się głośnym błędem — dokładnie w miejscu i chwili, w której
-- powstaje, a nie trzy tygodnie później na czyimś ekranie.
--
-- DLACZEGO W BAZIE, A NIE W KODZIE. Rozszerzenie klienta Prismy omijają zapisy zagnieżdżone, surowy
-- SQL (repo go używa), seedy i skrypty — ta lekcja jest już zapisana w `check-workspace-fill.js`.
-- Wyzwalacza nie omija nic. Do tego sprawdzenie MUSI stać obok danych: porównuje podaną przestrzeń
-- z przestrzenią wyliczoną z lustra, a lustro jest w bazie.
--
-- CZEGO ŚWIADOMIE NIE ROBI:
--  * nie rusza UPDATE — wyzwalacz jest `BEFORE INSERT`. Przenoszenie zasobu między przestrzeniami
--    przy zmianie właściciela to etap 3 zadania 11 i ma własne reguły; tu byłoby to poszerzenie
--    zakresu o zachowanie, którego nikt jeszcze nie zaprojektował;
--  * nie odrzuca zapisu, gdy kolumny własnościowe są puste (pięć tabel z `workspace-nullable.json`)
--    ani gdy wskazują właściciela BEZ przestrzeni — wtedy drugiego źródła po prostu nie ma i nie ma
--    czego porównywać. Reguła z 0238 zostaje w mocy: wyzwalacz leczy brak, nie wymyśla właścicieli;
--  * nie zostaje na zawsze. Umiera razem z kolumnami własnościowymi — bo wtedy drugie źródło
--    znika i porównanie traci sens. To jest siatka na czas konwersji i tylko na ten czas.

CREATE OR REPLACE FUNCTION omnia_fill_workspace() RETURNS trigger AS $fn$
DECLARE
  wiersz     jsonb;
  wlasciciel text;
  zespol     text;
  przestrzen text;
  nazwa      text;
BEGIN
  wiersz     := to_jsonb(NEW);
  wlasciciel := wiersz->>'ownerId';
  zespol     := wiersz->>'ownerTeamId';

  -- 078: zapis PODAŁ przestrzeń. Nie ufamy jej na słowo, dopóki mamy drugie źródło.
  IF NEW."workspaceId" IS NOT NULL THEN
    IF wlasciciel IS NOT NULL THEN
      SELECT id INTO przestrzen FROM "Workspace" WHERE "personalUserId" = wlasciciel;
    ELSIF zespol IS NOT NULL THEN
      SELECT id INTO przestrzen FROM "Workspace" WHERE "teamId" = zespol;
    END IF;

    -- Porównujemy tylko wtedy, gdy kolumny własnościowe naprawdę na coś wskazują. Brak przestrzeni
    -- właściciela nie jest tu sprzecznością — jest nieobecnością drugiego źródła.
    IF przestrzen IS NOT NULL AND przestrzen <> NEW."workspaceId" THEN
      RAISE EXCEPTION
        'omnia: rozjazd przestrzeni przy zapisie do %. Kod podał workspaceId=%, ale kolumny własnościowe (ownerId=%, ownerTeamId=%) wskazują workspaceId=%. To znaczy, że miejsce zapisu przekazało do wlasnoscDoZapisu innego użytkownika lub zespół niż ten, do którego rekord należy.',
        TG_TABLE_NAME, NEW."workspaceId", COALESCE(wlasciciel, '-'), COALESCE(zespol, '-'), przestrzen
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
  END IF;

  IF wlasciciel IS NOT NULL THEN
    SELECT id INTO przestrzen FROM "Workspace" WHERE "personalUserId" = wlasciciel;

    -- Domykamy TYLKO dla konta, które naprawdę istnieje (reguła z 0238).
    IF przestrzen IS NULL AND EXISTS (SELECT 1 FROM "User" WHERE "id" = wlasciciel) THEN
      INSERT INTO "Workspace" ("id", "kind", "name", "personalUserId", "createdAt")
      VALUES (gen_random_uuid()::text, 'personal', 'Moja przestrzeń', wlasciciel, CURRENT_TIMESTAMP)
      ON CONFLICT ("personalUserId") DO NOTHING
      RETURNING id INTO przestrzen;

      IF przestrzen IS NULL THEN
        SELECT id INTO przestrzen FROM "Workspace" WHERE "personalUserId" = wlasciciel;
      END IF;

      IF przestrzen IS NOT NULL THEN
        INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "createdAt")
        VALUES (przestrzen, wlasciciel, 'owner', CURRENT_TIMESTAMP)
        ON CONFLICT ("workspaceId", "userId") DO NOTHING;
      END IF;
    END IF;

  ELSIF zespol IS NOT NULL THEN
    SELECT id INTO przestrzen FROM "Workspace" WHERE "teamId" = zespol;

    IF przestrzen IS NULL AND EXISTS (SELECT 1 FROM "Team" WHERE "id" = zespol) THEN
      SELECT "name" INTO nazwa FROM "Team" WHERE "id" = zespol;
      INSERT INTO "Workspace" ("id", "kind", "name", "teamId", "createdAt")
      VALUES (gen_random_uuid()::text, 'team', COALESCE(nazwa, 'Zespół'), zespol, CURRENT_TIMESTAMP)
      ON CONFLICT ("teamId") DO NOTHING
      RETURNING id INTO przestrzen;

      IF przestrzen IS NULL THEN
        SELECT id INTO przestrzen FROM "Workspace" WHERE "teamId" = zespol;
      END IF;

      IF przestrzen IS NOT NULL THEN
        INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "createdAt")
        SELECT przestrzen, t."ownerId", 'owner', CURRENT_TIMESTAMP FROM "Team" t WHERE t."id" = zespol
        ON CONFLICT ("workspaceId", "userId") DO NOTHING;

        INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "createdAt")
        SELECT przestrzen, tm."userId", 'member', CURRENT_TIMESTAMP
          FROM "TeamMember" tm WHERE tm."teamId" = zespol
        ON CONFLICT ("workspaceId", "userId") DO NOTHING;
      END IF;
    END IF;
  END IF;

  IF przestrzen IS NOT NULL THEN
    NEW."workspaceId" := przestrzen;
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
