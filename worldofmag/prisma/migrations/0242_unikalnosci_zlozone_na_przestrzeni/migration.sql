-- 078 (zadanie 11, etap 4 część 2) — UNIKALNOŚCI ZŁOŻONE PRZENOSZĄ SIĘ NA PRZESTRZEŃ.
--
-- PO CO. Osiem tabel trzyma regułę „jeden taki rekord na właściciela" indeksem `UNIQUE(ownerId, …)`.
-- Dopóki te indeksy istnieją, kod MUSI czytać kolumnę własnościową: `findUnique` i `upsert`
-- przyjmują wyłącznie klucz UNIKALNY, więc przepisanie filtra na `workspaceId` nie kompiluje się
-- wcale (tak samo jak w `NewsPref`/0241). To one blokują resztę konwersji odczytów.
--
-- DLACZEGO PRZENIESIENIE JEST TU ŚCISŁE. Wszystkie osiem tabel to tabele BEZ współwłasności
-- zespołowej — kolumny `ownerTeamId` nie mają wcale. Dla takiej tabeli równoważność
-- `ownerId = X` ⟺ „przestrzeń OSOBISTA użytkownika X" jest dokładna: lustro z zadania 9 trzyma
-- dokładnie jedną przestrzeń osobistą na konto (niezmiennik z unikalnego indeksu na
-- `Workspace.personalUserId`). Zatem „jeden rekord na konto" = „jeden na przestrzeń".
--
-- CZEGO TA MIGRACJA NIE RUSZA i dlaczego to nie jest niedokończona robota: `Tag` i `ItemHistory`
-- też mają `UNIQUE(ownerId, name)`, ale zostają. Ich unikalność obejmuje rekordy SYSTEMOWE
-- (`ownerId IS NULL`), a `workspaceId` jest tam NULLOWALNE — w PostgreSQL `NULL <> NULL`, więc
-- indeks przeniesiony na nullowalną kolumnę przestałby chronić dokładnie te wiersze, dla których
-- powstał: dwa systemowe tagi „praca" mogłyby współistnieć i nikt by tego nie zauważył. Pełne
-- uzasadnienie i kryterium („wiersz może nie mieć właściciela") są w
-- `src/lib/db/workspace-nullable.json`, pilnowane bramką `check:workspace-nullable`.
-- Na ośmiu tabelach z tej migracji `workspaceId` jest NOT NULL (0235), więc pułapki nie ma.
--
-- KONTROLA PRZED ZMIANĄ. `CREATE UNIQUE INDEX` sam odrzuciłby duplikaty, ale komunikat Postgresa
-- nie mówi, CO jest nie tak ani w której tabeli. Skoro migracja i tak ma się zatrzymać, niech
-- zatrzyma się z informacją wystarczającą do naprawy — i PRZED zdjęciem starych indeksów, żeby
-- nieudana migracja nie zostawiła żadnej tabeli bez ochrony unikalności.


DO $$
DECLARE
  duplikaty integer;
BEGIN

  SELECT COUNT(*) INTO duplikaty FROM (
    SELECT 1 FROM "FavoriteView" GROUP BY "workspaceId", "path" HAVING COUNT(*) > 1
  ) d;
  IF duplikaty > 0 THEN
    RAISE EXCEPTION 'omnia: FavoriteView ma % zduplikowanych par (workspaceId, path), wiec unikalnosci nie da sie przeniesc z ownerId na workspaceId. Znaczy to, ze lustro przestrzeni jest rozjechane (dwa konta wskazuja te sama przestrzen) albo backfill 0227 przypisal wiersze blednie. Napraw dane przed ponowna migracja.', duplikaty;
  END IF;

  SELECT COUNT(*) INTO duplikaty FROM (
    SELECT 1 FROM "NewsSource" GROUP BY "workspaceId", "key" HAVING COUNT(*) > 1
  ) d;
  IF duplikaty > 0 THEN
    RAISE EXCEPTION 'omnia: NewsSource ma % zduplikowanych par (workspaceId, key), wiec unikalnosci nie da sie przeniesc z ownerId na workspaceId. Znaczy to, ze lustro przestrzeni jest rozjechane (dwa konta wskazuja te sama przestrzen) albo backfill 0227 przypisal wiersze blednie. Napraw dane przed ponowna migracja.', duplikaty;
  END IF;

  SELECT COUNT(*) INTO duplikaty FROM (
    SELECT 1 FROM "NewsArticle" GROUP BY "workspaceId", "sourceId", "url" HAVING COUNT(*) > 1
  ) d;
  IF duplikaty > 0 THEN
    RAISE EXCEPTION 'omnia: NewsArticle ma % zduplikowanych par (workspaceId, sourceId, url), wiec unikalnosci nie da sie przeniesc z ownerId na workspaceId. Znaczy to, ze lustro przestrzeni jest rozjechane (dwa konta wskazuja te sama przestrzen) albo backfill 0227 przypisal wiersze blednie. Napraw dane przed ponowna migracja.', duplikaty;
  END IF;

  SELECT COUNT(*) INTO duplikaty FROM (
    SELECT 1 FROM "NewsHiddenTopic" GROUP BY "workspaceId", "fingerprint" HAVING COUNT(*) > 1
  ) d;
  IF duplikaty > 0 THEN
    RAISE EXCEPTION 'omnia: NewsHiddenTopic ma % zduplikowanych par (workspaceId, fingerprint), wiec unikalnosci nie da sie przeniesc z ownerId na workspaceId. Znaczy to, ze lustro przestrzeni jest rozjechane (dwa konta wskazuja te sama przestrzen) albo backfill 0227 przypisal wiersze blednie. Napraw dane przed ponowna migracja.', duplikaty;
  END IF;

  SELECT COUNT(*) INTO duplikaty FROM (
    SELECT 1 FROM "UserFact" GROUP BY "workspaceId", "fingerprint" HAVING COUNT(*) > 1
  ) d;
  IF duplikaty > 0 THEN
    RAISE EXCEPTION 'omnia: UserFact ma % zduplikowanych par (workspaceId, fingerprint), wiec unikalnosci nie da sie przeniesc z ownerId na workspaceId. Znaczy to, ze lustro przestrzeni jest rozjechane (dwa konta wskazuja te sama przestrzen) albo backfill 0227 przypisal wiersze blednie. Napraw dane przed ponowna migracja.', duplikaty;
  END IF;

  SELECT COUNT(*) INTO duplikaty FROM (
    SELECT 1 FROM "WeatherIdea" GROUP BY "workspaceId", "fingerprint" HAVING COUNT(*) > 1
  ) d;
  IF duplikaty > 0 THEN
    RAISE EXCEPTION 'omnia: WeatherIdea ma % zduplikowanych par (workspaceId, fingerprint), wiec unikalnosci nie da sie przeniesc z ownerId na workspaceId. Znaczy to, ze lustro przestrzeni jest rozjechane (dwa konta wskazuja te sama przestrzen) albo backfill 0227 przypisal wiersze blednie. Napraw dane przed ponowna migracja.', duplikaty;
  END IF;

  SELECT COUNT(*) INTO duplikaty FROM (
    SELECT 1 FROM "AiContent" GROUP BY "workspaceId", "kind", "scopeKey" HAVING COUNT(*) > 1
  ) d;
  IF duplikaty > 0 THEN
    RAISE EXCEPTION 'omnia: AiContent ma % zduplikowanych par (workspaceId, kind, scopeKey), wiec unikalnosci nie da sie przeniesc z ownerId na workspaceId. Znaczy to, ze lustro przestrzeni jest rozjechane (dwa konta wskazuja te sama przestrzen) albo backfill 0227 przypisal wiersze blednie. Napraw dane przed ponowna migracja.', duplikaty;
  END IF;

  SELECT COUNT(*) INTO duplikaty FROM (
    SELECT 1 FROM "AiSectionPref" GROUP BY "workspaceId", "sectionKind" HAVING COUNT(*) > 1
  ) d;
  IF duplikaty > 0 THEN
    RAISE EXCEPTION 'omnia: AiSectionPref ma % zduplikowanych par (workspaceId, sectionKind), wiec unikalnosci nie da sie przeniesc z ownerId na workspaceId. Znaczy to, ze lustro przestrzeni jest rozjechane (dwa konta wskazuja te sama przestrzen) albo backfill 0227 przypisal wiersze blednie. Napraw dane przed ponowna migracja.', duplikaty;
  END IF;

END $$;


-- Kolejność: najpierw nowa ochrona, potem zdjęcie starej.

CREATE UNIQUE INDEX "FavoriteView_workspaceId_path_key" ON "FavoriteView"("workspaceId", "path");
CREATE UNIQUE INDEX "NewsSource_workspaceId_key_key" ON "NewsSource"("workspaceId", "key");
CREATE UNIQUE INDEX "NewsArticle_workspaceId_sourceId_url_key" ON "NewsArticle"("workspaceId", "sourceId", "url");
CREATE UNIQUE INDEX "NewsHiddenTopic_workspaceId_fingerprint_key" ON "NewsHiddenTopic"("workspaceId", "fingerprint");
CREATE UNIQUE INDEX "UserFact_workspaceId_fingerprint_key" ON "UserFact"("workspaceId", "fingerprint");
CREATE UNIQUE INDEX "WeatherIdea_workspaceId_fingerprint_key" ON "WeatherIdea"("workspaceId", "fingerprint");
CREATE UNIQUE INDEX "AiContent_workspaceId_kind_scopeKey_key" ON "AiContent"("workspaceId", "kind", "scopeKey");
CREATE UNIQUE INDEX "AiSectionPref_workspaceId_sectionKind_key" ON "AiSectionPref"("workspaceId", "sectionKind");

DROP INDEX IF EXISTS "FavoriteView_ownerId_path_key";
DROP INDEX IF EXISTS "NewsSource_ownerId_key_key";
DROP INDEX IF EXISTS "NewsArticle_ownerId_sourceId_url_key";
DROP INDEX IF EXISTS "NewsHiddenTopic_ownerId_fingerprint_key";
DROP INDEX IF EXISTS "UserFact_ownerId_fingerprint_key";
DROP INDEX IF EXISTS "WeatherIdea_ownerId_fingerprint_key";
DROP INDEX IF EXISTS "AiContent_ownerId_kind_scopeKey_key";
DROP INDEX IF EXISTS "AiSectionPref_ownerId_sectionKind_key";

-- Kolumna `ownerId` zostaje do chwili `DROP COLUMN`; w fazie podwójnego zapisu jest nadal
-- wypełniana, ale przestaje być nośnikiem unikalności.
