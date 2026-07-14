-- Z-031: indeksy złożone/proste pod realne zapytania list (P1).
-- Task i Item nie miały ŻADNEGO indeksu → pełne skany przy każdym widoku
-- (lista zadań projektu, podzadania, widoki wirtualne; lista zakupów).
-- IF NOT EXISTS — idempotentnie pomijamy ewentualne istniejące (dryf).

-- Task: główny widok listy (projectId + parentTaskId IS NULL), podzadania,
-- widoki wirtualne (createdById), filtr „przypisane do mnie" (assigneeId).
CREATE INDEX IF NOT EXISTS "Task_projectId_parentTaskId_idx" ON "Task"("projectId", "parentTaskId");
CREATE INDEX IF NOT EXISTS "Task_parentTaskId_idx" ON "Task"("parentTaskId");
CREATE INDEX IF NOT EXISTS "Task_createdById_idx" ON "Task"("createdById");
CREATE INDEX IF NOT EXISTS "Task_assigneeId_idx" ON "Task"("assigneeId");

-- TaskComment / TaskShare: ładowane i kasowane po taskId; userId pod purge/„udostępnione mi".
CREATE INDEX IF NOT EXISTS "TaskComment_taskId_idx" ON "TaskComment"("taskId");
CREATE INDEX IF NOT EXISTS "TaskComment_userId_idx" ON "TaskComment"("userId");
CREATE INDEX IF NOT EXISTS "TaskShare_taskId_idx" ON "TaskShare"("taskId");
CREATE INDEX IF NOT EXISTS "TaskShare_userId_idx" ON "TaskShare"("userId");

-- Item (zakupy): filtr (listId, status) — NEEDED do widoku, DONE do czyszczenia.
CREATE INDEX IF NOT EXISTS "Item_listId_status_idx" ON "Item"("listId", "status");
