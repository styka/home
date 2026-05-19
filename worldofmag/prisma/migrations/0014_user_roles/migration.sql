-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Give BETA_TESTER role to all existing users
INSERT INTO "UserRole" ("id", "userId", "role")
SELECT gen_random_uuid()::text, "id", 'BETA_TESTER'
FROM "User"
ON CONFLICT DO NOTHING;

-- Give USER role to current admin (tyka.szymon@gmail.com)
INSERT INTO "UserRole" ("id", "userId", "role")
SELECT gen_random_uuid()::text, "id", 'USER'
FROM "User"
WHERE "email" = 'tyka.szymon@gmail.com'
ON CONFLICT DO NOTHING;

-- Give ADMIN role to current admin
INSERT INTO "UserRole" ("id", "userId", "role")
SELECT gen_random_uuid()::text, "id", 'ADMIN'
FROM "User"
WHERE "email" = 'tyka.szymon@gmail.com'
ON CONFLICT DO NOTHING;

-- Give USER role to users with 'truelife' in their name
INSERT INTO "UserRole" ("id", "userId", "role")
SELECT gen_random_uuid()::text, "id", 'USER'
FROM "User"
WHERE LOWER("name") LIKE '%truelife%'
  AND "email" != 'tyka.szymon@gmail.com'
ON CONFLICT DO NOTHING;
