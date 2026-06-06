"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  parseTokens,
  validateTokens,
  type SkinTokens,
} from "@/lib/skins";

export type SkinView = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  colorScheme: "light" | "dark";
  tokens: SkinTokens;
  ownerId: string | null;
  ownerTeamId: string | null;
  isPublic: boolean;
  sortOrder: number;
  isOwn: boolean; // czy bieżący użytkownik może edytować
};

export type ActiveSkin = {
  skinId: string | null;
  tokens: SkinTokens;
  colorScheme: "light" | "dark";
};

function scheme(v: string): "light" | "dark" {
  return v === "light" ? "light" : "dark";
}

/** Aktywna skórka użytkownika — czytane z layoutu (bez ponownej autoryzacji).
 *  Brak preferencji lub wskazana skórka niedostępna ⇒ domyślna ciemna. */
export async function readActiveSkin(userId: string): Promise<ActiveSkin> {
  const fallback: ActiveSkin = { skinId: null, tokens: {}, colorScheme: "dark" };
  const pref = await prisma.userSkinPref.findUnique({ where: { userId } }).catch(() => null);
  if (!pref?.skinId) return fallback;
  const skin = await prisma.skin.findUnique({ where: { id: pref.skinId } }).catch(() => null);
  if (!skin) return fallback;
  return { skinId: skin.id, tokens: parseTokens(skin.tokens), colorScheme: scheme(skin.colorScheme) };
}

/** Id aktywnej skórki — dla UI (picker). */
export async function getActiveSkinId(): Promise<string | null> {
  const user = await requireAuth();
  const pref = await prisma.userSkinPref.findUnique({ where: { userId: user.id } }).catch(() => null);
  return pref?.skinId ?? null;
}

function toView(
  s: {
    id: string; name: string; description: string | null; isSystem: boolean;
    colorScheme: string; tokens: string; ownerId: string | null;
    ownerTeamId: string | null; isPublic: boolean; sortOrder: number;
  },
  canEdit: boolean,
): SkinView {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    isSystem: s.isSystem,
    colorScheme: scheme(s.colorScheme),
    tokens: parseTokens(s.tokens),
    ownerId: s.ownerId,
    ownerTeamId: s.ownerTeamId,
    isPublic: s.isPublic,
    sortOrder: s.sortOrder,
    isOwn: canEdit,
  };
}

/** Skórki dostępne dla użytkownika: systemowe + własne + zespołowe + publiczne. */
export async function listAvailableSkins(): Promise<SkinView[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return [];
  const isAdmin = hasPermission(session, PERMISSIONS.ADMIN);
  const teamIds = await getUserTeamIds(userId);

  const skins = await prisma.skin.findMany({
    where: {
      OR: [
        { isSystem: true },
        { ownerId: userId },
        { ownerTeamId: { in: teamIds } },
        { isPublic: true },
      ],
    },
    orderBy: [{ isSystem: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return skins.map((s) =>
    toView(s, (s.isSystem && isAdmin) || s.ownerId === userId || (s.ownerTeamId !== null && teamIds.includes(s.ownerTeamId))),
  );
}

/** Ustaw aktywną skórkę (null ⇒ domyślna ciemna). */
export async function setActiveSkin(skinId: string | null): Promise<void> {
  const user = await requireAuth();
  if (skinId) {
    // upewnij się, że skórka istnieje i jest dla użytkownika dostępna
    const available = await listAvailableSkins();
    if (!available.some((s) => s.id === skinId)) throw new Error("Skin not available");
  }
  await prisma.userSkinPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, skinId },
    update: { skinId },
  });
  revalidatePath("/", "layout");
}

export type SkinInput = {
  name: string;
  description?: string | null;
  colorScheme: "light" | "dark";
  tokens: SkinTokens;
  isSystem?: boolean;
  isPublic?: boolean;
  ownerTeamId?: string | null;
  sortOrder?: number;
};

/** Tworzy nową skórkę. isSystem wymaga admina; w przeciwnym razie user-owned. */
export async function createSkin(input: SkinInput): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const name = input.name.trim().slice(0, 60) || "Skórka";
  const tokens = validateTokens(input.tokens);
  const colorScheme = input.colorScheme === "light" ? "light" : "dark";

  if (input.isSystem) {
    if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
    const skin = await prisma.skin.create({
      data: {
        name,
        description: input.description?.trim() || null,
        isSystem: true,
        isPublic: true,
        colorScheme,
        tokens: JSON.stringify(tokens),
        sortOrder: input.sortOrder ?? 100,
      },
    });
    revalidatePath("/", "layout");
    return skin.id;
  }

  // skórka użytkownika; opcjonalnie przypisana do zespołu (musi być członkiem)
  let ownerTeamId: string | null = null;
  if (input.ownerTeamId) {
    const teamIds = await getUserTeamIds(userId);
    if (!teamIds.includes(input.ownerTeamId)) throw new Error("Not a team member");
    ownerTeamId = input.ownerTeamId;
  }
  const skin = await prisma.skin.create({
    data: {
      name,
      description: input.description?.trim() || null,
      isSystem: false,
      isPublic: !!input.isPublic,
      colorScheme,
      tokens: JSON.stringify(tokens),
      ownerId: ownerTeamId ? null : userId,
      ownerTeamId,
    },
  });
  revalidatePath("/", "layout");
  return skin.id;
}

async function assertCanEditSkin(skinId: string): Promise<{ isSystem: boolean }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  const skin = await prisma.skin.findUnique({ where: { id: skinId } });
  if (!skin) throw new Error("Not found");
  if (skin.isSystem) {
    if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
    return { isSystem: true };
  }
  const teamIds = await getUserTeamIds(userId);
  const owns = skin.ownerId === userId || (skin.ownerTeamId !== null && teamIds.includes(skin.ownerTeamId));
  if (!owns) throw new Error("Forbidden");
  return { isSystem: false };
}

export async function updateSkin(id: string, patch: Partial<SkinInput>): Promise<void> {
  await assertCanEditSkin(id);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim().slice(0, 60) || "Skórka";
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.colorScheme !== undefined) data.colorScheme = patch.colorScheme === "light" ? "light" : "dark";
  if (patch.tokens !== undefined) data.tokens = JSON.stringify(validateTokens(patch.tokens));
  if (patch.isPublic !== undefined) data.isPublic = !!patch.isPublic;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
  await prisma.skin.update({ where: { id }, data });
  revalidatePath("/", "layout");
}

export async function deleteSkin(id: string): Promise<void> {
  await assertCanEditSkin(id);
  // wyczyść preferencje wskazujące na usuwaną skórkę (powrót do domyślnej)
  await prisma.userSkinPref.updateMany({ where: { skinId: id }, data: { skinId: null } });
  await prisma.skin.delete({ where: { id } });
  revalidatePath("/", "layout");
}

/** Duplikuje skórkę jako nową, edytowalną skórkę użytkownika. */
export async function duplicateSkin(id: string, name?: string): Promise<string> {
  const user = await requireAuth();
  const src = await prisma.skin.findUnique({ where: { id } });
  if (!src) throw new Error("Not found");
  const skin = await prisma.skin.create({
    data: {
      name: (name?.trim() || `${src.name} (kopia)`).slice(0, 60),
      description: src.description,
      isSystem: false,
      isPublic: false,
      colorScheme: src.colorScheme,
      tokens: JSON.stringify(validateTokens(parseTokens(src.tokens))),
      ownerId: user.id,
    },
  });
  revalidatePath("/", "layout");
  return skin.id;
}
