-- 113 (recenzja) — UNIKALNOŚĆ KOPII GATUNKU IDZIE PO KLUCZU KATALOGU, NIE PO NAZWIE ŁACIŃSKIEJ.
--
-- **Znaleziony błąd.** Migracja 0272 założyła `UNIQUE (workspaceId, nameLatin)` na `PlantSpecies`
-- przy założeniu, że nazwa łacińska jednoznacznie identyfikuje wpis. W katalogu systemowym tak NIE
-- jest i nie może być: dziewięć par wpisów dzieli nazwę gatunku, bo są to różne UPRAWY tego samego
-- gatunku — cukinia, dynia i kabaczek to wszystko `Cucurbita pepo`, pietruszka korzeniowa i naciowa
-- to `Petroselinum crispum`, kukurydza cukrowa i pastewna to `Zea mays`, pszenica ozima i jara to
-- `Triticum aestivum`.
--
-- **Objaw, gdyby to zostało.** Użytkownik dodaje do siebie cukinię, potem dynię. Drugie dodanie
-- trafia w istniejący wiersz (bo `nameLatin` się zgadza), więc `addSpeciesFromCatalog` zwraca
-- **cukinię** i nie tworzy nic nowego. Przycisk wygląda, jakby nie zadziałał, a roślina oznaczona
-- tym gatunkiem dostaje wymagania wodne cukinii zamiast dyni — czyli błędny harmonogram, i to bez
-- żadnego komunikatu.
--
-- **Poprawka.** Tożsamość kopii daje **klucz wpisu katalogu**, bo to on identyfikuje uprawę.
-- Wpisy własne mają `catalogKey IS NULL`, a w PostgreSQL NULL-e w indeksie unikalnym są różne, więc
-- ten sam indeks nie ogranicza wpisów własnych — ich duplikaty odsiewa akcja, szukając po nazwie
-- łacińskiej WŚRÓD wpisów bez klucza katalogu.
--
-- Zero utraty danych: usuwamy indeks i zakładamy inny; żadna kolumna nie znika.

DROP INDEX IF EXISTS "PlantSpecies_workspaceId_nameLatin_key";

CREATE UNIQUE INDEX "PlantSpecies_workspaceId_catalogKey_key"
  ON "PlantSpecies"("workspaceId", "catalogKey");
