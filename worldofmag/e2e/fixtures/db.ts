import { PrismaClient } from "@prisma/client";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, E2E_ADMIN, E2E_LIMITED } from "./users";

const prisma = new PrismaClient();

/**
 * Idempotently provisions the E2E users, all permission rows, and the
 * role→permission grants required so the test users can reach every route.
 * Safe to run repeatedly.
 */
export async function ensureE2EFixtures(): Promise<void> {
  // 1) Permissions
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, name: p.name },
      update: { name: p.name },
    });
  }

  // 2) Role → permission grants
  for (const [role, slugs] of Object.entries(ROLE_PERMISSIONS)) {
    for (const slug of slugs) {
      const perm = await prisma.permission.findUnique({ where: { slug } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: perm.id } },
        create: { role, permissionId: perm.id },
        update: {},
      });
    }
  }

  // 3) Users + their roles
  for (const u of [E2E_ADMIN, E2E_LIMITED]) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, role: u.roles.includes("ADMIN") ? "ADMIN" : "USER" },
      update: { name: u.name },
    });
    for (const role of u.roles) {
      await prisma.userRole.upsert({
        where: { userId_role: { userId: user.id, role } },
        create: { userId: user.id, role },
        update: {},
      });
    }
  }
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
