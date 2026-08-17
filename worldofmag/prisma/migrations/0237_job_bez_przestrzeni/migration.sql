-- Korekta 0235: `Job.workspaceId` wraca do nullowalnego.
--
-- BŁĄD KLASYFIKACJI, nie błąd reguły. Listę wyjątków w 0235 zbudowałem z tabel SŁOWNIKOWYCH —
-- takich, w których rekord systemowy jest wspólny dla wszystkich kont. `Job` do nich nie należy
-- i dlatego trafił do grupy zaostrzanej. Kryterium było jednak węższe niż rzeczywistość: liczy się
-- nie „czy tabela trzyma słownik", tylko **czy wiersz może nie mieć właściciela**.
--
-- `Job.ownerId` jest nullowalne z rozmysłem — zadanie w tle bywa systemowe (sprzątanie, przebiegi
-- cykliczne), a takie nie należy do nikogo i tym samym do żadnej przestrzeni. Po 0235 kolejka
-- przestała przyjmować takie zadania: „Null constraint violation on the fields: (`workspaceId`)",
-- nie w produkcji, tylko w dziewięciu testach kolejki — dokładnie tam, gdzie miała.
--
-- Uwaga na przyszłość zapisana w manifeście: `Job` jest w nim z INNEGO powodu niż cztery słowniki
-- i te powody nie mogą się zlać w jeden. Słownik: „rekord wspólny dla wszystkich". Kolejka:
-- „zadanie nie należące do nikogo". Wspólny jest tylko wniosek — NULL jest tu prawdziwą wartością.

ALTER TABLE "Job" ALTER COLUMN "workspaceId" DROP NOT NULL;
