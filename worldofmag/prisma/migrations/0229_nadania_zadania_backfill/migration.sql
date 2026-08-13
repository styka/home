-- Zadanie 12 przebudowy, ETAP 1 z TRZECH — udostępnienia Zadań jako `ResourceGrant`.
--
-- Rozdz. 8.10 wypisuje pięć mechanizmów udostępniania, które mają zniknąć na rzecz jednego.
-- `ResourceGrant` istnieje i JEST CZYTANY od 052 — ale jest pusty, więc dostęp członka projektu
-- przechodzi obok, przez `extraGrants` w deklaracji modułu.
--
-- Kolejność, ta sama co w zadaniu 11 i z tego samego powodu:
--   (1) zapisywać nadania OBOK istniejących tabel   ← TA MIGRACJA (rekordy istniejące)
--   (2) przełączyć odczyty, z tabelą prawdy         ← etap 2
--   (3) usunąć stare tabele                         ← etap 3
--
-- CO TA MIGRACJA ROBI APLIKACJI: nic. Nadania są zapisywane i NIECZYTANE — dostęp nadal
-- rozstrzygają `extraGrants` i dzisiejsze guardy.
--
-- ODWZOROWANIE RÓL (rozdz. 8.10): OWNER/ADMIN → manager, MEMBER/EDITOR → editor, VIEWER → viewer.
-- To samo odwzorowanie w kodzie: `resourceRoleFromLegacy` w `platform/workspaces/types.ts`.
-- Rozjazd między nimi dałby inne role rekordom starym i nowym — dlatego zmiana jednego bez
-- drugiego jest błędem.
--
-- PRZESTRZEŃ NADANIA to przestrzeń, w której żyje ZASÓB (nie ta, do której należy obdarowany).
-- Rekord bez przestrzeni (sierota po 0227) nie dostaje nadania: `ResourceGrant.workspaceId` jest
-- wymagane, a zmyślenie przestrzeni byłoby gorsze niż brak wiersza. Test to ZLICZA.
--
-- `createdById` = właściciel zasobu. Nadania historyczne nie mają zapisanego autora, a kolumna
-- nie ma klucza obcego właśnie po to, żeby przeżyć usunięcie konta.
--
-- Wycofanie: DELETE FROM "ResourceGrant" WHERE "resourceType" IN ('tasks.project','tasks.task').
-- Bezobjawowe — nic z tych nadań jeszcze nie czyta.

-- ═══ 1. Członkostwa w projektach → nadania na projekcie ═══
INSERT INTO "ResourceGrant" (
  "id", "workspaceId", "resourceType", "resourceId", "subjectType", "subjectId",
  "role", "inherited", "expiresAt", "createdById", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  p."workspaceId",
  'tasks.project',
  m."projectId",
  'user',
  m."userId",
  CASE m."role" WHEN 'OWNER' THEN 'manager' WHEN 'ADMIN' THEN 'manager' ELSE 'editor' END,
  false,
  NULL,
  COALESCE(p."ownerId", m."userId"),
  m."createdAt"
FROM "TaskProjectMember" m
JOIN "TaskProject" p ON p."id" = m."projectId"
WHERE p."workspaceId" IS NOT NULL
ON CONFLICT ("resourceType", "resourceId", "subjectType", "subjectId") DO NOTHING;

-- ═══ 2. Udostępnienia zadań OSOBIE → nadania na zadaniu ═══
--
-- `Task` nie ma kolumny `workspaceId` (własność zadania idzie przez `createdById` albo przez
-- projekt — dlatego migracja 0227 go nie objęła). Przestrzeń bierzemy więc z PROJEKTU, a dla
-- zadania bez projektu — z przestrzeni osobistej twórcy.
INSERT INTO "ResourceGrant" (
  "id", "workspaceId", "resourceType", "resourceId", "subjectType", "subjectId",
  "role", "inherited", "expiresAt", "createdById", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  COALESCE(p."workspaceId", w."id"),
  'tasks.task',
  s."taskId",
  'user',
  s."userId",
  CASE s."role" WHEN 'EDITOR' THEN 'editor' ELSE 'viewer' END,
  false,
  NULL,
  t."createdById",
  s."createdAt"
FROM "TaskShare" s
JOIN "Task" t ON t."id" = s."taskId"
LEFT JOIN "TaskProject" p ON p."id" = t."projectId"
LEFT JOIN "Workspace" w ON w."personalUserId" = t."createdById"
WHERE s."userId" IS NOT NULL
  AND COALESCE(p."workspaceId", w."id") IS NOT NULL
ON CONFLICT ("resourceType", "resourceId", "subjectType", "subjectId") DO NOTHING;

-- ═══ 3. Udostępnienia zadań ZESPOŁOWI → nadania dla PRZESTRZENI zespołu ═══
--
-- `subjectType = 'workspace'` to właśnie ten przypadek: dostęp dostaje przestrzeń, a nie osoba.
-- `resolveRole` czyta go z `ctx.workspaceIds`, więc obejmie każdego członka zespołu — dokładnie
-- tak, jak dziś działa `TaskShare.teamId`.
INSERT INTO "ResourceGrant" (
  "id", "workspaceId", "resourceType", "resourceId", "subjectType", "subjectId",
  "role", "inherited", "expiresAt", "createdById", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  COALESCE(p."workspaceId", w."id"),
  'tasks.task',
  s."taskId",
  'workspace',
  tw."id",
  CASE s."role" WHEN 'EDITOR' THEN 'editor' ELSE 'viewer' END,
  false,
  NULL,
  t."createdById",
  s."createdAt"
FROM "TaskShare" s
JOIN "Task" t ON t."id" = s."taskId"
JOIN "Workspace" tw ON tw."teamId" = s."teamId"
LEFT JOIN "TaskProject" p ON p."id" = t."projectId"
LEFT JOIN "Workspace" w ON w."personalUserId" = t."createdById"
WHERE s."teamId" IS NOT NULL
  AND COALESCE(p."workspaceId", w."id") IS NOT NULL
ON CONFLICT ("resourceType", "resourceId", "subjectType", "subjectId") DO NOTHING;
