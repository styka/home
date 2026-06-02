import type { Session } from "next-auth"

export const PERMISSIONS = {
  HOME:        "module.home",
  SHOPPING:    "module.shopping",
  TASKS:       "module.tasks",
  NOTES:       "module.notes",
  KITCHEN:     "module.kitchen",
  SETTINGS:    "module.settings",
  ADMIN:       "module.admin",
  INVITATIONS: "module.invitations",
  QA:          "module.qa",
  TRUCK:       "module.truck",
  PETS:        "module.pets",
  FLOTA:       "module.flota",
  PORTFEL:     "module.portfel",
  LANGUAGES:   "module.languages",
  HEALTH:      "module.health",
  HABITS:      "module.habits",
  SERVICES:    "module.services",
  CALENDAR:    "module.calendar",
  NEWS:        "module.news",
  WEATHER:     "module.weather",
  MAGAZYNOWANIE: "module.magazynowanie",
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

/** Maps a path prefix to its required permission slug */
export function permissionForPath(path: string): string | null {
  if (path === "/" || path === "") return PERMISSIONS.HOME
  if (path.startsWith("/shopping")) return PERMISSIONS.SHOPPING
  if (path.startsWith("/tasks")) return PERMISSIONS.TASKS
  if (path.startsWith("/notes")) return PERMISSIONS.NOTES
  if (path.startsWith("/kitchen")) return PERMISSIONS.KITCHEN
  if (path.startsWith("/settings")) return PERMISSIONS.SETTINGS
  if (path.startsWith("/admin")) return PERMISSIONS.ADMIN
  if (path.startsWith("/invitations")) return PERMISSIONS.INVITATIONS
  if (path.startsWith("/qa")) return PERMISSIONS.QA
  if (path.startsWith("/truck")) return PERMISSIONS.TRUCK
  if (path.startsWith("/pets")) return PERMISSIONS.PETS
  if (path.startsWith("/flota")) return PERMISSIONS.FLOTA
  if (path.startsWith("/portfel")) return PERMISSIONS.PORTFEL
  if (path.startsWith("/languages")) return PERMISSIONS.LANGUAGES
  if (path.startsWith("/health")) return PERMISSIONS.HEALTH
  if (path.startsWith("/habits")) return PERMISSIONS.HABITS
  if (path.startsWith("/services")) return PERMISSIONS.SERVICES
  if (path.startsWith("/calendar")) return PERMISSIONS.CALENDAR
  if (path.startsWith("/wiadomosci")) return PERMISSIONS.NEWS
  if (path.startsWith("/pogoda")) return PERMISSIONS.WEATHER
  if (path.startsWith("/magazynowanie")) return PERMISSIONS.MAGAZYNOWANIE
  return null
}

/** Returns true if the user lacks permission to access the given path */
export function isPathLocked(permissions: string[], path: string): boolean {
  const required = permissionForPath(path)
  if (!required) return false
  return !permissions.includes(required)
}
