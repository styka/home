-- Zadanie 11, ETAP 4 — WYZWALACZ MUSI UMIEĆ DOMKNĄĆ PRZESTRZEŃ, a nie tylko ją odczytać.
--
-- CO SIĘ ZEPSUŁO PRZY 0235. Zaostrzenie `workspaceId` do NOT NULL odsłoniło lukę, której przy
-- kolumnie nullowalnej nie było widać. Wyzwalacz z 055 (`omnia_fill_workspace`) SZUKAŁ przestrzeni
-- w lustrze, a gdy jej nie znalazł, zostawiał NULL. Przy kolumnie nullowalnej kończyło się to
-- niewidzialną sierotą; po zaostrzeniu kończy się **odmową zapisu**. Konkretnie: użytkownik bez
-- przestrzeni osobistej nie może utworzyć NICZEGO — nie nawyku, nie listy, nie notatki.
--
-- Wyszło to na próbie `prisma.habit.create` dla świeżo utworzonego konta:
--   „Null constraint violation on the fields: (`workspaceId`)".
--
-- DLACZEGO NIE WYSTARCZY „pilnować, żeby aplikacja wołała `ensurePersonalWorkspace` przy logowaniu".
-- Bo dokładnie tym rozumowaniem odrzucono w 055 rozszerzenie klienta Prismy na rzecz wyzwalacza:
-- zapis potrafi przyjść z surowego SQL-a, z seeda, z zapisu zagnieżdżonego i z migracji danych.
-- Gwarancja oparta na tym, że KTOŚ WCZEŚNIEJ pamiętał, nie jest gwarancją — a cena pomyłki urosła
-- z „niewidoczny rekord" do „konto nie działa".
--
-- CO ROBI: gdy właścicielem jest użytkownik bez przestrzeni osobistej, wyzwalacz ją **tworzy**
-- (dokładnie taką, jaką tworzy `ensurePersonalWorkspace`: kind=personal, „Moja przestrzeń",
-- właściciel jako członek z rolą `owner`) i dopiero potem wypełnia kolumnę. Analogicznie dla
-- zespołu. Niezmiennik staje się samonaprawialny w tym jednym miejscu, przez które przechodzi
-- KAŻDY zapis.
--
-- CZEGO NIE ROBI: nie dotyka wierszy, które przestrzeń już mają (wartość podana wprost dalej
-- wygrywa), i nie zmienia zachowania dla rekordów SYSTEMOWYCH — te nie mają właściciela, więc
-- nadal wychodzą z NULL-em, a ich cztery tabele zostały świadomie nullowalne (0235).

CREATE OR REPLACE FUNCTION omnia_fill_workspace() RETURNS trigger AS $fn$
DECLARE
  wiersz     jsonb;
  wlasciciel text;
  zespol     text;
  przestrzen text;
  nazwa      text;
BEGIN
  -- Wartość podana wprost wygrywa (etap 3, testy, migracje danych).
  IF NEW."workspaceId" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- `to_jsonb(NEW)` pozwala jednej funkcji obsłużyć tabele z obiema kolumnami własności i te
  -- z samym `ownerId` — brakujący klucz to po prostu NULL, bez dynamicznego SQL-a.
  wiersz     := to_jsonb(NEW);
  wlasciciel := wiersz->>'ownerId';
  zespol     := wiersz->>'ownerTeamId';

  IF wlasciciel IS NOT NULL THEN
    SELECT id INTO przestrzen FROM "Workspace" WHERE "personalUserId" = wlasciciel;

    -- DOMKNIĘCIE: konto bez przestrzeni osobistej dostaje ją tutaj, zamiast dostać odmowę zapisu.
    -- `ON CONFLICT` zamiast sprawdzania „czy istnieje" — dwa równoległe zapisy dla tego samego
    -- konta wchodzą tu jednocześnie, a `personalUserId` jest UNIKALNE.
    IF przestrzen IS NULL THEN
      INSERT INTO "Workspace" ("id", "kind", "name", "personalUserId", "createdAt")
      VALUES (gen_random_uuid()::text, 'personal', 'Moja przestrzeń', wlasciciel, CURRENT_TIMESTAMP)
      ON CONFLICT ("personalUserId") DO NOTHING
      RETURNING id INTO przestrzen;

      -- Gdy konflikt wygrał ktoś inny, `RETURNING` nic nie zwraca — czytamy jego wiersz.
      IF przestrzen IS NULL THEN
        SELECT id INTO przestrzen FROM "Workspace" WHERE "personalUserId" = wlasciciel;
      END IF;

      -- Właściciel jako członek z rolą `owner` — tak samo jak `ensurePersonalWorkspace`.
      -- Bez tego wiersza przestrzeń istnieje, ale `getAccessContext` nie daje w niej żadnej roli
      -- (pułapka rozpoznana w 056).
      IF przestrzen IS NOT NULL THEN
        INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "createdAt")
        VALUES (przestrzen, wlasciciel, 'owner', CURRENT_TIMESTAMP)
        ON CONFLICT ("workspaceId", "userId") DO NOTHING;
      END IF;
    END IF;

  ELSIF zespol IS NOT NULL THEN
    SELECT id INTO przestrzen FROM "Workspace" WHERE "teamId" = zespol;

    IF przestrzen IS NULL THEN
      SELECT "name" INTO nazwa FROM "Team" WHERE "id" = zespol;
      INSERT INTO "Workspace" ("id", "kind", "name", "teamId", "createdAt")
      VALUES (gen_random_uuid()::text, 'team', COALESCE(nazwa, 'Zespół'), zespol, CURRENT_TIMESTAMP)
      ON CONFLICT ("teamId") DO NOTHING
      RETURNING id INTO przestrzen;

      IF przestrzen IS NULL THEN
        SELECT id INTO przestrzen FROM "Workspace" WHERE "teamId" = zespol;
      END IF;

      -- Skład zespołu przenosimy w całości — inaczej członkowie widzieliby zasób, w którym nie
      -- mają roli. Rolę `owner` dostaje właściciel zespołu, reszta zgodnie z `TeamMember`.
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
