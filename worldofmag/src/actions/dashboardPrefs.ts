"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { sanitizeSectionKeys } from "@/lib/home/dashboardSections";

export type DashboardPrefsDTO = { order: string[]; hidden: string[] };

function parseArr(s: string | null | undefined): string[] {
  try {
    const v = JSON.parse(s ?? "[]");
    // Z-218: tylko znane klucze sekcji (literówki nie tworzą martwych pozycji).
    return sanitizeSectionKeys(v);
  } catch {
    return [];
  }
}

export async function getDashboardPrefs(): Promise<DashboardPrefsDTO> {
  const user = await requireAuth();
  const row = await prisma.dashboardPref.findUnique({ where: { userId: user.id } });
  return { order: parseArr(row?.order), hidden: parseArr(row?.hidden) };
}

export async function setDashboardPrefs(prefs: DashboardPrefsDTO): Promise<void> {
  const user = await requireAuth();
  // Z-218: waliduj klucze przed zapisem (whitelist + dedup).
  const order = JSON.stringify(sanitizeSectionKeys(prefs.order));
  const hidden = JSON.stringify(sanitizeSectionKeys(prefs.hidden));
  await prisma.dashboardPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, order, hidden },
    update: { order, hidden },
  });
  revalidatePath("/");
}
