"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { wlasnoscOsobistaDoZapisu, filtrMoichRekordow } from "@/platform/workspaces/zapis";
import type { DlugoscStreszczenia } from "./ai";

/** 102 — ustawienia modułu (na razie jedno: domyślna długość streszczenia). */

export async function getDomyslnaDlugosc(): Promise<DlugoscStreszczenia> {
  const user = await requireAuth();
  const pref = await prisma.youtubePref.findUnique({
    where: { ...(await filtrMoichRekordow(user.id)) },
    select: { domyslnaDlugosc: true },
  });
  return (pref?.domyslnaDlugosc as DlugoscStreszczenia | undefined) ?? "srednie";
}

export async function ustawDomyslnaDlugosc(dlugosc: DlugoscStreszczenia): Promise<void> {
  const user = await requireAuth();
  const wlasnosc = await wlasnoscOsobistaDoZapisu(user.id);
  await prisma.youtubePref.upsert({
    where: { workspaceId: wlasnosc.workspaceId },
    create: { ...wlasnosc, domyslnaDlugosc: dlugosc },
    update: { domyslnaDlugosc: dlugosc },
  });
  revalidatePath("/youtube");
}
