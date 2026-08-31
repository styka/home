-- 117: Nieusuwalność zasobów — wpis kosza dostaje status zamiast twardego DELETE.
-- "active" | "emptied" | "expired" | "restored"; wiersze nigdy nie znikają (wyjątek: RODO,
-- kaskada po User). Admin przywraca w /admin/kosz.
ALTER TABLE "TrashItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "TrashItem" ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE INDEX "TrashItem_status_deletedAt_idx" ON "TrashItem"("status", "deletedAt");
