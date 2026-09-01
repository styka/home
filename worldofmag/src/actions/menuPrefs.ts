"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { czytajReke, defaultMenuPrefs, MAKS_MODULOW_W_PASKU, MODULES, type MenuPrefs, type Reka } from "@/lib/modules";

const VALID_IDS = new Set(MODULES.map((m) => m.id));

/** Preferencje menu zalogowanego użytkownika; brak wiersza ⇒ wartości domyślne. */
export async function getMenuPrefs(): Promise<MenuPrefs> {
  const user = await requireAuth();
  return readMenuPrefs(user.id);
}

/** Wewnętrzny odczyt po id (bez ponownej autoryzacji) — używany z layoutu. */
export async function readMenuPrefs(userId: string): Promise<MenuPrefs> {
  const def = defaultMenuPrefs();
  const row = await prisma.userMenuPref.findUnique({ where: { userId } }).catch(() => null);
  if (!row) return def;
  try {
    const order = JSON.parse(row.order);
    const disabled = JSON.parse(row.disabled);
    const tabBar = JSON.parse(row.tabBar ?? "[]");
    return {
      order: Array.isArray(order) && order.length ? order.filter((id: unknown): id is string => typeof id === "string") : def.order,
      disabled: Array.isArray(disabled) ? disabled.filter((id: unknown): id is string => typeof id === "string") : def.disabled,
      tabBar: Array.isArray(tabBar) && tabBar.length ? tabBar.filter((id: unknown): id is string => typeof id === "string") : def.tabBar,
      favoritesCollapsed: row.favoritesCollapsed,
      handedness: czytajReke(row.handedness),
      sidebarCollapsed: row.sidebarCollapsed,
    };
  } catch {
    return def;
  }
}

export async function updateMenuPrefs(patch: { order?: string[]; disabled?: string[]; tabBar?: string[]; favoritesCollapsed?: boolean; handedness?: Reka; sidebarCollapsed?: boolean }): Promise<void> {
  const user = await requireAuth();
  const current = await readMenuPrefs(user.id);

  const order = (patch.order ?? current.order).filter((id) => VALID_IDS.has(id));
  const disabled = (patch.disabled ?? current.disabled).filter((id) => VALID_IDS.has(id));
  /**
   * Dolny pasek: tylko prawidłowe id, bez duplikatów, ucięte do limitu MIEJSC MODUŁOWYCH.
   *
   * 103: `home` odpada, bo Strona główna jest od tego przebiegu **kotwicą** paska — jej wpis
   * w preferencjach dawałby dwie ikony domu w jednym rzędzie. Limit spadł z pięciu do
   * `MAKS_MODULOW_W_PASKU`, bo trzy z pięciu miejsc zajmują teraz kotwice (dom, ulubione,
   * historia). Walidacja jest TUTAJ, a nie tylko w formularzu, bo kolumna jest JSON-em i przyjmie
   * cokolwiek — również stan zapisany przez starszą wersję interfejsu.
   */
  const tabBar = Array.from(
    new Set((patch.tabBar ?? current.tabBar).filter((id) => VALID_IDS.has(id) && id !== "home")),
  ).slice(0, MAKS_MODULOW_W_PASKU);
  const favoritesCollapsed = patch.favoritesCollapsed ?? current.favoritesCollapsed;
  const handedness = czytajReke(patch.handedness ?? current.handedness);
  const sidebarCollapsed = patch.sidebarCollapsed ?? current.sidebarCollapsed;

  await prisma.userMenuPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, order: JSON.stringify(order), disabled: JSON.stringify(disabled), tabBar: JSON.stringify(tabBar), favoritesCollapsed, handedness, sidebarCollapsed },
    update: { order: JSON.stringify(order), disabled: JSON.stringify(disabled), tabBar: JSON.stringify(tabBar), favoritesCollapsed, handedness, sidebarCollapsed },
  });

  revalidatePath("/", "layout");
}
