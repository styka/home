"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { keysetQuery, keysetResult, type KeysetPage } from "@/lib/pagination"

async function requireAdmin() {
  const session = await auth()
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden")
  return session!
}

const ADMIN_PERM_SLUG = PERMISSIONS.ADMIN // "module.admin" — brama do całej sekcji /admin

/**
 * Liczy odrębnych użytkowników, którzy mają dostęp do panelu administratora,
 * czyli posiadają co najmniej jedną rolę przyznającą `module.admin`.
 *
 * Zabezpieczenie przed self-lockoutem (patrz doświadczenia.md, 2026-05-30):
 * admin nie może operacją RBAC doprowadzić do stanu, w którym nikt nie ma już
 * dostępu do /admin. Opcjonalnie symuluje hipotetyczną zmianę:
 *  - `excludeRoleGrant`: udawaj, że ta rola NIE przyznaje już `module.admin`,
 *  - `removeUserRole`: udawaj, że ten użytkownik stracił tę rolę.
 */
async function countAdminAccessHolders(opts?: {
  excludeRoleGrant?: string
  removeUserRole?: { userId: string; role: string }
}): Promise<number> {
  const perm = await prisma.permission.findUnique({ where: { slug: ADMIN_PERM_SLUG }, select: { id: true } })
  if (!perm) return 0

  let adminRoles = (
    await prisma.rolePermission.findMany({ where: { permissionId: perm.id }, select: { role: true } })
  ).map((g) => g.role)
  if (opts?.excludeRoleGrant) adminRoles = adminRoles.filter((r) => r !== opts.excludeRoleGrant)
  if (adminRoles.length === 0) return 0

  const userRoles = await prisma.userRole.findMany({
    where: { role: { in: adminRoles } },
    select: { userId: true, role: true },
  })
  const holders = new Set<string>()
  for (const ur of userRoles) {
    if (
      opts?.removeUserRole &&
      ur.userId === opts.removeUserRole.userId &&
      ur.role === opts.removeUserRole.role
    ) {
      continue
    }
    holders.add(ur.userId)
  }
  return holders.size
}

// --- Permissions ---

export type PermissionData = {
  id: string
  slug: string
  name: string
  description: string | null
  createdAt: Date
}

export async function getPermissions(): Promise<PermissionData[]> {
  await requireAdmin()
  return prisma.permission.findMany({ orderBy: { slug: "asc" } })
}

export async function createPermission(slug: string, name: string, description?: string): Promise<void> {
  await requireAdmin()
  await prisma.permission.create({ data: { slug: slug.trim(), name: name.trim(), description: description?.trim() || null } })
  await logAudit("rbac", "permission.create", slug.trim(), `Utworzono uprawnienie „${name.trim()}”`)
  revalidatePath("/admin/access")
}

export async function updatePermission(id: string, name: string, description?: string): Promise<void> {
  await requireAdmin()
  const perm = await prisma.permission.update({ where: { id }, data: { name: name.trim(), description: description?.trim() || null } })
  await logAudit("rbac", "permission.update", perm.slug, `Zmieniono uprawnienie „${name.trim()}”`)
  revalidatePath("/admin/access")
}

export async function deletePermission(id: string): Promise<void> {
  await requireAdmin()
  const perm = await prisma.permission.findUnique({ where: { id }, select: { slug: true } })
  if (perm?.slug === ADMIN_PERM_SLUG && (await countAdminAccessHolders()) > 0) {
    throw new Error(
      "Nie można usunąć uprawnienia „module.admin” — to brama dostępu do panelu administratora.",
    )
  }
  await prisma.permission.delete({ where: { id } })
  await logAudit("rbac", "permission.delete", perm?.slug ?? id, `Usunięto uprawnienie`)
  revalidatePath("/admin/access")
}

// --- Role Permissions ---

export type RoleWithPermissions = {
  role: string
  permissions: string[] // slugs
}

export async function getRolePermissions(): Promise<RoleWithPermissions[]> {
  await requireAdmin()
  // Get all distinct roles from UserRole
  const userRoles = await prisma.userRole.findMany({ select: { role: true }, distinct: ["role"] })
  const roles = userRoles.map((r) => r.role)

  const rolePerms = await prisma.rolePermission.findMany({
    where: { role: { in: roles } },
    select: { role: true, permission: { select: { slug: true } } },
  })

  const map: Record<string, string[]> = {}
  for (const r of roles) map[r] = []
  for (const rp of rolePerms) {
    if (map[rp.role]) map[rp.role].push(rp.permission.slug)
  }

  return roles.sort().map((r) => ({ role: r, permissions: map[r] }))
}

export async function toggleRolePermission(role: string, permissionSlug: string): Promise<void> {
  await requireAdmin()
  const perm = await prisma.permission.findUnique({ where: { slug: permissionSlug } })
  if (!perm) throw new Error("Permission not found")
  const existing = await prisma.rolePermission.findUnique({
    where: { role_permissionId: { role, permissionId: perm.id } },
  })
  if (existing) {
    // Nie pozwól odebrać module.admin, jeśli zostawiłoby to nikogo bez dostępu do /admin.
    if (permissionSlug === ADMIN_PERM_SLUG) {
      const before = await countAdminAccessHolders()
      if (before > 0 && (await countAdminAccessHolders({ excludeRoleGrant: role })) === 0) {
        throw new Error(
          "Nie można odebrać „module.admin” tej roli — żaden użytkownik nie miałby już dostępu do panelu administratora.",
        )
      }
    }
    await prisma.rolePermission.delete({ where: { id: existing.id } })
    await logAudit("rbac", "role_permission.revoke", role, `Odebrano „${permissionSlug}” roli ${role}`)
  } else {
    await prisma.rolePermission.create({ data: { role, permissionId: perm.id } })
    await logAudit("rbac", "role_permission.grant", role, `Nadano „${permissionSlug}” roli ${role}`)
  }
  revalidatePath("/admin/access")
}

// --- Users ---

export type UserData = {
  id: string
  name: string | null
  email: string | null
  roles: string[]
  createdAt: Date
}

export async function getUsers(): Promise<UserData[]> {
  await requireAdmin()
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, createdAt: true, userRoles: { select: { role: true } } },
    orderBy: { createdAt: "desc" },
  })
  return users.map((u) => ({ ...u, roles: u.userRoles.map((r) => r.role) }))
}

export async function addUserRole(userId: string, role: string): Promise<void> {
  await requireAdmin()
  await prisma.userRole.upsert({
    where: { userId_role: { userId, role } },
    create: { userId, role },
    update: {},
  })
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  await logAudit("rbac", "user_role.add", userId, `Nadano rolę ${role} użytkownikowi ${u?.email ?? userId}`)
  revalidatePath("/admin/access")
}

export async function removeUserRole(userId: string, role: string): Promise<void> {
  await requireAdmin()
  // Nie pozwól usunąć roli, jeśli zostawiłoby to nikogo z dostępem do /admin.
  const before = await countAdminAccessHolders()
  if (before > 0 && (await countAdminAccessHolders({ removeUserRole: { userId, role } })) === 0) {
    throw new Error(
      "Nie można usunąć tej roli — żaden użytkownik nie miałby już dostępu do panelu administratora.",
    )
  }
  await prisma.userRole.delete({ where: { userId_role: { userId, role } } })
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  await logAudit("rbac", "user_role.remove", userId, `Odebrano rolę ${role} użytkownikowi ${u?.email ?? userId}`)
  revalidatePath("/admin/access")
}

export async function getAvailableRoles(): Promise<string[]> {
  await requireAdmin()
  const roles = await prisma.userRole.findMany({ select: { role: true }, distinct: ["role"] })
  const dbRoles = roles.map((r) => r.role)
  // Ensure built-in roles always appear in dropdowns even if nobody has them yet
  const builtin = ["ADMIN", "USER", "BETA_TESTER", "TESTER"]
  return Array.from(new Set([...dbRoles, ...builtin])).sort()
}

// --- A1: dziennik audytu ---

export type AuditEntry = {
  id: string
  actorEmail: string | null
  category: string
  action: string
  target: string | null
  detail: string | null
  createdAt: string
}

export async function getAuditLog(
  opts?: { category?: "rbac" | "config"; cursor?: string | null; limit?: number },
): Promise<KeysetPage<AuditEntry>> {
  await requireAdmin()
  // Z-070: paginacja keyset zamiast stałego `take: 200` — log audytu rośnie bez końca.
  const rows = await prisma.auditLog.findMany({
    where: opts?.category ? { category: opts.category } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...keysetQuery({ cursor: opts?.cursor, limit: opts?.limit }),
  })
  const mapped: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    actorEmail: r.actorEmail,
    category: r.category,
    action: r.action,
    target: r.target,
    detail: r.detail,
    createdAt: r.createdAt.toISOString(),
  }))
  return keysetResult(mapped, opts?.limit)
}
