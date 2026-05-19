CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_slug_key" ON "Permission"("slug");

CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed 7 permissions
INSERT INTO "Permission" ("id", "slug", "name", "description") VALUES
  (gen_random_uuid()::text, 'module.home',        'Strona główna', 'Dostęp do strony głównej aplikacji'),
  (gen_random_uuid()::text, 'module.shopping',    'Zakupy',        'Dostęp do modułu zakupów'),
  (gen_random_uuid()::text, 'module.tasks',       'Zadania',       'Dostęp do modułu zadań'),
  (gen_random_uuid()::text, 'module.notes',       'Notatki',       'Dostęp do modułu notatek'),
  (gen_random_uuid()::text, 'module.settings',    'Ustawienia',    'Dostęp do ustawień konta'),
  (gen_random_uuid()::text, 'module.admin',       'Panel admina',  'Dostęp do panelu administratora'),
  (gen_random_uuid()::text, 'module.invitations', 'Zaproszenia',   'Dostęp do zaproszeń do zespołów');

-- BETA_TESTER: home + shopping + settings
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'BETA_TESTER', p."id"
FROM "Permission" p WHERE p."slug" IN ('module.home', 'module.shopping', 'module.settings');

-- USER: home + shopping + tasks + notes + settings + invitations
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'USER', p."id"
FROM "Permission" p WHERE p."slug" IN ('module.home', 'module.shopping', 'module.tasks', 'module.notes', 'module.settings', 'module.invitations');

-- ADMIN: all permissions
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'ADMIN', p."id"
FROM "Permission" p;
