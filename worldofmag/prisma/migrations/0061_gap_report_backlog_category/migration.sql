-- Nadanie raportowi luk wyrazistej nazwy + dedykowanej kategorii "backlog",
-- żeby rzucał się w oczy w /reports i /admin/reports jako lista zadań na przyszłość.
-- Treść pozostaje z migracji 0060 (ten sam slug). UPDATE jest idempotentny.

UPDATE "Report"
SET
  "title" = '🚧 BACKLOG LUK — do załatania w przyszłości (Omnia vs architektura 2026-05-31)',
  "category" = 'backlog',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'omnia-luki-wdrozeniowe-2026-06-01';
