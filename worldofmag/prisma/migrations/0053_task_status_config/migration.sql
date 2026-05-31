-- Konfigurowalne statusy zadań per lista (TaskProject).
-- statusConfig: JSON { enabled: TaskStatus[], chain: TaskStatus[] }; NULL = domyślne statusy systemowe
-- (TODO, IN_PROGRESS, DONE, DEFERRED, CANCELLED; bez „W weryfikacji"/IN_VERIFICATION).

-- AlterTable
ALTER TABLE "TaskProject" ADD COLUMN "statusConfig" TEXT;
