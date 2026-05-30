-- Przywrócenie dostępu administratora do panelu /admin (środowisko dev).
--
-- Kontekst: administrator przez przypadek odebrał sobie dostęp do panelu admina
-- w /admin/access (RBAC). Dostęp do całej sekcji /admin jest bramkowany wyłącznie
-- przez uprawnienie `module.admin`, które wynika z łańcucha:
--   UserRole(role='ADMIN') → RolePermission(role='ADMIN' → permissionId)
--                                       → Permission(slug='module.admin')
--
-- Nie wiadomo, które ogniwo zostało usunięte, więc migracja odtwarza wszystkie trzy
-- w sposób idempotentny (bezpieczna do wielokrotnego uruchomienia):
--   1. Uprawnienie `module.admin` istnieje.
--   2. Rola ADMIN ma przypisane `module.admin`.
--   3. Konto administratora ma rolę ADMIN.

-- 1. Upewnij się, że uprawnienie module.admin istnieje.
INSERT INTO "Permission" ("id", "slug", "name", "description")
SELECT gen_random_uuid()::text, 'module.admin', 'Panel admina', 'Dostęp do panelu administratora'
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "slug" = 'module.admin');

-- 2. Upewnij się, że rola ADMIN ma przypisane uprawnienie module.admin.
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'ADMIN', p."id"
FROM "Permission" p
WHERE p."slug" = 'module.admin'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."role" = 'ADMIN' AND rp."permissionId" = p."id"
  );

-- 3. Upewnij się, że konto administratora (tyka.szymon@gmail.com) ma rolę ADMIN.
INSERT INTO "UserRole" ("id", "userId", "role")
SELECT gen_random_uuid()::text, u."id", 'ADMIN'
FROM "User" u
WHERE u."email" = 'tyka.szymon@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM "UserRole" ur
    WHERE ur."userId" = u."id" AND ur."role" = 'ADMIN'
  );
