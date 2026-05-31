"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { defaultMenuPrefs, MODULES, type MenuPrefs } from "@/lib/modules";

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
    return {
      order: Array.isArray(order) && order.length ? order.filter((id: unknown): id is string => typeof id === "string") : def.order,
      disabled: Array.isArray(disabled) ? disabled.filter((id: unknown): id is string => typeof id === "string") : def.disabled,
    };
  } catch {
    return def;
  }
}

export async function updateMenuPrefs(patch: { order?: string[]; disabled?: string[] }): Promise<void> {
  const user = await requireAuth();
  const current = await readMenuPrefs(user.id);

  const order = (patch.order ?? current.order).filter((id) => VALID_IDS.has(id));
  const disabled = (patch.disabled ?? current.disabled).filter((id) => VALID_IDS.has(id));

  await prisma.userMenuPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, order: JSON.stringify(order), disabled: JSON.stringify(disabled) },
    update: { order: JSON.stringify(order), disabled: JSON.stringify(disabled) },
  });

  revalidatePath("/", "layout");
}
