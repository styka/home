-- 020: data ostatniego wykonania zadania (dla widocznego sortu „Zrobione" i dla
-- zadań cyklicznych — kolejne wystąpienie niesie datę wykonania poprzedniego).
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastCompletedAt" TIMESTAMP(3);
