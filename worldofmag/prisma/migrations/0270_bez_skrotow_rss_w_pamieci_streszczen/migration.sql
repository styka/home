-- 111 (recenzja): PAMIĘĆ STRESZCZEŃ NIE MOŻE ZAWIERAĆ SUROWYCH SKRÓTÓW Z KANAŁU.
--
-- Migracja 0269 przeniosła bieżące streszczenia do `NewsItemSummary`, odsiewając pozycje z
-- `summaryFailed = true`. Ten filtr okazał się za wąski i to jest ustalenie z recenzji.
--
-- Pozycja dostaje `summary = skrót z kanału` już przy PRZYPISANIU do tematu (etap 2 przebiegu),
-- z `summaryFailed = false` — bo to pole znaczy „ponowienia streszczania zawiodły", a nie „nie ma
-- streszczenia". Gdy przebieg skończy się PRZED etapem streszczania — a jest na to jawna gałąź:
-- nieskonfigurowany model (`llmUnconfigured`) — pozycja zostaje z surowym skrótem i z opuszczoną
-- flagą. Backfill zapisał więc taki skrót jako „streszczenie poziomu domyślnego".
--
-- Skutek bez tej poprawki: kliknięcie „średnie" **na zawsze** zwraca ten skrót natychmiast i za
-- darmo (bo pamięć trafia), czyli dokładnie objaw, który 111 miało usunąć — a kod tego nie odkręci,
-- bo dane już są. Stąd osobna migracja: 0269 mogła zostać zaaplikowana, a zmiana jej treści byłaby
-- rozjazdem między środowiskami (C-11 — nigdy nie ruszamy zaaplikowanej migracji).
--
-- Rozpoznajemy je po tym, że tekst jest PREFIKSEM opisu z puli artykułów: etap 2 zapisuje
-- `article.description` przycięte do 400 znaków, więc porównanie po prefiksie łapie je dokładnie,
-- a prawdziwego streszczenia (napisanego przez model innymi słowami) nie tknie.
DELETE FROM "NewsItemSummary" s
USING "NewsItem" i
JOIN "NewsArticle" a ON a."id" = i."articleId"
WHERE s."itemId" = i."id"
  AND length(btrim(s."text")) > 0
  AND left(a."description", length(s."text")) = s."text";

-- Te same pozycje muszą też przestać udawać kompletne na liście: skoro w `summary` leży surowy
-- skrót, a streszczenia nie ma, karta ma to powiedzieć wprost (AC-22) i pokazać ponowienie.
UPDATE "NewsItem" i
SET "summaryFailed" = true
FROM "NewsArticle" a
WHERE a."id" = i."articleId"
  AND i."summaryFailed" = false
  AND length(btrim(i."summary")) > 0
  AND left(a."description", length(i."summary")) = i."summary"
  AND NOT EXISTS (SELECT 1 FROM "NewsItemSummary" s WHERE s."itemId" = i."id");
