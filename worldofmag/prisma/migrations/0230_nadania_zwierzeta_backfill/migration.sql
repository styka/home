-- Zadanie 12 przebudowy — TRZECIA tabela udostępnień: `PetShare` → `ResourceGrant`.
--
-- 059 przeniosło udostępnienia Zadań, ale `PetShare` musiał poczekać: nadanie dla typu `pets.pet`
-- nic nie daje, dopóki `resolveRole` tego typu nie zna. Deklarację zasobu Zwierząt dołożyło 060,
-- więc dopiero teraz migracja przenosi udostępnianie, zamiast je odbierać.
--
-- Ta sama trójetapowa droga: (1) zapisywać obok ← TA MIGRACJA, (2) przełączyć odczyty z tabelą
-- prawdy, (3) usunąć starą tabelę.
--
-- CO TA MIGRACJA ROBI APLIKACJI: nic. Nadania są zapisywane i NIECZYTANE — dostęp do zwierzęcia
-- rozstrzyga `extraGrants` czytające `PetShare`.
--
-- ODWZOROWANIE RÓL (rozdz. 8.10): EDITOR → editor, VIEWER → viewer. To samo, co
-- `resourceRoleFromLegacy` w kodzie — zmiana jednego bez drugiego jest błędem.
--
-- Wycofanie: DELETE FROM "ResourceGrant" WHERE "resourceType" = 'pets.pet'.

-- ═══ 1. Udostępnienia OSOBIE ═══
INSERT INTO "ResourceGrant" (
  "id", "workspaceId", "resourceType", "resourceId", "subjectType", "subjectId",
  "role", "inherited", "expiresAt", "createdById", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  p."workspaceId",
  'pets.pet',
  s."petId",
  'user',
  s."userId",
  CASE s."role" WHEN 'EDITOR' THEN 'editor' ELSE 'viewer' END,
  false,
  NULL,
  COALESCE(p."ownerId", s."userId"),
  s."createdAt"
FROM "PetShare" s
JOIN "Pet" p ON p."id" = s."petId"
WHERE s."userId" IS NOT NULL AND p."workspaceId" IS NOT NULL
ON CONFLICT ("resourceType", "resourceId", "subjectType", "subjectId") DO NOTHING;

-- ═══ 2. Udostępnienia ZESPOŁOWI → nadanie dla jego PRZESTRZENI ═══
--
-- `subjectType = 'workspace'` obejmuje skład zespołu automatycznie, także po jego zmianie —
-- inaczej niż `extraGrants`, które musi dziś rozwijać udostępnienie na członków po jednym.
INSERT INTO "ResourceGrant" (
  "id", "workspaceId", "resourceType", "resourceId", "subjectType", "subjectId",
  "role", "inherited", "expiresAt", "createdById", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  p."workspaceId",
  'pets.pet',
  s."petId",
  'workspace',
  tw."id",
  CASE s."role" WHEN 'EDITOR' THEN 'editor' ELSE 'viewer' END,
  false,
  NULL,
  COALESCE(p."ownerId", tw."id"),
  s."createdAt"
FROM "PetShare" s
JOIN "Pet" p ON p."id" = s."petId"
JOIN "Workspace" tw ON tw."teamId" = s."teamId"
WHERE s."teamId" IS NOT NULL AND p."workspaceId" IS NOT NULL
ON CONFLICT ("resourceType", "resourceId", "subjectType", "subjectId") DO NOTHING;
