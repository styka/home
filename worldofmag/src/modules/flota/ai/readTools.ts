import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, asStr, ownerScope } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_vehicles: args { search? } → [{ id, name, plate, odometer, inspectionDue, insuranceDue }]. Pojazdy z flota.",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_vehicles: async (args, userId) => {
      const search = asStr(args.search);
      const vehicles = await prisma.vehicle.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, plate: true, odometer: true, inspectionDue: true, insuranceDue: true },
        orderBy: { updatedAt: "desc" },
        take: HARD_MAX,
      });
      return vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        plate: v.plate,
        odometer: v.odometer,
        inspectionDue: v.inspectionDue?.toISOString().slice(0, 10) ?? null,
        insuranceDue: v.insuranceDue?.toISOString().slice(0, 10) ?? null,
      }));
  },
};
