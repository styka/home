-- Import listy zadań „LZ" dla użytkownika tyka.szymon@gmail.com.
-- 149 zadań z arkusza (scripts/import-lz/zadania-lz.json), wszystkie w
-- statusie 'TODO' (nowe, niezaczęte; zaległe/teraźniejsze/przyszłe + cykliczne).
-- Idempotentne: tworzy projekt LZ tylko gdy go nie ma; seeduje zadania tylko
-- gdy LZ jest pusty. PostgreSQL-only (gen_random_uuid).

DO $LZ_IMPORT$
DECLARE
  v_user_id    text;
  v_project_id text;
  v_count      int;
  v_task_id    text;
BEGIN
  SELECT id INTO v_user_id FROM "User" WHERE email = 'tyka.szymon@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Import LZ: brak użytkownika tyka.szymon@gmail.com — pomijam.';
    RETURN;
  END IF;

  -- Projekt LZ właściciela; utwórz tylko jeśli nie istnieje.
  SELECT id INTO v_project_id FROM "TaskProject"
    WHERE name = 'LZ' AND "ownerId" = v_user_id
    ORDER BY "createdAt" LIMIT 1;
  IF v_project_id IS NULL THEN
    v_project_id := gen_random_uuid()::text;
    INSERT INTO "TaskProject" (id, name, description, color, emoji, "isInbox", "ownerId", "ownerTeamId", "statusConfig", "createdAt", "updatedAt")
    VALUES (v_project_id, 'LZ', 'Lista zadań — import z arkusza', '#6b7280', '📋', false, v_user_id, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  -- Replay-safety: seeduj tylko gdy LZ nie ma jeszcze zadań.
  SELECT count(*) INTO v_count FROM "Task" WHERE "projectId" = v_project_id;
  IF v_count > 0 THEN
    RAISE NOTICE 'Import LZ: projekt LZ ma już % zadań — pomijam seed.', v_count;
    RETURN;
  END IF;

  -- Definicje tagów (globalne, unikalne po nazwie).
  INSERT INTO "TaskTagDef" (id, name, color)
  SELECT gen_random_uuid()::text, x, '#6b7280'
  FROM unnest(ARRAY['Katowice', 'Kocoń', 'dom', 'inne', 'pomysły', 'praca', 'raj', 'samochód', 'zdrowie']) AS x
  ON CONFLICT (name) DO NOTHING;

  -- ===== ZADANIA (149) =====
  -- [0] AI DEVS
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$AI DEVS$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 12×
Cykliczność (oryg.): codziennie$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 30, $v${"type": "DAILY", "interval": 1}$v$, 'Other', 0, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [1] Ustalić jaką kupić lampę UV i kto ją założy.
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Ustalić jaką kupić lampę UV i kto ją założy.$v$, $v$Perplexity: https://www.perplexity.ai/search/perplexity-stacja-uzdatniania-xrVskzI7Q02F3K3LibRUZA
Potem badać wodę

Studnia głębinowa - badanie wody po 3-6 miesiący; jak będzie OK to potem co 12-24 miesiące

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 6×$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 1, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [2] Analizator pomyslow generujący raport sposób realizacji i ile można bę
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Analizator pomyslow generujący raport sposób realizacji i ile można będzie na tym zarobić. Czyli analizę biznesową.$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 8×
Cykliczność (oryg.): 1 lipca$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 2, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [3] CZARNA
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$CZARNA$v$, $v$- sprawdzić czy w ubezpieczalni sprawa zamknięta - powinien być zwrot kasy, potwierdzić że wszędzie jestem wypisany i że to koniec spraw z CZARNA
- zweryfikować na mObywatel czy wyrejestrowali mi Czarną

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 16×$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 30, NULL, 'Other', 3, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [4] czyszczenie kuchennych szafek w środku (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$czyszczenie kuchennych szafek w środku (Kocoń)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 16×
Cykliczność (oryg.): Co rok$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 360, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 4, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [5] napisać do parkingów w Łodzi z pytaniem czy trzeba jakieś odsetki i o 
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$napisać do parkingów w Łodzi z pytaniem czy trzeba jakieś odsetki i o zwroot za złą strefę$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 12×$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 5, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód', 'Katowice']);

  -- [6] czyszczenie kuchennych szafek w środku (Katowice)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$czyszczenie kuchennych szafek w środku (Katowice)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 14×
Cykliczność (oryg.): Co rok$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 360, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 6, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [7] czyszczenie armatury i AGD w kuchni (Katowice) - Mariola
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$czyszczenie armatury i AGD w kuchni (Katowice) - Mariola$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 14×
Cykliczność (oryg.): Co 2 miesiące$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 60, $v${"type": "MONTHLY", "interval": 2}$v$, 'Other', 7, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [8] czyszczenie armatury i AGD w kuchni (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$czyszczenie armatury i AGD w kuchni (Kocoń)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 9×
Cykliczność (oryg.): Co 2 miesiące$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 60, $v${"type": "MONTHLY", "interval": 2}$v$, 'Other', 8, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [9] Stworzyć nową piosenkę (o Krzysiu)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Stworzyć nową piosenkę (o Krzysiu)$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 14×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 240, NULL, 'Other', 9, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [10] Poszukać ubezpieczeń na życie które płacą za L4 (nie tylko przy nieszc
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Poszukać ubezpieczeń na życie które płacą za L4 (nie tylko przy nieszczęśliwych wypadkach)$v$, $v$Spytać w AP Finance

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 6×$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 90, NULL, 'Other', 10, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [11] Petsitter https://petsy.pl/p/alicja-dHuSth6
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Petsitter https://petsy.pl/p/alicja-dHuSth6$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 6×$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 11, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [12] Backup Maca
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Backup Maca$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Przełożone: 5×
Cykliczność (oryg.): co miesiąc$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-05-06T00:00:00.000Z', NULL, NULL, 12, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 12, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [13] Zidentyfikować usterki w mieszkaniu w Katowicach i zlecić naprawy
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Zidentyfikować usterki w mieszkaniu w Katowicach i zlecić naprawy$v$, $v$Okno w kuchni, serwis okien: https://www.facebook.com/serwiswin.warszawa

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 9×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 13, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [14] Znaleźć i zainstalować hamak, kupić stojak
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Znaleźć i zainstalować hamak, kupić stojak$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 8×
Cykliczność (oryg.): co rok$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 14, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne', 'Kocoń']);

  -- [15] pomalować dach garażu
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$pomalować dach garażu$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne
Przełożone: 8×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 15, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [16] Tłumacz jak ze star treka na air podsy lub z napisami w rozszerzonej r
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Tłumacz jak ze star treka na air podsy lub z napisami w rozszerzonej rzeczywistości$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne
Przełożone: 6×$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 480, NULL, 'Other', 16, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['pomysły']);

  -- [17] Zainwestować w growboxy (uprzedzić o tym policję) by sprzedać je droże
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Zainwestować w growboxy (uprzedzić o tym policję) by sprzedać je drożej jak zacznie się duży popyt po legalizacji zioła w Polsce. Może zainwestować też w jakieś inne akcesoria dla tego typu domowych upraw. DRUGA sprawa to spróbować zrobić idealną imprezę muzyczną w plenerze z wielkim ekranem i visualizacjami w systemie słuchawkowym z poziomami uczestnictwa, może powinna być DJka by to było kompletne, oczywiście dekosy i wszystko co najlepsze z festiwali$v$, $v$Błażej powiedział że może też w lampy do growboxównawozy itd

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 17, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [18] Sprawdzić apkę CapCut
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Sprawdzić apkę CapCut$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 1×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, NULL, NULL, 'Other', 18, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [19] Stworzyć własną aplikację CMS dla graph ql
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Stworzyć własną aplikację CMS dla graph ql$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, NULL, NULL, 'Other', 19, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['pomysły']);

  -- [20] Chce okulusy by np malować świat
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Chce okulusy by np malować świat$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, NULL, NULL, 'Other', 20, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [21] Raj - Simparica (Trio do podania 28 maj - potem za kolejne 3 miesiące)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - Simparica (Trio do podania 28 maj - potem za kolejne 3 miesiące)$v$, $v$- w koconiu skończyła się simparica trio

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co miesiąc$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-04-28T00:00:00.000Z', NULL, NULL, 6, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 21, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [22] Opróżnić kosze (Katowice)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Opróżnić kosze (Katowice)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co wyjazd$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-05-26T00:00:00.000Z', NULL, NULL, 12, NULL, 'Other', 22, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [23] Zabezpieczyć kranik przy studni przed zamarzaniem
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Zabezpieczyć kranik przy studni przed zamarzaniem$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok - 1 października$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-10-01T00:00:00.000Z', NULL, NULL, 120, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 23, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [24] OMNIMAT
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$OMNIMAT$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co pt$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-06-05T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "WEEKLY", "interval": 1, "daysOfWeek": [5]}$v$, 'Other', 24, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [25] Raj fizjoterapia
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj fizjoterapia$v$, $v$- ćwiczyć
- przygotować potrzebne sprzęty
- po niecałym miesiącu ćwiczeń umówić się do VitalVet

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 dni$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-05-16T00:00:00.000Z', NULL, NULL, 30, $v${"type": "DAILY", "interval": 2}$v$, 'Other', 25, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [26] Przygotować i złożyć PIT
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Przygotować i złożyć PIT$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok - 3 marca$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2027-03-03T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 26, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [27] Remont/ogród;
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Remont/ogród;$v$, $v$- Łukasz - upomnieć się - czekam na odpowiedź mailową
- Mateusz - kolory blatów
- Andrzej - czekam co odpisze w sprawie wycen ekip; zawieszona kostka i mamy prawo do poprawek tarasu
- musimy odpowiedzieć andrzejowi na ofertę mebli na wymiar

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 27, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [28] Dowiedzieć się czy na obecnej konstrukcji dachu będzie można założyć p
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Dowiedzieć się czy na obecnej konstrukcji dachu będzie można założyć panele słoneczne$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-05-05T00:00:00.000Z', NULL, NULL, 30, NULL, 'Other', 28, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [29] Studnia głębinowa - wymiana filtrów
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Studnia głębinowa - wymiana filtrów$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): na razie co 2 miesiące$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-07-28T00:00:00.000Z', NULL, NULL, 60, $v${"type": "MONTHLY", "interval": 2}$v$, 'Other', 29, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [30] DNA moczanowa? NERKI - UROLOG:
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$DNA moczanowa? NERKI - UROLOG:$v$, $v$DONE - 1. Wykonać UFL - 20.06 (piątek) 8-17

- Zastanowić się czy nie choruję na ZZSK i na to na nerki co Asia wspominała

2. Wykonać UFL - 29.08 (piątek) 8-17
3. Oddać krew/mocz do badania - 27.08 (środa).
4. Odebrać wyniki z badania krwi i moczu - 03.09 (środa)
4. Wizyta - 12.09 (piątek).

dr Sokołowski

Rejestracja: 326027000 (przychodnia przyszpitalna)

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 240, NULL, 'Other', 30, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie', 'Katowice']);

  -- [31] czyszczenie lodówki (Katowice) - MARIOLA
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$czyszczenie lodówki (Katowice) - MARIOLA$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Cykliczność (oryg.): Co pół roku$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-07-29T00:00:00.000Z', NULL, NULL, 120, $v${"type": "MONTHLY", "interval": 6}$v$, 'Other', 31, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [32] OMNIMAT - koniec miesiąca + wystawić fakturę
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$OMNIMAT - koniec miesiąca + wystawić fakturę$v$, $v$nie ma faktury w KSEF

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co miesiąc - 23 dnia$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-06-23T00:00:00.000Z', NULL, NULL, 30, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 32, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [33] Dermatolog (alergolog i inni) -
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Dermatolog (alergolog i inni) -$v$, $v$- podsumować co było na wizycie i ustalić co dalej

AllMedica w Wadowicach

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 30, NULL, 'Other', 33, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [34] Szczepienie przeciwko kaszlowi kennelowemu
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Szczepienie przeciwko kaszlowi kennelowemu$v$, $v$- zastanowić się czy w tym roku będziemy szczepić (ostatnie szczepienie: 2025.06.18)

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 34, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [35] Schodzić z Forthyronu
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Schodzić z Forthyronu$v$, $v$- badanie krwi (co miesiąc) - czekam na wyniki razem z cytologią
- kontrola w ivet (20 maj)

co dalej?

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co ile trzeba$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 30, NULL, 'Other', 35, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [36] Opłacić podatki - termin do 20 dnia miesiąca
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Opłacić podatki - termin do 20 dnia miesiąca$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): 14 dnia miesiąca$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-05-14T00:00:00.000Z', NULL, NULL, 12, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 36, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [37] Stomatologia
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Stomatologia$v$, $v$- umówić wizytę
- zdjęcie lekarstwa

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co ile trzeba$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-05-04T00:00:00.000Z', NULL, NULL, 12, NULL, 'Other', 37, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie', 'Katowice']);

  -- [38] Raj umówić ortopedę na za miesiąc - USG kolana lewego i sprawdzenie mi
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj umówić ortopedę na za miesiąc - USG kolana lewego i sprawdzenie mięśni i ruchomości$v$, $v$dr Imioło
Centrum Leczenia Zwierząt "FIVET" Wolności 121, 42-506 Będzin Telefon: 728 451 155

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-04-01T00:00:00.000Z', NULL, NULL, 30, NULL, 'Other', 38, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [39] Ogarnąć dla Asi prezent na kolejną okazję
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Ogarnąć dla Asi prezent na kolejną okazję$v$, $v$KRUK

Kwiatki na walentynki i na rocznicę zamówić (odbiór piątek i niedziela)

wybrać romansidło

Zarezerwowany stolik w restauracji na 14:30 w sobotę: https://maps.app.goo.gl/6rnG78ykTk5ZEs2S6

https://www.facebook.com/share/p/1D1BujfxZo/

https://www.amazon.pl/s?k=kindle&i=electronics&rh=n%3A20657432031%2Cp_123%3A323125%2Cp_n_condition-type%3A21329610031%2Cp_6%3AA2R2221NX79QZP&dc&crid=UAF0BIQY7KQ3&qid=1756750445&rnid=20875378031&sprefix=k%2Caps%2C102&ref=sr_nr_p_6_1&ds=v1%3AaOMZ2cWsq%2B%2F3qvxSZB43C3tkuimM%2FJRzmgr5Qyw53%2Bskupić
Kindle Paperwhite 6 Signature Edition
albo colorsoft 32 GB
sprawdzić recenzje colorsoft

 koszulę nocną, znaleźć teatr, ogarnąć restaurację, jeszcze coś? może coś drobnego, albo coś do Potworka? Nauka jazdy terenowej ( To ci się może przydać do prezentu dla mnie
Jedna dziewczyna z turnieju k9 byla u nich i była zadowolona


https://www.facebook.com/eror4x4 ). Garmin który będzie się ładował słonecznie.

kolczyki
voucher
?
https://www.perplexity.ai/search/podaj-10-pomyslow-na-33-urodzi-QG9pkkbSR4CaUOBK5gXrpA

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Cykliczność (oryg.): 1 lipca$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 39, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [40] Raj - kontrolne USG, Echo serca
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - kontrolne USG, Echo serca$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 1,5 roku$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2027-09-19T00:00:00.000Z', NULL, NULL, 30, $v${"type": "MONTHLY", "interval": 18}$v$, 'Other', 40, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [41] Szczpienia
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Szczpienia$v$, $v$(MAJ)
Załatwić receptę, kupić i zaszczepić w czerwcu (procedurę zacząć w maju):
odkleszczowe zapalenie mózgu:
- Szymon - :FSME-IMMUN 0,5 ml 2,4 µg/0,5 ml
- Asia - Encepur Adults

DONE 1. Ze zdjęć żółtej książeczki stworzyć excela ze szczepieniami jakie mieliśmy;
2. Wpisać daty szczepień covid;
3. Uzupełnić listę o szczepienia z książeczek zdrowia dziecka;
4. Spytać rodziców czy było więcej szczepień;
5. Ustalić listę na co chcemy mieć odporność (m.in: kleszczowe zapalenie mózgu, koklusz);
6. U lekarza w Gilowicach spytać na co jeszcze warto się zaszczepić;
7. Z lekarzem zweryfikować listę odbytych szczepień i zrobić plan szczepień;
8. Zaszczepić się zgodnie z planem szczepień;

https://www.gov.pl/web/zdrowie/szczepienia-obowiazkowe-i-zalecane

Niepubliczny Zakład Opieki Zdrowotnej "VITA" – Ślemień, Żywiecka 5 -
 tel: 338654075 - przychodniaslemien@gmail.com - to jest dobry numer!!!!!

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Cykliczność (oryg.): co ile? Maj$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 41, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [42] Składanie prania
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Składanie prania$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co tydzień$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-06-02T00:00:00.000Z', NULL, NULL, 60, $v${"type": "WEEKLY", "interval": 1}$v$, 'Other', 42, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [43] Bonus
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Bonus$v$, $v$- wizyta umówić

Małgorzata Ruty - somatic experiencing:
Katowice ul. Żarnowcowa 19b

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-07-01T00:00:00.000Z', NULL, NULL, 240, NULL, 'Other', 43, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [44] Znaleźć elektryka do zmadania instalacji elektrycznej
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Znaleźć elektryka do zmadania instalacji elektrycznej$v$, $v$https://www.perplexity.ai/search/kolega-ma-stary-dom-w-ktorym-o-d0lr5P._TeqRVpADr9e8Vw

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 1×$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-04-01T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 44, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [45] Pomyśleć o czymś na rocznicę ślubu
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Pomyśleć o czymś na rocznicę ślubu$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Cykliczność (oryg.): co rok - 1 marca$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 45, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [46] OC (Perła) - termin do 7 kwietnia
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$OC (Perła) - termin do 7 kwietnia$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2027-03-28T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 46, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [47] ZUK - umowa na przyłącza na czerwiec - być w kontakcie
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$ZUK - umowa na przyłącza na czerwiec - być w kontakcie$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-05-15T00:00:00.000Z', NULL, NULL, 30, NULL, 'Other', 47, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [48] Mama i tata
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Mama i tata$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co sobotę$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-05-16T00:00:00.000Z', NULL, NULL, 60, $v${"type": "WEEKLY", "interval": 1, "daysOfWeek": [6]}$v$, 'Other', 48, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [49] Doszkalanie foresterem - jak najszybciej
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Doszkalanie foresterem - jak najszybciej$v$, $v$Ewa Leśniak <dom.beskidy@gmail.com>

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 4×$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-04-01T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 49, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [50] CHRAPANIE - LARYNGOLOGIA
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$CHRAPANIE - LARYNGOLOGIA$v$, $v$- ćwiczenia
- spać z ortezą

Laryngolog Blicharz

KOD: 8382

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 dni$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, $v${"type": "DAILY", "interval": 2}$v$, 'Other', 50, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [51] Raj - kastracja, czy to ma sens?
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - kastracja, czy to ma sens?$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'LOW', TIMESTAMPTZ '2027-05-01T00:00:00.000Z', NULL, NULL, NULL, NULL, 'Other', 51, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [52] Okulista
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Okulista$v$, $v$- sprawdzić czy mam już zrobione wszystkie badania by iść do okulisty

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 3 lata$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 3}$v$, 'Other', 52, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [53] Zainwestować w USD
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Zainwestować w USD$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 1×$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 53, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [54] Raj - czyszczenie uszu
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - czyszczenie uszu$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co miesiąc$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-06-22T00:00:00.000Z', NULL, NULL, 30, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 54, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj', 'Kocoń']);

  -- [55] Przygotować faktury (SKANOWAĆ!), wysłać/zanieść faktury - termin do 17
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Przygotować faktury (SKANOWAĆ!), wysłać/zanieść faktury - termin do 17 dnia miesiąca$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): do 5 dnia miesiąca$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-06-05T00:00:00.000Z', NULL, NULL, 60, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 55, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca', 'Kocoń']);

  -- [56] Test osobowości -Chciałeś ten test osobowości https://www.16personalit
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Test osobowości -Chciałeś ten test osobowości https://www.16personalities.com/pl/darmowy-test-osobowosci$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'NONE', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 56, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [57] ORTOPEDA:
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$ORTOPEDA:$v$, $v$Zlecone badania krwi
umówić wizytę do ortopedy.
Spytać o Badanie ORTO kręgosłupa na urazówce w Piekarach

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 57, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [58] Umówić się na floating
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Umówić się na floating$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 30, NULL, 'Other', 58, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [59] Mateusz blaty - wybrać kolor
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Mateusz blaty - wybrać kolor$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-04-14T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 59, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [60] Odburzanie
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Odburzanie$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co miesiąc$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 60, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [61] OC (Potworek) - termin do 20 września
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$OC (Potworek) - termin do 20 września$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co rok$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-09-01T00:00:00.000Z', NULL, NULL, 30, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 61, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [62] Upewnić się że mamy w obu domach:
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Upewnić się że mamy w obu domach:$v$, $v$- Simparice (+ Simparica trio na odrobaczanie)
- Forthyron

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co 3 miiesiące$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-04-28T00:00:00.000Z', NULL, NULL, 12, $v${"type": "MONTHLY", "interval": 3}$v$, 'Other', 62, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [63] Przygotować iPhone nna wymiianę baterii - zgrać i backupy
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Przygotować iPhone nna wymiianę baterii - zgrać i backupy$v$, $v$https://www.gov.pl/web/zdrowie/szczepienia-obowiazkowe-i-zalecane

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne
Przełożone: 1×$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 90, NULL, 'Other', 63, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [64] Dyscyplina - koncentracja - cierpliwość
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Dyscyplina - koncentracja - cierpliwość$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): pn$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-26T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "WEEKLY", "interval": 1, "daysOfWeek": [1]}$v$, 'Other', 64, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [65] ćwiczenia: basen, gęsia stopka, rozciąganie barków i szyi, głębokie mi
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$ćwiczenia: basen, gęsia stopka, rozciąganie barków i szyi, głębokie mięśnnie brzuch, JOGA$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 dni$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 30, $v${"type": "DAILY", "interval": 2}$v$, 'Other', 65, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [66] Postarać się o podwyżkę
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Postarać się o podwyżkę$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-06-07T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 66, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [67] Raj RTG całości? czy tylko bioder? Czekamy na wyniki cytologii
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj RTG całości? czy tylko bioder? Czekamy na wyniki cytologii$v$, $v$gdzie wyniki z ARKI? wyniki cytologi i wymazu z ogona

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 lata$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-04-27T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 2}$v$, 'Other', 67, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [68] wymienić filtr w okapie (Katowice) + naprawić lampkę
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$wymienić filtr w okapie (Katowice) + naprawić lampkę$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Przełożone: 10×
Cykliczność (oryg.): co pół roku$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-06-02T00:00:00.000Z', NULL, NULL, 30, $v${"type": "MONTHLY", "interval": 6}$v$, 'Other', 68, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [69] krew to co ortopeda zalecił i to co jest na karteczkach i to co inny o
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$krew to co ortopeda zalecił i to co jest na karteczkach i to co inny ortopeda zalecił żelazo chyba itd$v$, $v$Badania próby wątrobowe. ACTH od nadnerczy jeśli niski to przewlekły stres i jeśli duży kortyzol. Sprawdzić czy mam hjelikobakter
Sprawdzić kał na pasożyty i krew
Umówić badanie krwi w luxmed na karłowicza na 23 czerwca rano.
Zbadać krew w tym tarczyca, poziom żelaza i ferrytynę, profil lipidowy, nerki, PSA, B12, D, magnez, tarczyca, kreatyna, kortyzol. Oraz wszystkie te badania: https://www.perplexity.ai/search/zaburzenia-lekowe-prowadza-do-WMoi.lPHQm2ueBSbWtZQrA

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Przełożone: 3×
Cykliczność (oryg.): co rok$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-06-02T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 69, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [70] Odpajęczanie domu i posesji
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Odpajęczanie domu i posesji$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 tygodnie$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, $v${"type": "WEEKLY", "interval": 2}$v$, 'Other', 70, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [71] Julka - wymyśleć coś fajnego
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Julka - wymyśleć coś fajnego$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 3×
Cykliczność (oryg.): co rok pół roku$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 90, NULL, 'Other', 71, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [72] Opróżnić kosze (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Opróżnić kosze (Kocoń)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co wyjazd / co tydzień$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-05-05T00:00:00.000Z', NULL, NULL, 18, $v${"type": "WEEKLY", "interval": 1}$v$, 'Other', 72, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [73] Rozliczenie roku + zwrot Asi za mieszkanie, terapie, lekarze, masaże +
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Rozliczenie roku + zwrot Asi za mieszkanie, terapie, lekarze, masaże + sprawdzić czy Asia odesłała mi 20k$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Przełożone: 8×
Cykliczność (oryg.): co rok (2 stycznia)$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 73, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [74] Chlorowanie studni
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Chlorowanie studni$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 6×$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-07-28T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 74, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [75] Rozliczenie miesiąca
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Rozliczenie miesiąca$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co miesiąc - 20 dnia miesiąca$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 75, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [76] kupić:
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$kupić:$v$, $v$- suplementy (glicyna, ...)
- koszulki
- skarpetki
- akcesoria basenowe (moskitiera?)

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 76, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [77] Mycie ręczne i odkurzanie (Perła), dowiedzieć się jak dbać o skórę i j
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Mycie ręczne i odkurzanie (Perła), dowiedzieć się jak dbać o skórę i jak najefektywniej samemu czyścić samochód$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 21×
Cykliczność (oryg.): co pół roku$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 180, $v${"type": "MONTHLY", "interval": 6}$v$, 'Other', 77, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [78] poszukać kogoś do wyrównania/zaorania ziemi w Jeleśni i w koconiu
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$poszukać kogoś do wyrównania/zaorania ziemi w Jeleśni i w koconiu$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne
Przełożone: 6×$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-26T00:00:00.000Z', NULL, NULL, 180, NULL, 'Other', 78, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [79] Odkurzanie (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Odkurzanie (Kocoń)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): pt$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-05-08T00:00:00.000Z', NULL, NULL, 60, $v${"type": "WEEKLY", "interval": 1, "daysOfWeek": [5]}$v$, 'Other', 79, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [80] AC (Potworek) - termin do 6 lutego
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$AC (Potworek) - termin do 6 lutego$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2027-01-21T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 80, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [81] Mazda - drzwi - jechać do Specka?
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Mazda - drzwi - jechać do Specka?$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-29T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 81, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [82] Opłacić podatek w Koconiu (czekam na maila z gminy)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Opłacić podatek w Koconiu (czekam na maila z gminy)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2027-02-02T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 82, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [83] Ogarnąć nieprzeczytane i odłożone maile + zwolnić miejsce na gdrive
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Ogarnąć nieprzeczytane i odłożone maile + zwolnić miejsce na gdrive$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 dni$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, $v${"type": "DAILY", "interval": 2}$v$, 'Other', 83, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [84] Kupić Avata 2
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Kupić Avata 2$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 6×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, NULL, NULL, 'Other', 84, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [85] Fryzjer - umówić
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Fryzjer - umówić$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co 3 miesiące$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-06-12T00:00:00.000Z', NULL, NULL, 12, $v${"type": "MONTHLY", "interval": 3}$v$, 'Other', 85, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [86] Sprawdzić czy nie tracimy na tym że nie lokujemy pieniędzy na lokaty c
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Sprawdzić czy nie tracimy na tym że nie lokujemy pieniędzy na lokaty czy obligacje$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 2×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 30, NULL, 'Other', 86, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [87] Revolut wyrobić kartę
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Revolut wyrobić kartę$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 1×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 87, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [88] Ogarnąć lepszą kłódkę do studni
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Ogarnąć lepszą kłódkę do studni$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 88, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [89] Zrobić porządek w aktach
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Zrobić porządek w aktach$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 6×$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 89, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [90] Sprawdzić czy coś się zmieniło w temacie zbliżeniowych przelewó blik n
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Sprawdzić czy coś się zmieniło w temacie zbliżeniowych przelewó blik na iPhone$v$, $v$https://www.perplexity.ai/search/czy-w-sklepach-z-terminalami-p-NlqXsL4bSgCxAWdYgjgMPA

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 4×$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 90, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [91] kupic: noktowizor, luźna bluza Metallica
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$kupic: noktowizor, luźna bluza Metallica$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 1×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 91, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [92] Raj - umyć miski (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - umyć miski (Kocoń)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co 2 tygodnie$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-09T00:00:00.000Z', NULL, NULL, 30, $v${"type": "WEEKLY", "interval": 2}$v$, 'Other', 92, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj', 'Kocoń']);

  -- [93] Raj - umyć miski (Katowice)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - umyć miski (Katowice)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co 3 tygodnie$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-06-02T00:00:00.000Z', NULL, NULL, 12, $v${"type": "WEEKLY", "interval": 3}$v$, 'Other', 93, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj', 'Katowice']);

  -- [94] Poziomowanie pralki.
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Poziomowanie pralki.$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-05-06T00:00:00.000Z', NULL, NULL, NULL, NULL, 'Other', 94, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [95] Kupić szczotkę wirującą
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Kupić szczotkę wirującą$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 95, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [96] Zwolnić miejsce na gdrive
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Zwolnić miejsce na gdrive$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co ile trzebba$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 96, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [97] Przegląd techniczny auta - termin do 27 sierpień (Potworek)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Przegląd techniczny auta - termin do 27 sierpień (Potworek)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-08-10T00:00:00.000Z', NULL, NULL, 180, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 97, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [98] Koszenie trawy
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Koszenie trawy$v$, $v$- założyć nowe ostrza do kosiarki elektrycznej
- przygotować kosiarki na przechowanie zimowe

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co ile trzeba$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-16T00:00:00.000Z', NULL, NULL, 150, NULL, 'Other', 98, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [99] Ebooki i audiobooki w opisie filmu - https://youtu.be/y3QhCqHOwFY
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Ebooki i audiobooki w opisie filmu - https://youtu.be/y3QhCqHOwFY$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 1×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 99, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [100] czyszczenie lodówki (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$czyszczenie lodówki (Kocoń)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Cykliczność (oryg.): Co pół roku$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-09-22T00:00:00.000Z', NULL, NULL, 120, $v${"type": "MONTHLY", "interval": 6}$v$, 'Other', 100, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [101] Raj - czesanie
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - czesanie$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): pt$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-05-04T00:00:00.000Z', NULL, NULL, 30, $v${"type": "WEEKLY", "interval": 1, "daysOfWeek": [5]}$v$, 'Other', 101, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [102] Wyczyścić rumbę
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Wyczyścić rumbę$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 10 tygodni$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 30, $v${"type": "WEEKLY", "interval": 10}$v$, 'Other', 102, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [103] Załatwić wymianę akumulatora do odkurzacza
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Załatwić wymianę akumulatora do odkurzacza$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 103, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [104] Poodkładać rzeczy na miejsca (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Poodkładać rzeczy na miejsca (Kocoń)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): pt$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-08T00:00:00.000Z', NULL, NULL, 60, $v${"type": "WEEKLY", "interval": 1, "daysOfWeek": [5]}$v$, 'Other', 104, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [105] Raj - nauczyc 100 słów
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - nauczyc 100 słów$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co tydzień$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 30, $v${"type": "WEEKLY", "interval": 1}$v$, 'Other', 105, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [106] Przegląd techniczny auta - termin do 6 grudnia (Perła)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Przegląd techniczny auta - termin do 6 grudnia (Perła)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-11-20T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 106, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód', 'Katowice']);

  -- [107] Kupić dodatkowe ekrany do lapka z pracy
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Kupić dodatkowe ekrany do lapka z pracy$v$, $v$Wybrać coś tu: https://www.google.com/search?sca_esv=37db28bfa134011b&rlz=1CDGOYI_enPL826PL826&hl=pl&sxsrf=ADLYWIJIdkN5Lg5aElpeSuqozwa09xtaIA:1719342820750&q=monitor+doczepiany+do+laptopa&udm=3&fbs=AEQNm0Dvr3xYvXRaGaB8liPABJYdVC1NjYIFuBO3QJyWQ7GvBqotGuNIL7YJZii2ZN8ynNxI0n-SwmfZ81HoXvsBSMGhXatL8jIpqalbwmkoE0_H4z-YEnZ_ebQWsYkUEcf2rlsqhKa6TIlESMT6rh31_SMfc90zj9cEZzzroi0jKUoMBdRmTqdfaNzwL5vn-5kgUQUsVa73a9O5BKPmakgJ9Y11RuT5133-zYZSSM1WUPKMnjA0Bcw&sa=X&ved=2ahUKEwjOs8-Qu_eGAxVEKxAIHTOHD2gQs6gLegQIDxAB&biw=375&bih=713&dpr=3#ip=1

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne
Przełożone: 1×$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 107, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [108] Posprzątać szafkę w biurku w Katowicach
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Posprzątać szafkę w biurku w Katowicach$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne
Przełożone: 1×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-06T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 108, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [109] Określić swój poziom angielskiego
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Określić swój poziom angielskiego$v$, $v$https://eskk.pl/blog/jak-sprawdzic-swoj-poziom-angielskiego?gclid=CjwKCAjwv-GUBhAzEiwASUMm4od99QzLmYxwQZWeZYXK1EcjNGVqqXaznli1GbKwosUZyKenbaWSQxoCrsgQAvD_BwE

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 1×
Cykliczność (oryg.): co rok$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 109, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [110] umówić się na masaż do Gilowic lub gdzie indziej (jasmin kuków)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$umówić się na masaż do Gilowic lub gdzie indziej (jasmin kuków)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co miesiąc$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-20T00:00:00.000Z', NULL, NULL, 60, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 110, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [111] Wytrzeć kurze (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Wytrzeć kurze (Kocoń)$v$, $v$parapety, biurko, regał w salonie, drzwi + inne

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 3 tygodnie$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-04-18T00:00:00.000Z', NULL, NULL, 60, $v${"type": "WEEKLY", "interval": 3}$v$, 'Other', 111, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [112] umówić wymianę opon na letnie (Perła) - około 15 kwietnia
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$umówić wymianę opon na letnie (Perła) - około 15 kwietnia$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): 1 kwietnia$v$, 'TODO', 'LOW', TIMESTAMPTZ '2027-04-01T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 112, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód', 'Kocoń']);

  -- [113] umówić wymianę opon na letnie (Potworek) - około 15 kwietnia
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$umówić wymianę opon na letnie (Potworek) - około 15 kwietnia$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'LOW', TIMESTAMPTZ '2027-04-01T00:00:00.000Z', NULL, NULL, 120, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 113, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [114] Kredyt - sprawdzić czy wszystko ok (w tym ubezpieczenie domu i Szymka)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Kredyt - sprawdzić czy wszystko ok (w tym ubezpieczenie domu i Szymka)$v$, $v$Gdyby co to tak pisałem ale potem było OK: Dzień dobry, Jaki jest rezultat sprawy PSW385248201? Przesłałem brakujący dokument ("Potwierdzenie zaktualizowania oznaczenia w księdze wieczystej"). Dokument długo był w statusie "analizowany" aż niedawno ślad po tym zaginął i znowu mam tylko komunikat, że dokument nie został wysłany.

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Przełożone: 4×
Cykliczność (oryg.): co 5 maja$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 12, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 114, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [115] Raj umówić kardiolog na echo
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj umówić kardiolog na echo$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co 2 lata$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-05-10T00:00:00.000Z', NULL, NULL, NULL, $v${"type": "YEARLY", "interval": 2}$v$, 'Other', 115, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [116] Czyszczenie odpływów (sprawdzić wszystkie) - Kocoń
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Czyszczenie odpływów (sprawdzić wszystkie) - Kocoń$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co miesiąc$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-04T00:00:00.000Z', NULL, NULL, 30, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 116, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [117] Sprawdzić czy w lodówce jest nadmiar wody i przeczyścić (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Sprawdzić czy w lodówce jest nadmiar wody i przeczyścić (Kocoń)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co miesiąc$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-04-22T00:00:00.000Z', NULL, NULL, 30, $v${"type": "MONTHLY", "interval": 1}$v$, 'Other', 117, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [118] Umówić naprawę domofonu
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Umówić naprawę domofonu$v$, $v$sprawdzić i zgłosić do spółdzielni

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne
Przełożone: 1×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 118, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [119] Test zdolności poznawczych i zaburzeń osobowościowych
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Test zdolności poznawczych i zaburzeń osobowościowych$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 6×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 119, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [120] Działka Jeleśnia, sprawdzić ceny działek
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Działka Jeleśnia, sprawdzić ceny działek$v$, $v$Dowiedzieć się czy sprzedaż wymaga podatku jeśli to idzie na remont. Jeśli tak to zastanowić się co dalej, czy sprzedać czy uzbroić czy wyrównać (ile to kosztuje)

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 120, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [121] Raj - szczepienie - termin do 19 sierpnia (wścieklizna, zakaźne, lepto
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - szczepienie - termin do 19 sierpnia (wścieklizna, zakaźne, leptospiroza)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-07-19T00:00:00.000Z', NULL, NULL, 120, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 121, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj']);

  -- [122] Znaleźć kameralne koncerty zagranicznych artystow
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Znaleźć kameralne koncerty zagranicznych artystow$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Przełożone: 1×
Cykliczność (oryg.): co rok$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 122, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [123] Umówić serwis auta (Potworek)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Umówić serwis auta (Potworek)$v$, $v$badanie techniczne jest ważne do 17 września

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): co rok$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-08-10T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 123, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [124] Przerzucić kompost
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Przerzucić kompost$v$, $v$najlepiej wtedy kiedy koszenie trawy

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co ile trzeba$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-16T00:00:00.000Z', NULL, NULL, 90, NULL, 'Other', 124, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [125] Czyszczenie odpływów (sprawdzić wszystkie) - Katowice
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Czyszczenie odpływów (sprawdzić wszystkie) - Katowice$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 miesiące$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-06-02T00:00:00.000Z', NULL, NULL, 30, $v${"type": "MONTHLY", "interval": 2}$v$, 'Other', 125, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [126] wyczyścić filtr w zmywarce (Kocoń)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$wyczyścić filtr w zmywarce (Kocoń)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co pół roku$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-15T00:00:00.000Z', NULL, NULL, 30, $v${"type": "MONTHLY", "interval": 6}$v$, 'Other', 126, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [127] Wymyśleć prezenty dla wszystkich na kolejną okazję
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Wymyśleć prezenty dla wszystkich na kolejną okazję$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Cykliczność (oryg.): co rok (24 października)$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 180, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 127, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [128] Odczyt prądu (Katowice) - Asia - 14 dnia nieparzystego miesiąca
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Odczyt prądu (Katowice) - Asia - 14 dnia nieparzystego miesiąca$v$, $v$Maksymalnie 22 dnia nieparzystego miesiąca

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 miesiące nieparzyste) 10 dnia$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-05-10T00:00:00.000Z', NULL, NULL, 12, $v${"type": "MONTHLY", "interval": 2}$v$, 'Other', 128, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [129] Wyczyścić odkurzacz ręczny
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Wyczyścić odkurzacz ręczny$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 10 tygodni$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-27T00:00:00.000Z', NULL, NULL, 30, $v${"type": "WEEKLY", "interval": 10}$v$, 'Other', 129, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [130] Poodkładać rzeczy na miejsca (Katowice)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Poodkładać rzeczy na miejsca (Katowice)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): wt$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-06-02T00:00:00.000Z', NULL, NULL, 30, $v${"type": "WEEKLY", "interval": 1, "daysOfWeek": [2]}$v$, 'Other', 130, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Katowice']);

  -- [131] Umówić serwis pompy ciepła (przegląd ważny do 21 maja) - duplikat???
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Umówić serwis pompy ciepła (przegląd ważny do 21 maja) - duplikat???$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Przełożone: 1×
Cykliczność (oryg.): co rok (21 kwiettnia)$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2027-04-21T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 131, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [132] Umówić serwis auta (Perła)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Umówić serwis auta (Perła)$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok 25 listopada$v$, 'TODO', 'URGENT', TIMESTAMPTZ '2026-12-01T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 132, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [133] Umówić się z kimś na pizzę lub gdziekolwiek
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Umówić się z kimś na pizzę lub gdziekolwiek$v$, $v$micia/zielak/olek/kwiatkowa-ekipa/monika/steriole/błażej...

— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 miesiące$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-05-06T00:00:00.000Z', NULL, NULL, 60, $v${"type": "MONTHLY", "interval": 2}$v$, 'Other', 133, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [134] Kupić szafkę balkonową (do Katowic)
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Kupić szafkę balkonową (do Katowic)$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie
Przełożone: 1×$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 134, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom']);

  -- [135] Odczyt prądu (Kocoń) - Asia 20 dnia miesiąca
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Odczyt prądu (Kocoń) - Asia 20 dnia miesiąca$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Łatwe
Cykliczność (oryg.): do 22 dnia nieparzystego miesiąca$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-05-22T00:00:00.000Z', NULL, NULL, 18, $v${"type": "MONTHLY", "interval": 2}$v$, 'Other', 135, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [136] Tworzyć grę
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Tworzyć grę$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Cykliczność (oryg.): co tydzień$v$, 'TODO', 'NONE', TIMESTAMPTZ '2026-09-08T00:00:00.000Z', NULL, NULL, 180, $v${"type": "WEEKLY", "interval": 1}$v$, 'Other', 136, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [137] zdecydować co z paluchem
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$zdecydować co z paluchem$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Trudne$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2026-10-01T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 137, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['zdrowie']);

  -- [138] AC (Perła) - termin do 7 listopada
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$AC (Perła) - termin do 7 listopada$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-10-24T00:00:00.000Z', NULL, NULL, 30, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 138, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [139] Feedly - monitorowanie wiadomości
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Feedly - monitorowanie wiadomości$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 139, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [140] Przygotować i przetestować odśnieżarkę na sezon
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Przygotować i przetestować odśnieżarkę na sezon$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 lata$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2026-11-03T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 2}$v$, 'Other', 140, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  -- [141] wymiana opon na zimowe (Potworek) - około 15 listopada
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$wymiana opon na zimowe (Potworek) - około 15 listopada$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-11-15T00:00:00.000Z', NULL, NULL, 120, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 141, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [142] wymiana opon na zimowe (Perła) - około 15 listopada
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$wymiana opon na zimowe (Perła) - około 15 listopada$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-11-15T00:00:00.000Z', NULL, NULL, 120, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 142, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['samochód']);

  -- [143] Apka do tworzenia planów domów RTG? - zweryfikować pomysł
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Apka do tworzenia planów domów RTG? - zweryfikować pomysł$v$, $v$Wykonać zdjęcia domu pod różnymi kątami czymś co przenika przez ściany i pokazuje strukturę budynku. Zrobić analogiczne zdjęcia w normalny sposób. AI przeanalizuje zdjęcia by wyznaczyć model 3D na podstawie wykrycia na zdjęciach krawędzi ścian i naśnieżone na model 3D kolory odpowiednie do tych z normalnych zdjęć. Na tej podstawie można byłoby generować projekty rzutów domu z wymiarami a nawet naniesionymi na nie instalacjami hydraulicznymi i morze elektrycznymi. Możliwe że aby dobrze zmapować dom to trzeba będzie powstawiać do niego jakieś elementy dzięki którym AI będzie się łatwiej zorientować przestrzennie analizując zdjęcia.

— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 60, NULL, 'Other', 143, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['pomysły']);

  -- [144] Ubezpieczenie na firmie OCD
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Ubezpieczenie na firmie OCD$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co rok$v$, 'TODO', 'HIGH', TIMESTAMPTZ '2027-01-05T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 1}$v$, 'Other', 144, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['praca']);

  -- [145] Roda lub spotkanie capo-emerytów - napisać do Pieca, Virusa itd
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Roda lub spotkanie capo-emerytów - napisać do Pieca, Virusa itd$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'LOW', TIMESTAMPTZ '2027-02-08T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 145, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [146] Raj - mycie
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Raj - mycie$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Trudne
Cykliczność (oryg.): co 3 miesiące$v$, 'TODO', 'LOW', TIMESTAMPTZ '2026-06-28T00:00:00.000Z', NULL, NULL, 90, $v${"type": "MONTHLY", "interval": 3}$v$, 'Other', 146, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['raj', 'Kocoń']);

  -- [147] Samolot z papieru https://fb.watch/kp7N2_zwlM/d
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$Samolot z papieru https://fb.watch/kp7N2_zwlM/d$v$, $v$— Meta (z arkusza) —
Typ: jednorazowe
Poziom trudności: Średnie$v$, 'TODO', 'NONE', TIMESTAMPTZ '2026-03-28T00:00:00.000Z', NULL, NULL, 120, NULL, 'Other', 147, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['inne']);

  -- [148] SERWIS sprzętu Kosiarki / odśnieżarki
  v_task_id := gen_random_uuid()::text;
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")
  VALUES (v_task_id, $v$SERWIS sprzętu Kosiarki / odśnieżarki$v$, $v$— Meta (z arkusza) —
Typ: cykliczne
Poziom trudności: Średnie
Cykliczność (oryg.): co 2 lata$v$, 'TODO', 'MEDIUM', TIMESTAMPTZ '2027-09-23T00:00:00.000Z', NULL, NULL, 60, $v${"type": "YEARLY", "interval": 2}$v$, 'Other', 148, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY['dom', 'Kocoń']);

  RAISE NOTICE 'Import LZ: wstawiono 149 zadań do projektu LZ (%).', v_project_id;
END
$LZ_IMPORT$;
