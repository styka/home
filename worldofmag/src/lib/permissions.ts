import type { Session } from "next-auth"

export const PERMISSIONS = {
  HOME:        "module.home",
  SHOPPING:    "module.shopping",
  TASKS:       "module.tasks",
  NOTES:       "module.notes",
  SETTINGS:    "module.settings",
  ADMIN:       "module.admin",
  INVITATIONS: "module.invitations",
} as const

export type PermissionSlug = typeof PERMISSIONS[keyof typeof PERMISSIONS]

export function hasPermission(session: Session | null | undefined, slug: string): boolean {
  return session?.user?.permissions?.includes(slug) ?? false
}

/** Maps a path prefix to its required permission slug */
export function permissionForPath(path: string): string | null {
  if (path === "/" || path === "") return PERMISSIONS.HOME
  if (path.startsWith("/shopping")) return PERMISSIONS.SHOPPING
  if (path.startsWith("/tasks")) return PERMISSIONS.TASKS
  if (path.startsWith("/notes")) return PERMISSIONS.NOTES
  if (path.startsWith("/settings")) return PERMISSIONS.SETTINGS
  if (path.startsWith("/admin")) return PERMISSIONS.ADMIN
  if (path.startsWith("/invitations")) return PERMISSIONS.INVITATIONS
  return null
}

/** Returns true if the user lacks permission to access the given path */
export function isPathLocked(permissions: string[], path: string): boolean {
  const required = permissionForPath(path)
  if (!required) return false
  return !permissions.includes(required)
}
