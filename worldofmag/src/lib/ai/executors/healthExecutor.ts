// Z-010: handler akcji asystenta dla modułu Zdrowie (wizyty/badania + leki/pielęgnacja).
// Wyodrębniony z execute/route.ts. `type === "..."` skanowane przez check-action-coverage.js.
import { createHealthEvent, updateHealthEvent, setHealthStatus, deleteHealthEvent } from "@/actions/health";
import { createMedicationSchedule, deleteMedicationSchedule, logDose, getMedicationDay } from "@/actions/medications";
import { asStr, resolveHealthEventId, resolveMedicationId, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";
import type { HealthKind, HealthStatus } from "@/types";

export async function executeHealthAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "create_health_event") {
    const title = asStr(params.title);
    if (!title) throw new Error("Podaj tytuł wizyty/badania");
    const kind = (asStr(params.kind) === "TEST" ? "TEST" : "VISIT") as HealthKind;
    const scheduledAt = params.scheduledAt ? new Date(String(params.scheduledAt)) : new Date();
    const ev = await createHealthEvent({
      kind,
      title,
      scheduledAt,
      doctorName: asStr(params.doctorName) ?? null,
      specialty: asStr(params.specialty) ?? null,
      facility: asStr(params.facility) ?? null,
      notes: asStr(params.notes) ?? null,
    });
    const msg = `Dodano ${kind === "TEST" ? "badanie" : "wizytę"}: „${ev.title}"`;
    if (params.openAfter === true) return { message: msg, navigateTo: `/health`, navigateLabel: "Otwórz Zdrowie" };
    return msg;
  }
  if (type === "update_health_event") {
    const id = await resolveHealthEventId(userId, params, searchQuery);
    const patch: Parameters<typeof updateHealthEvent>[1] = {};
    if (params.title !== undefined) patch.title = String(params.title);
    if (params.scheduledAt !== undefined) patch.scheduledAt = new Date(String(params.scheduledAt));
    if (params.notes !== undefined) patch.notes = asStr(params.notes) ?? null;
    if (params.status !== undefined) patch.status = String(params.status) as HealthStatus;
    await updateHealthEvent(id, patch);
    return `Zaktualizowano wpis zdrowia`;
  }
  if (type === "set_health_status") {
    const id = await resolveHealthEventId(userId, params, searchQuery);
    const status = (asStr(params.status) ?? "DONE") as HealthStatus;
    await setHealthStatus(id, status);
    return `Zmieniono status wpisu zdrowia → ${status}`;
  }
  if (type === "delete_health_event") {
    const id = await resolveHealthEventId(userId, params, searchQuery);
    await deleteHealthEvent(id);
    return `Usunięto wpis zdrowia`;
  }
  if (type === "create_medication") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę leku lub czynności");
    const kind = asStr(params.kind) === "CARE" ? "CARE" : "MEDICATION";
    const s = await createMedicationSchedule({
      kind,
      name,
      dosage: asStr(params.dosage) ?? null,
      reason: asStr(params.reason) ?? null,
      instructions: asStr(params.instructions) ?? null,
      freqType: (asStr(params.freqType) as "DAILY" | "WEEKLY" | "HOURLY") ?? "DAILY",
      interval: params.interval != null ? Number(params.interval) : 1,
      daysOfWeek: Array.isArray(params.daysOfWeek) ? (params.daysOfWeek as number[]) : asStr(params.daysOfWeek) ?? null,
      timesOfDay: Array.isArray(params.timesOfDay) ? (params.timesOfDay as string[]) : asStr(params.timesOfDay) ?? null,
      hourlyStart: asStr(params.hourlyStart) ?? null,
      hourlyEnd: asStr(params.hourlyEnd) ?? null,
      startDate: params.startDate ? String(params.startDate) : null,
      endDate: params.endDate ? String(params.endDate) : null,
    });
    return `Dodano harmonogram: „${s.name}"`;
  }
  if (type === "log_dose") {
    const id = await resolveMedicationId(userId, params, searchQuery);
    const date = asStr(params.date) ?? new Date().toISOString().slice(0, 10);
    let slot = asStr(params.slot);
    if (!slot) {
      const day = await getMedicationDay(date);
      const pending = day.slots.find((sl) => sl.scheduleId === id && !sl.done) ?? day.slots.find((sl) => sl.scheduleId === id);
      slot = pending?.slot;
    }
    if (!slot) throw new Error("Brak zaplanowanej dawki tego dnia — podaj godzinę (slot)");
    await logDose(id, date, slot, "TAKEN");
    return `Odhaczono dawkę o ${slot}`;
  }
  if (type === "delete_medication") {
    const id = await resolveMedicationId(userId, params, searchQuery);
    await deleteMedicationSchedule(id);
    return `Usunięto harmonogram`;
  }

  throw new Error(`Nieznany typ akcji zdrowia: ${type}`);
}
