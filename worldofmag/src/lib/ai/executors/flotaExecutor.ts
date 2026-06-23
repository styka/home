// Z-010: handler akcji asystenta dla modułu Flota (pojazdy + tankowania + serwis).
// Scala trzy dawne bloki `module === "flota"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import { addFuelLog, addServiceRecord, createVehicle, updateVehicle, deleteVehicle } from "@/actions/flota";
import { asStr, resolveByName, ownerOrArr, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeFlotaAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "add_fuel_log") {
    const liters = Number(params.liters);
    if (!liters || isNaN(liters) || liters <= 0) throw new Error("Podaj liczbę litrów większą od zera");
    const teamIds = await getUserTeamIds(userId);
    const vehicleName = asStr(params.vehicleName);
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }],
        ...(vehicleName ? { name: { contains: vehicleName, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!vehicle) throw new Error("Nie znaleziono pojazdu w Flocie");
    const odometer = Number(params.odometer) || vehicle.odometer || 0;
    const totalCost = params.totalCost != null ? Number(params.totalCost) : null;
    await addFuelLog(vehicle.id, { liters, totalCost, odometer, note: asStr(params.note) });
    return `Dodano tankowanie ${liters} L${totalCost ? ` (${totalCost} zł)` : ""} — ${vehicle.name}`;
  }

  if (type === "add_service_record") {
    const teamIds = await getUserTeamIds(userId);
    const vehicleName = asStr(params.vehicleName);
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }],
        ...(vehicleName ? { name: { contains: vehicleName, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!vehicle) throw new Error("Nie znaleziono pojazdu w Flocie");
    await addServiceRecord(vehicle.id, {
      type: asStr(params.serviceType) ?? "other",
      cost: params.cost != null ? Number(params.cost) : null,
      odometer: params.odometer != null ? Number(params.odometer) : null,
      note: asStr(params.note) ?? null,
    });
    return `Dodano wpis serwisowy — ${vehicle.name}`;
  }

  if (type === "create_vehicle") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę pojazdu");
    const v = await createVehicle({ name, make: asStr(params.make) ?? null, model: asStr(params.model) ?? null, plate: asStr(params.plate) ?? null, year: params.year != null ? Number(params.year) : null });
    const msg = `Dodano pojazd „${v.name}"`;
    if (params.openAfter === true) return { message: msg, navigateTo: `/flota/${v.id}`, navigateLabel: `Otwórz „${v.name}"` };
    return msg;
  }

  const teamOr = await ownerOrArr(userId);
  const resolveVeh = () => resolveByName((w) => prisma.vehicle.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.vehicleId), "name", searchQuery ?? asStr(params.vehicleName), "pojazd");
  if (type === "update_vehicle") {
    const id = await resolveVeh();
    await updateVehicle(id, { name: asStr(params.name), plate: asStr(params.plate) ?? null, odometer: params.odometer != null ? Number(params.odometer) : undefined });
    return `Zaktualizowano pojazd`;
  }
  if (type === "delete_vehicle") {
    const id = await resolveVeh();
    await deleteVehicle(id);
    return `Usunięto pojazd`;
  }

  throw new Error(`Nieznany typ akcji floty: ${type}`);
}
