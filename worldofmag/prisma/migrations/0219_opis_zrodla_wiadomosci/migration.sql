-- 040: opis źródła wiadomości własnymi słowami zamiast sztywnej kategorii światopoglądowej.
--
-- Powód: zestaw kanałów właściciela dawno wyszedł poza politykę. Zamknięty zbiór
-- left|center|right nie ma jak opisać źródła „pop-science" albo „nature", a wybór z trzech opcji
-- zmuszał do wpisywania kanału w kategorię, do której nie należy.
--
-- ⚠️ KROK NIEODWRACALNY NA KOŃCU: usuwamy kolumnę "leaning".
-- Poprzedza go UPDATE, który przenosi CAŁĄ jej treść do "descriptor", więc informacja nie ginie —
-- ginie tylko jej forma (trzy stałe wartości → dowolny tekst). KOLEJNOŚĆ JEST ISTOTNA: gdyby DROP
-- wyprzedził UPDATE, mapowanie nie miałoby z czego czytać i wszystkie źródła zostałyby bez opisu.
-- Odzyskanie treści po pomyłce wymaga przywrócenia bazy w czasie (Neon PITR) wg
-- `worldofmag/docs/devops/runbook-deploy-rollback.md`.
--
-- Rodzaj pozostaje TEXT + typ TypeScript (C-12) — tu akurat nie tylko z konwencji, ale dlatego, że
-- dowolny opis jest sednem zmiany.

-- (1) Nowa kolumna. DEFAULT '' zamiast NULL: kod nie musi rozróżniać „brak kolumny" od „pusty opis",
-- a pusty opis jest dozwolonym stanem (użytkownik może go wyczyścić).
ALTER TABLE "NewsSource" ADD COLUMN "descriptor" TEXT NOT NULL DEFAULT '';

-- (2) Przeniesienie treści. Żadne istniejące źródło nie może zostać z pustym opisem ani z surowym
-- left/center/right — użytkownik ma zobaczyć czytelne słowo po polsku.
UPDATE "NewsSource" SET "descriptor" = CASE "leaning"
    WHEN 'left'   THEN 'Lewica'
    WHEN 'center' THEN 'Centrum'
    WHEN 'right'  THEN 'Prawica'
    -- Wartość spoza zbioru (nie powinna istnieć, ale kolumna jest zwykłym TEXT-em) też dostaje
    -- sensowny opis zamiast pustki.
    ELSE 'Centrum'
  END;

-- (3) Stara kolumna znika.
ALTER TABLE "NewsSource" DROP COLUMN "leaning";
