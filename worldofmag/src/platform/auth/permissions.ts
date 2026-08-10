import type { Session } from "next-auth"

export const PERMISSIONS = {
  HOME:        "module.home",
  TASKS:       "module.tasks",
  SETTINGS:    "module.settings",
  ADMIN:       "module.admin",
  INVITATIONS: "module.invitations",
  CALENDAR:    "module.calendar",
  // Kitchen sub-permissions
  KITCHEN_RECIPE_CREATE: "kitchen.recipe.create",
  KITCHEN_RECIPE_EDIT:   "kitchen.recipe.edit",
  KITCHEN_RECIPE_DELETE: "kitchen.recipe.delete",
  KITCHEN_MEALPLAN_EDIT: "kitchen.mealplan.edit",
  KITCHEN_PANTRY_EDIT:   "kitchen.pantry.edit",
  KITCHEN_AI:            "kitchen.ai",
} as const

export type PermissionSlug = typeof PERMISSIONS[keyof typeof PERMISSIONS]

export function hasPermission(session: Session | null | undefined, slug: string): boolean {
  return session?.user?.permissions?.includes(slug) ?? false
}

/**
 * Mapowanie prefiksu ścieżki na wymagane uprawnienie — dla modułów JESZCZE NIEPRZENIESIONYCH
 * do `src/modules/` oraz dla powierzchni spoza rejestru modułów (ustawienia, admin, zaproszenia).
 *
 * 046: moduły przeniesione (Trasy TIR, Kontakty, Raporty, QA) NIE mają tu wpisu — ich ścieżka
 * i uprawnienie wynikają z `module.ts`. Platforma nie może ich odczytać sama, bo nie wolno jej
 * importować modułów (asymetria z rozdz. 7.1), więc składa to korzeń kompozycji:
 * `src/lib/pathPermissions.ts`. **Używaj tamtej funkcji, nie tej** — ta widzi tylko część aplikacji.
 */
export function legacyPermissionForPath(path: string): string | null {
  if (path === "/" || path === "") return PERMISSIONS.HOME
  if (path.startsWith("/tasks")) return PERMISSIONS.TASKS
  if (path.startsWith("/settings")) return PERMISSIONS.SETTINGS
  if (path.startsWith("/admin")) return PERMISSIONS.ADMIN
  if (path.startsWith("/invitations")) return PERMISSIONS.INVITATIONS
  if (path.startsWith("/calendar")) return PERMISSIONS.CALENDAR
  return null
}

/**
 * Czy użytkownikowi brakuje uprawnienia do ścieżki — wariant WIDZĄCY TYLKO część aplikacji
 * (patrz `legacyPermissionForPath`). W kodzie aplikacji używaj `isPathLocked`
 * z `@/lib/pathPermissions`, które zna także moduły zadeklarowane.
 */
export function legacyIsPathLocked(permissions: string[], path: string): boolean {
  const required = legacyPermissionForPath(path)
  if (!required) return false
  return !permissions.includes(required)
}
