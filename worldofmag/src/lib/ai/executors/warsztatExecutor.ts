// Z-010: handler akcji asystenta dla modułu Warsztaty (warsztat + wyposażenie).
import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import { createWorkshop, addWorkshopItem } from "@/actions/warsztat";
import { asStr } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeWarsztatAction(action: AIAction, userId: string): Promise<string> {
  const { type, params, searchQuery } = action;

  if (type === "create_workshop") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę warsztatu");
    const ws = await createWorkshop({
      name,
      type: asStr(params.type) ?? null,
      location: asStr(params.location) ?? null,
    });
    return `Utworzono warsztat „${ws.name}"`;
  }

  if (type === "add_workshop_item") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę pozycji");
    const wsName = asStr(params.workshopName) ?? searchQuery?.trim();
    const teamIds = await getUserTeamIds(userId);
    const ownerOr = [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }];
    const workshop = wsName
      ? await prisma.workshop.findFirst({
          where: { OR: ownerOr, name: { contains: wsName, mode: "insensitive" } },
          orderBy: { updatedAt: "desc" },
        })
      : await prisma.workshop.findFirst({ where: { OR: ownerOr }, orderBy: { updatedAt: "desc" } });
    if (!workshop) throw new Error(wsName ? `Nie znaleziono warsztatu „${wsName}"` : "Brak warsztatu — najpierw utwórz warsztat");
    const item = await addWorkshopItem(workshop.id, {
      name,
      kind: asStr(params.kind) ?? null,
      category: asStr(params.category) ?? null,
      quantity: params.quantity != null ? Number(params.quantity) : null,
      unit: asStr(params.unit) ?? null,
    });
    return `Dodano do warsztatu „${workshop.name}": ${item.name}`;
  }

  throw new Error(`Nieznany typ akcji warsztatów: ${type}`);
}
