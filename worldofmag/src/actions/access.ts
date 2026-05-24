"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

async function requireAdmin() {
  const session = await auth()
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden")
  return session!
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
  revalidatePath("/admin/access")
}

export async function updatePermission(id: string, name: string, description?: string): Promise<void> {
  await requireAdmin()
  await prisma.permission.update({ where: { id }, data: { name: name.trim(), description: description?.trim() || null } })
  revalidatePath("/admin/access")
}

export async function deletePermission(id: string): Promise<void> {
  await requireAdmin()
  await prisma.permission.delete({ where: { id } })
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
    await prisma.rolePermission.delete({ where: { id: existing.id } })
  } else {
    await prisma.rolePermission.create({ data: { role, permissionId: perm.id } })
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
  revalidatePath("/admin/access")
}

export async function removeUserRole(userId: string, role: string): Promise<void> {
  await requireAdmin()
  await prisma.userRole.delete({ where: { userId_role: { userId, role } } })
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
