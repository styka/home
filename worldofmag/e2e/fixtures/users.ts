// E2E test users and their storage-state files.
export const E2E_ADMIN = {
  email: "e2e-admin@worldofmag.test",
  name: "E2E Admin",
  // Has ADMIN + all module/kitchen permissions → can reach every route.
  roles: ["ADMIN", "BETA_TESTER", "TESTER", "E2E_ALL"],
  storageState: "e2e/.auth/admin.json",
};

export const E2E_LIMITED = {
  email: "e2e-limited@worldofmag.test",
  name: "E2E Limited",
  // Only module.home → used for permission-gating / lock scenarios.
  roles: ["E2E_LIMITED"],
  storageState: "e2e/.auth/limited.json",
};

// Every permission slug in the app (mirrors src/lib/permissions.ts PERMISSIONS).
export const ALL_PERMISSIONS: { slug: string; name: string }[] = [
  { slug: "module.home", name: "Strona główna" },
  { slug: "module.shopping", name: "Zakupy" },
  { slug: "module.tasks", name: "Zadania" },
  { slug: "module.notes", name: "Notatki" },
  { slug: "module.kitchen", name: "Kuchnia" },
  { slug: "module.settings", name: "Ustawienia" },
  { slug: "module.admin", name: "Admin" },
  { slug: "module.invitations", name: "Zaproszenia" },
  { slug: "module.qa", name: "Dział QA" },
  { slug: "kitchen.recipe.create", name: "Kuchnia: tworzenie przepisów" },
  { slug: "kitchen.recipe.edit", name: "Kuchnia: edycja przepisów" },
  { slug: "kitchen.recipe.delete", name: "Kuchnia: usuwanie przepisów" },
  { slug: "kitchen.mealplan.edit", name: "Kuchnia: edycja planu" },
  { slug: "kitchen.pantry.edit", name: "Kuchnia: edycja spiżarni" },
  { slug: "kitchen.ai", name: "Kuchnia: funkcje AI" },
];

// E2E_ALL gets everything; E2E_LIMITED only the home module.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  E2E_ALL: ALL_PERMISSIONS.map((p) => p.slug),
  ADMIN: ALL_PERMISSIONS.map((p) => p.slug),
  E2E_LIMITED: ["module.home"],
};
