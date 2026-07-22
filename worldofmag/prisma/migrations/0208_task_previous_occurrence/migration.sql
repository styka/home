-- 022: trwałe powiązanie kolejnego wystąpienia cyklicznego z domkniętym poprzednikiem.
-- Self-reference (nullable) na Task; SetNull, żeby usunięcie/soft-delete poprzednika
-- nie kaskadowało na następcę (spójne z parentTaskId).
ALTER TABLE "Task" ADD COLUMN "previousTaskId" TEXT;
CREATE INDEX "Task_previousTaskId_idx" ON "Task"("previousTaskId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_previousTaskId_fkey"
  FOREIGN KEY ("previousTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
