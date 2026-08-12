-- Zadanie 11 przebudowy, ETAP 2 z CZTERECH — `workspaceId` UTRZYMYWANY dla nowych rekordów.
--
-- Rozdz. 8.10 podaje kolejność, której nie wolno skracać:
--   (a) dodać kolumnę NULLABLE + backfill   ← migracja 0227
--   (b) utrzymywać ją dla nowych rekordów   ← TA MIGRACJA
--   (c) przełączyć zapytania                ← etap 3, osobny przebieg
--   (d) uczynić wymaganą                    ← etap 4, osobny przebieg
-- „Nigdy w jednym kroku."
--
-- CO ROZWIĄZUJE: po 0227 kolumna była kompletna wobec danych z chwili migracji i NIEkompletna wobec
-- przyszłych — rekord utworzony później dostawał NULL, bo nic tej kolumny nie ustawiało. Dług rósł
-- sam, a etap 3 (przełączenie odczytów) po prostu by tych rekordów NIE ZOBACZYŁ.
--
-- DLACZEGO WYZWALACZ, A NIE KOD W ŚCIEŻKACH ZAPISU: własność ustawiają 224 wywołania
-- `create`/`createMany`/`upsert` w 75 plikach. Dopisanie kolumny w każdym z nich miałoby jedno
-- sprawdzenie — kompilator — a kompilator NIE WIDZI BRAKU pola opcjonalnego. Rozszerzenie klienta
-- Prismy wygląda na „jedno miejsce", ale omijają je zapisy zagnieżdżone, surowy SQL (repo go używa),
-- seedy i skrypty. Wyzwalacz obejmuje KAŻDĄ ścieżkę zapisu — pominięcia nie da się popełnić.
--
-- REGUŁA JEST TA SAMA CO W BACKFILLU 0227 i ta sama, co w `resolveRole`
-- (`platform/sharing/access.ts`): `ownerId` ma PIERWSZEŃSTWO przed `ownerTeamId`.
--
-- CZEGO WYZWALACZ NIE ROBI, ŚWIADOMIE:
--   · nie działa na UPDATE — przeniesienie zasobu między przestrzeniami przy zmianie właściciela to
--     operacja etapu 3; dziś zmieniałaby dane, których nikt nie czyta;
--   · nie nadpisuje wartości podanej wprost — etap 3 i testy muszą móc ustawić przestrzeń same;
--   · nie wywraca zapisu, gdy właściciel nie ma przestrzeni (konto w trakcie usuwania) — zostawia
--     NULL. Zapis użytkownika jest ważniejszy niż kompletność kolumny, której nikt jeszcze nie czyta.
--
-- KIEDY TO ZNIKA: w etapie 4, razem z kolumnami `ownerId`/`ownerTeamId`, z których wywodzi wartość.
-- Wyzwalacz jest urządzeniem PRZEJŚCIOWYM, nie docelowym elementem architektury.
--
-- Wycofanie: DROP TRIGGER na objętych tabelach + DROP FUNCTION omnia_fill_workspace().
-- Bezobjawowe — nic z kolumny nie czyta.

CREATE OR REPLACE FUNCTION omnia_fill_workspace() RETURNS trigger AS $omnia$
DECLARE
  wiersz     jsonb;
  wlasciciel text;
  zespol     text;
  przestrzen text;
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
  ELSIF zespol IS NOT NULL THEN
    SELECT id INTO przestrzen FROM "Workspace" WHERE "teamId" = zespol;
  END IF;

  IF przestrzen IS NOT NULL THEN
    NEW."workspaceId" := przestrzen;
  END IF;

  RETURN NEW;
END;
$omnia$ LANGUAGE plpgsql;

-- ═══ WYZWALACZE — jawna lista 45 tabel objętych migracją 0227 ═══
--
-- Lista jest WYPISANA, a nie czytana z `information_schema`: ma być widoczna w przeglądzie zmian
-- i porównywalna ze schematem przez bramkę `check:workspace-fill`. Nazwy TABEL, nie modeli —
-- `ProjectGroup` jest zmapowany na `TaskView` (pułapka, na której padł backfill w 0227).

DO $petla$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'AiContent',
    'AiSectionPref',
    'Budget',
    'Contact',
    'Cookbook',
    'FavoriteView',
    'FinanceGoal',
    'Habit',
    'HealthEvent',
    'ItemHistory',
    'Job',
    'LanguageDeck',
    'MealPlanEntry',
    'MedicationSchedule',
    'NewsArticle',
    'NewsHiddenTopic',
    'NewsPref',
    'NewsRefreshRun',
    'NewsSource',
    'NewsTopic',
    'Note',
    'NoteGroup',
    'PantryItem',
    'Pet',
    'PetBreedingPair',
    'PetEnclosure',
    'PetSale',
    'Recipe',
    'ShoppingList',
    'Skin',
    'StorageDocument',
    'StorageItem',
    'StoragePurchaseOrder',
    'StorageSupplier',
    'Store',
    'Tag',
    'TaskProject',
    'TaskView',
    'UserFact',
    'Vehicle',
    'WalletElement',
    'WeatherIdea',
    'WeatherLocation',
    'WeatherWatcher',
    'Workshop'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || t || '_workspace', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION omnia_fill_workspace()',
      'trg_' || t || '_workspace', t
    );
  END LOOP;
END
$petla$;
