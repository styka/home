"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { sanitizeColor, sanitizeIcon } from "@/platform/favorites/sanitize";
import { wlasnoscOsobistaDoZapisu } from "@/platform/workspaces/zapis";
import {
  MAX_FAVORITE_VIEWS,
  normalizeFavoriteLabel,
  normalizeFavoritePath,
  suggestFavoriteLabel,
  type FavoriteViewDTO,
} from "@/platform/favorites/favoriteViews";

/**
 * 042: Ulubione widoki — prywatne zakładki nawigacyjne użytkownika.
 * Wzorzec: `src/actions/menuPrefs.ts` (preferencja per konto, bez wariantu zespołowego).
 *
 * Dwie reguły obowiązują w KAŻDEJ mutacji poniżej:
 *  1. `requireAuth()` — to jest guard dostępu (deklaracja `access: "self"` w manifeście pokrycia AI).
 *  2. `where: { id, ownerId }` przez `updateMany`/`deleteMany` — nigdy `update`/`delete` po samym
 *     `id`. Identyfikator przychodzi z przeglądarki, więc bez warunku właściciela cudzy `id`
 *     trafiłby w cudzy wiersz.
 *
 * `revalidatePath("/", "layout")` (a nie `"/"`), bo ulubione renderują się w POWŁOCE — na pasku
 * bocznym i górnym każdej strony, nie tylko na pulpicie. Ten sam argument ma `updateMenuPrefs`.
 */

const SHELL_PATH = "/";

function toDTO(row: {
  id: string;
  label: string;
  path: string;
  icon: string;
  color: string | null;
  order: number;
}): FavoriteViewDTO {
  return { id: row.id, label: row.label, path: row.path, icon: row.icon, color: row.color, order: row.order };
}

export async function getFavoriteViews(): Promise<FavoriteViewDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.favoriteView.findMany({
    where: { ownerId: user.id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toDTO);
}

/**
 * Odczyt bez ponownej autoryzacji — do użycia z layoutu, który sesję ma już rozwiązaną.
 * Wzorzec 1:1 z `readMenuPrefs`.
 */
export async function readFavoriteViews(userId: string): Promise<FavoriteViewDTO[]> {
  const rows = await prisma.favoriteView
    .findMany({ where: { ownerId: userId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
    .catch(() => []);
  return rows.map(toDTO);
}

export async function addFavoriteView(input: {
  label?: string;
  path: string;
  icon?: string;
  color?: string | null;
}): Promise<FavoriteViewDTO> {
  const user = await requireAuth();

  const path = normalizeFavoritePath(input.path);
  if (!path) throw new Error("Nieprawidłowy adres widoku");

  // Wpis na ten sam adres już istnieje → zwracamy go zamiast tworzyć duplikat (AC-9).
  // Sprawdzenie tutaj daje czytelny wynik; ostateczną gwarancją jest @@unique w bazie.
  const existing = await prisma.favoriteView.findUnique({
    where: { ownerId_path: { ownerId: user.id, path } },
  });
  if (existing) return toDTO(existing);

  const count = await prisma.favoriteView.count({ where: { ownerId: user.id } });
  if (count >= MAX_FAVORITE_VIEWS) {
    throw new Error(`Osiągnięto limit ${MAX_FAVORITE_VIEWS} ulubionych widoków — usuń któryś, żeby dodać nowy`);
  }

  const label = normalizeFavoriteLabel(input.label ?? "") ?? suggestFavoriteLabel(path);

  const created = await prisma.favoriteView.create({
    data: {
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
      label,
      path,
      icon: sanitizeIcon(input.icon),
      color: sanitizeColor(input.color),
      order: count,
    },
  });

  revalidatePath(SHELL_PATH, "layout");
  return toDTO(created);
}

export async function removeFavoriteView(id: string): Promise<void> {
  const user = await requireAuth();
  await prisma.favoriteView.deleteMany({ where: { id, ownerId: user.id } });
  revalidatePath(SHELL_PATH, "layout");
}

/** Druga połowa przełącznika gwiazdki: usunięcie po adresie bieżącej strony (AC-3). */
export async function removeFavoriteViewByPath(path: string): Promise<void> {
  const user = await requireAuth();
  const normalized = normalizeFavoritePath(path);
  if (!normalized) return;
  await prisma.favoriteView.deleteMany({ where: { ownerId: user.id, path: normalized } });
  revalidatePath(SHELL_PATH, "layout");
}

export async function updateFavoriteView(
  id: string,
  patch: { label?: string; icon?: string; color?: string | null }
): Promise<void> {
  const user = await requireAuth();

  const data: { label?: string; icon?: string; color?: string | null } = {};
  if (patch.label !== undefined) {
    const label = normalizeFavoriteLabel(patch.label);
    if (label) data.label = label;
  }
  if (patch.icon !== undefined) data.icon = sanitizeIcon(patch.icon);
  if (patch.color !== undefined) data.color = sanitizeColor(patch.color);
  if (Object.keys(data).length === 0) return;

  await prisma.favoriteView.updateMany({ where: { id, ownerId: user.id }, data });
  revalidatePath(SHELL_PATH, "layout");
}

export async function reorderFavoriteViews(ids: string[]): Promise<void> {
  const user = await requireAuth();
  if (!Array.isArray(ids) || ids.length === 0) return;

  // Przestawiamy WYŁĄCZNIE wiersze należące do użytkownika — cudze id z listy po prostu
  // nie znajdą dopasowania i zostaną pominięte, zamiast przestawiać komuś jego zakładki.
  const owned = await prisma.favoriteView.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((r) => r.id));
  const ordered = ids.filter((id) => ownedIds.has(id));

  await prisma.$transaction(
    ordered.map((id, index) =>
      prisma.favoriteView.updateMany({ where: { id, ownerId: user.id }, data: { order: index } })
    )
  );

  revalidatePath(SHELL_PATH, "layout");
}
