-- Korekta 0236: wyzwalacz domyka przestrzeń tylko dla ISTNIEJĄCEGO właściciela.
--
-- CO SIĘ ZEPSUŁO. 0236 nauczyło `omnia_fill_workspace` tworzyć brakującą przestrzeń osobistą,
-- zamiast zostawiać NULL. Wersja z 0236 robiła to bezwarunkowo — a `ownerId` nie wszędzie jest
-- kluczem obcym do `User`. W `Job` to zwykły tekst (kolejka bywa zasilana identyfikatorem, który
-- nie odpowiada wierszowi użytkownika). Wyzwalacz próbował więc wstawić przestrzeń dla nieistniejącego
-- konta i wywracał CAŁY zapis:
--   „Foreign key constraint violated: `Workspace_personalUserId_fkey`".
--
-- Przed 0236 ten sam przypadek był nieszkodliwy: wyszukanie nic nie znajdowało i kolumna zostawała
-- pusta. Domknięcie zamieniło łagodną nieobecność w twardy błąd — czyli dokładnie ta klasa regresji,
-- przed którą 0236 miało chronić, tylko z drugiej strony.
--
-- REGUŁA: wyzwalacz LECZY brak przestrzeni realnego właściciela; nie WYMYŚLA właścicieli.
-- Gdy `ownerId` nie wskazuje istniejącego konta (albo `ownerTeamId` istniejącego zespołu),
-- zostawiamy NULL — a o tym, czy to dopuszczalne, rozstrzyga NOT NULL na danej kolumnie.
-- Tabele, w których wiersz może nie mieć właściciela, są wypisane w src/lib/db/workspace-nullable.json.

CREATE OR REPLACE FUNCTION omnia_fill_workspace() RETURNS trigger AS $fn$
DECLARE
  wiersz     jsonb;
  wlasciciel text;
  zespol     text;
  przestrzen text;
  nazwa      text;
BEGIN
  IF NEW."workspaceId" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  wiersz     := to_jsonb(NEW);
  wlasciciel := wiersz->>'ownerId';
  zespol     := wiersz->>'ownerTeamId';

  IF wlasciciel IS NOT NULL THEN
    SELECT id INTO przestrzen FROM "Workspace" WHERE "personalUserId" = wlasciciel;

    -- Domykamy TYLKO dla konta, które naprawdę istnieje.
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
