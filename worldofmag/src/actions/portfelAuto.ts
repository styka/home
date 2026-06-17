"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";

export type FinanceSettingsDTO = {
  autoExpenseEnabled: boolean;
  autoExpenseElementId: string | null;
  aiAccessEnabled: boolean;
};

export async function getFinanceSettings(): Promise<FinanceSettingsDTO> {
  const user = await requireAuth();
  const s = await prisma.financeSettings.findUnique({ where: { userId: user.id } });
  return {
    autoExpenseEnabled: s?.autoExpenseEnabled ?? false,
    autoExpenseElementId: s?.autoExpenseElementId ?? null,
    aiAccessEnabled: s?.aiAccessEnabled ?? true, // Z-055: domyślnie wł. (opt-out)
  };
}

export async function setFinanceSettings(patch: {
  autoExpenseEnabled?: boolean;
  autoExpenseElementId?: string | null;
  aiAccessEnabled?: boolean;
}): Promise<void> {
  const user = await requireAuth();

  // Weryfikacja: wskazany element musi należeć do użytkownika (prywatny).
  let elementId = patch.autoExpenseElementId;
  if (elementId) {
    const el = await prisma.walletElement.findUnique({ where: { id: elementId }, select: { ownerId: true } });
    if (!el || el.ownerId !== user.id) throw new Error("Wybierz własne konto portfela");
  }
  if (elementId === undefined) elementId = undefined; // nie zmieniaj, gdy nie podano

  const data: { autoExpenseEnabled?: boolean; autoExpenseElementId?: string | null; aiAccessEnabled?: boolean } = {};
  if (patch.autoExpenseEnabled !== undefined) data.autoExpenseEnabled = patch.autoExpenseEnabled;
  if (patch.autoExpenseElementId !== undefined) data.autoExpenseElementId = patch.autoExpenseElementId || null;
  if (patch.aiAccessEnabled !== undefined) data.aiAccessEnabled = patch.aiAccessEnabled;

  await prisma.financeSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      autoExpenseEnabled: data.autoExpenseEnabled ?? false,
      autoExpenseElementId: data.autoExpenseElementId ?? null,
      aiAccessEnabled: data.aiAccessEnabled ?? true,
    },
    update: data,
  });
  revalidatePath("/portfel/ustawienia");
}
