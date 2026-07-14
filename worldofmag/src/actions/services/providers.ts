"use server";

// Z-213/361: akcje modułu Usługi — kategorie, profil wykonawcy, weryfikacja (M7).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { notifyUser } from "@/actions/notifications";
import { uniqueProviderSlug, requireOwnProvider } from "@/lib/services/helpers";
import type { ServiceCategoryDTO } from "@/lib/services";

/** Kategorie usług widoczne dla użytkownika: systemowe + własne + zespołowe. */
export async function getServiceCategories(): Promise<ServiceCategoryDTO[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const cats = await prisma.serviceCategory.findMany({
    where: {
      OR: [
        { userId: null, teamId: null },
        { userId: user.id },
        ...(teamIds.length ? [{ teamId: { in: teamIds } }] : []),
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    isSystem: c.userId === null && c.teamId === null,
  }));
}

export async function getMyProviderProfile() {
  const user = await requireAuth();
  return prisma.serviceProvider.findUnique({
    where: { userId: user.id },
    include: {
      listings: {
        orderBy: { createdAt: "desc" },
        include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      },
      images: { orderBy: { order: "asc" } },
      availability: { select: { id: true } },
    },
  });
}

// M19: slug z nazwy (ASCII, myślniki). Wynik unikalny dzięki sufiksowi liczbowemu.
export async function upsertServiceProvider(data: {
  displayName: string;
  tagline?: string | null;
  bio?: string | null;
  area?: string | null;
  phone?: string | null;
  nip?: string | null;
  visible?: boolean;
}): Promise<void> {
  const user = await requireAuth();
  const displayName = data.displayName.trim();
  if (!displayName) throw new Error("Nazwa wykonawcy jest wymagana");

  const existing = await prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { id: true, slug: true } });
  // Slug nadajemy raz (przy tworzeniu lub gdy go brak) — stabilny link do udostępniania.
  const slug = existing?.slug ?? (await uniqueProviderSlug(displayName, existing?.id ?? null));

  const fields = {
    displayName,
    tagline: data.tagline?.trim() || null,
    bio: data.bio?.trim() || null,
    area: data.area?.trim() || null,
    phone: data.phone?.trim() || null,
    nip: data.nip?.trim() || null,
    visible: data.visible ?? true,
    slug,
  };

  await prisma.serviceProvider.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...fields },
    update: fields,
  });
  revalidatePath("/services/provider");
  revalidatePath("/services");
}

/** M5: ustawia (lub czyści) lokalizację wykonawcy — wołane z przeglądarkowej geolokalizacji. */
export async function setProviderLocation(lat: number | null, lon: number | null): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  if (lat != null && (lat < -90 || lat > 90)) throw new Error("Nieprawidłowa szerokość");
  if (lon != null && (lon < -180 || lon > 180)) throw new Error("Nieprawidłowa długość");
  await prisma.serviceProvider.update({ where: { id: provider.id }, data: { lat, lon } });
  revalidatePath("/services/provider");
  revalidatePath("/services");
}

/** M19: akceptuje id LUB slug (czytelny link do udostępniania). */
export async function getProviderPublic(idOrSlug: string) {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      listings: {
        where: { active: true },
        include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      },
      requests: {
        where: { status: "COMPLETED", review: { isNot: null } },
        include: { review: true, client: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
      images: { orderBy: { order: "asc" } },
    },
  });
  if (!provider) return null;
  const fav = await prisma.serviceFavorite.findUnique({
    where: { userId_providerId: { userId: user.id, providerId: provider.id } },
    select: { id: true },
  });
  return { ...provider, isFavorite: !!fav };
}

/** Admin nadaje/odbiera weryfikację wykonawcy (badge zaufania). */
export async function setProviderVerified(providerId: string, verified: boolean): Promise<void> {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
  const provider = await prisma.serviceProvider.update({
    where: { id: providerId },
    data: { verified },
    select: { userId: true, displayName: true },
  });
  if (verified) {
    await notifyUser({
      userId: provider.userId,
      module: "services",
      title: "Twój profil wykonawcy został zweryfikowany ✓",
      href: "/services/provider",
      dedupeKey: `provider-verified-${providerId}`,
    });
  }
  revalidatePath("/services");
  revalidatePath(`/services/providers/${providerId}`);
}
