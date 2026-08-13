-- Zadanie 15 przebudowy — WERSJA REKORDU, mechanizm + pilot (rozdz. 8.5).
--
-- Diagnoza 5.1 brzmi: „żaden model nie ma wersji, więc ostatni zapis wygrywa po cichu".
-- Dwie osoby edytujące ten sam rekord nie dostają dziś żadnego sygnału — praca jednej z nich
-- znika bez śladu w logach i bez powodu, żeby ktokolwiek jej szukał.
--
-- PILOT, nie wszystkie modele. Kolumna na czterdziestu modelach, z których korzysta jeden, to
-- czterdzieści nieużywanych kolumn i zero dowodu. `Task` i `Note` wybrane, bo pokrywają dwa różne
-- kształty współpracy: rekord strukturalny (status, termin) i długi tekst.
--
-- `DEFAULT 0` czyni migrację bezpieczną dla istniejących wierszy: każdy zaczyna od wersji 0,
-- a pierwszy zapis przez `updateWithVersion` podniesie ją do 1.
--
-- CO TA MIGRACJA ROBI APLIKACJI: nic. Wersja jest OPCJONALNA po stronie wołającego — ścieżka
-- zapisu, która jej nie podaje, działa dokładnie jak dotąd (spec AC-4). Wymuszenie wersji wszędzie
-- naraz zmieniłoby zachowanie każdej akcji w aplikacji, a dowodem byłby wyłącznie kompilator.
--
-- CZEGO TU NIE MA, świadomie (rozdz. 8.5.3): liczników aktualizowanych atomowo (`increment` jest
-- z definicji bezkonfliktowy), wpisów dziennikowych (tylko dopisywane) i zasobów jednego
-- użytkownika (`AssistantPref`, `DashboardPref`, `UserMenuPref` — nie ma z kim się ścigać).
--
-- Wycofanie: ALTER TABLE ... DROP COLUMN "version". Bezpieczne — nic bez tej kolumny nie przestanie
-- działać, bo zapis bez podanej wersji jej nie czyta.

ALTER TABLE "Task" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Note" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
