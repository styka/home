-- 079 (U-7 z przeglądu 078) — `Job` TRACI `workspaceId`: TRZECI NOŚNIK TEJ SAMEJ INFORMACJI.
--
-- `Job` miał `ownerId` (zostaje na stałe — zadanie systemowe nie należy do nikogo) ORAZ
-- `workspaceId` z wyzwalaczem. Po decyzji z 076 kolejka nigdy nie przejdzie na przestrzenie, więc
-- ta druga kolumna jest **nieużywana i nieprzeznaczona do użycia**: w kodzie aplikacji nie ma ani
-- jednego czytelnika, a jedyny kandydat na przyszłego (zadanie 27 — budżety AI) jest z definicji
-- **per użytkownik**, nie per przestrzeń.
--
-- Przegląd nazwał to „nie szkodzi, ale każdy kolejny czytelnik będzie musiał rozstrzygnąć, którego
-- użyć". Rozstrzygamy raz, tutaj: kolejka jest **własnością konta**, nie przestrzeni. Kolumna bez
-- czytelnika to ta sama pułapka co martwy helper — wygląda na dostępny mechanizm i pierwsza osoba,
-- która po nią sięgnie, zbuduje na niej regułę dostępu, której nikt nie utrzymuje.
--
-- Skutek uboczny warty odnotowania: lista wyjątków `workspace-nullable.json` schodzi z pięciu do
-- czterech pozycji, a `check:workspace-fill` z pięciu wyzwalaczy do czterech. `Job` znika z obu nie
-- dlatego, że przestał spełniać kryterium („wiersz może nie mieć właściciela" — nadal spełnia),
-- tylko dlatego, że nie ma już kolumny, której te listy dotyczą.

DROP TRIGGER IF EXISTS "trg_Job_workspace" ON "Job";
DROP INDEX IF EXISTS "Job_workspaceId_idx";
ALTER TABLE "Job" DROP COLUMN "workspaceId";
