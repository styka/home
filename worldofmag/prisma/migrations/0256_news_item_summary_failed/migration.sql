-- 084 (AC-23): znacznik „mimo ponowień nie udało się streścić tej pozycji".
--
-- Po co osobna kolumna, skoro wartość dałoby się „wywnioskować": nie dałoby się. Pozycja bez
-- streszczenia zostaje z surowym skrótem z kanału RSS, a skrót z kanału bywa poprawnym zdaniem —
-- z samej treści nie da się orzec, czy to streszczenie modelu, czy zaciągnięty opis. Porównywanie
-- z oryginałem wymagałoby trzymania oryginału, czyli i tak kolumny, tylko większej.
--
-- Addytywnie i idempotentnie: kod da się cofnąć bez ruszania bazy, a powtórzone `migrate deploy`
-- niczego nie psuje.
ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "summaryFailed" BOOLEAN NOT NULL DEFAULT false;
