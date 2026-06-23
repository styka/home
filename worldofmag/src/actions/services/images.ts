"use server";

// Z-213/361: akcje modułu Usługi — portfolio zdjęć wykonawcy (M4).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { requireOwnProvider } from "@/lib/services/helpers";

/** Dodaje zdjęcie do portfolio wykonawcy. url = data-URL (limit ~2MB) lub link. */
export async function addServiceImage(url: string, caption?: string | null): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  if (!url || (!url.startsWith("data:image/") && !url.startsWith("http"))) throw new Error("Nieprawidłowy obraz");
  if (url.length > 2_800_000) throw new Error("Zdjęcie jest za duże (max ~2MB)");
  const max = await prisma.serviceImage.aggregate({ where: { providerId: provider.id }, _max: { order: true } });
  await prisma.serviceImage.create({
    data: { providerId: provider.id, url, caption: caption?.trim() || null, order: (max._max.order ?? -1) + 1 },
  });
  revalidatePath("/services/provider");
}

export async function deleteServiceImage(id: string): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const img = await prisma.serviceImage.findUnique({ where: { id }, select: { providerId: true } });
  if (!img || img.providerId !== provider.id) throw new Error("Brak dostępu do zdjęcia");
  await prisma.serviceImage.delete({ where: { id } });
  revalidatePath("/services/provider");
}
