"use server";

// Z-213/361: akcje modułu Usługi — ulubieni wykonawcy (M11).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";

export async function toggleFavorite(providerId: string): Promise<{ favored: boolean }> {
  const user = await requireAuth();
  const existing = await prisma.serviceFavorite.findUnique({
    where: { userId_providerId: { userId: user.id, providerId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.serviceFavorite.delete({ where: { id: existing.id } });
    revalidatePath("/services");
    revalidatePath(`/services/providers/${providerId}`);
    return { favored: false };
  }
  await prisma.serviceFavorite.create({ data: { userId: user.id, providerId } });
  revalidatePath("/services");
  revalidatePath(`/services/providers/${providerId}`);
  return { favored: true };
}

export async function getMyFavoriteProviders(): Promise<{ id: string; displayName: string; area: string | null; ratingAvg: number; ratingCount: number; verified: boolean }[]> {
  const user = await requireAuth();
  const favs = await prisma.serviceFavorite.findMany({
    where: { userId: user.id, provider: { visible: true } },
    orderBy: { createdAt: "desc" },
    select: { provider: { select: { id: true, displayName: true, area: true, ratingAvg: true, ratingCount: true, verified: true } } },
  });
  return favs.map((f) => f.provider);
}
