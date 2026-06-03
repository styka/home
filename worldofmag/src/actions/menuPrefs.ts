"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { defaultMenuPrefs, MAX_TAB_BAR, MODULES, type MenuPrefs } from "@/lib/modules";

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
    };
  } catch {
    return def;
  }
}

export async function updateMenuPrefs(patch: { order?: string[]; disabled?: string[]; tabBar?: string[] }): Promise<void> {
  const user = await requireAuth();
  const current = await readMenuPrefs(user.id);

  const order = (patch.order ?? current.order).filter((id) => VALID_IDS.has(id));
  const disabled = (patch.disabled ?? current.disabled).filter((id) => VALID_IDS.has(id));
  // dolny pasek: tylko prawidłowe id, bez duplikatów, ucięte do limitu
  const tabBar = Array.from(new Set((patch.tabBar ?? current.tabBar).filter((id) => VALID_IDS.has(id)))).slice(0, MAX_TAB_BAR);

  await prisma.userMenuPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, order: JSON.stringify(order), disabled: JSON.stringify(disabled), tabBar: JSON.stringify(tabBar) },
    update: { order: JSON.stringify(order), disabled: JSON.stringify(disabled), tabBar: JSON.stringify(tabBar) },
  });

  revalidatePath("/", "layout");
}
