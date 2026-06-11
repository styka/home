"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";

export type DashboardPrefsDTO = { order: string[]; hidden: string[] };

function parseArr(s: string | null | undefined): string[] {
  try {
    const v = JSON.parse(s ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
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
  const order = JSON.stringify((prefs.order ?? []).slice(0, 40));
  const hidden = JSON.stringify((prefs.hidden ?? []).slice(0, 40));
  await prisma.dashboardPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, order, hidden },
    update: { order, hidden },
  });
  revalidatePath("/");
}
