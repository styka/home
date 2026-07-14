// Pomocnicze dla modułu Flota: etykiety paliwa, statusy terminów, zużycie paliwa.

export const FUEL_LABELS: Record<string, string> = {
  petrol: "Benzyna",
  diesel: "Diesel",
  lpg: "LPG",
  electric: "Elektryczny",
  hybrid: "Hybryda",
};

export const SERVICE_LABELS: Record<string, string> = {
  oil: "Olej",
  tires: "Opony",
  repair: "Naprawa",
  inspection: "Przegląd",
  insurance: "Ubezpieczenie",
  other: "Inne",
};

export interface DeadlineInfo {
  days: number;
  overdue: boolean;
  text: string;
  color: string;
  bg: string;
}

/** Status terminu (przegląd/OC): kolor + tekst względny. null gdy brak daty. */
export function deadlineStatus(due: Date | string | null | undefined): DeadlineInfo | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const days = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  const dateStr = d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });

  if (days < 0) return { days, overdue: true, text: `po terminie (${dateStr})`, color: "var(--accent-red)", bg: "rgba(239,68,68,0.1)" };
  if (days <= 30) return { days, overdue: false, text: `za ${days} dni`, color: "var(--accent-amber)", bg: "rgba(245,158,11,0.1)" };
  return { days, overdue: false, text: dateStr, color: "var(--text-muted)", bg: "var(--bg-elevated)" };
}

export interface FuelLogLike {
  date: Date | string;
  odometer: number;
  liters: number;
  totalCost?: number | null;
  full: boolean;
}

export interface ConsumptionResult {
  avg: number | null; // średnie l/100km
  points: { x: number; y: number; label: string }[]; // l/100km między pełnymi tankowaniami
  totalCost: number;
  totalLiters: number;
}

/**
 * Zużycie paliwa metodą „full-to-full": liczone tylko między kolejnymi pełnymi
 * tankowaniami (litry zatankowane na drugim pełnym ÷ przejechany dystans × 100).
 */
export function computeConsumption(logsInput: FuelLogLike[]): ConsumptionResult {
  const logs = [...logsInput].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const points: { x: number; y: number; label: string }[] = [];
  let totalLiters = 0;
  let totalCost = 0;

  let lastFullOdo: number | null = null;
  let litersSinceFull = 0;

  for (const l of logs) {
    totalLiters += l.liters;
    totalCost += l.totalCost ?? 0;
    if (l.full) {
      if (lastFullOdo !== null && l.odometer > lastFullOdo) {
        const dist = l.odometer - lastFullOdo;
        const used = litersSinceFull + l.liters;
        const per100 = (used / dist) * 100;
        if (per100 > 0 && per100 < 100) {
          points.push({ x: new Date(l.date).getTime(), y: Math.round(per100 * 10) / 10, label: new Date(l.date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" }) });
        }
      }
      lastFullOdo = l.odometer;
      litersSinceFull = 0;
    } else {
      litersSinceFull += l.liters;
    }
  }

  const avg = points.length > 0 ? Math.round((points.reduce((s, p) => s + p.y, 0) / points.length) * 10) / 10 : null;
  return { avg, points, totalCost, totalLiters };
}

export interface ServiceRecordLike {
  type: string;
  cost?: number | null;
  odometer?: number | null;
}

export interface VehicleTCO {
  fuelCost: number;
  serviceCost: number;
  insuranceCost: number; // podzbiór serviceCost (type === "insurance")
  total: number; // TCO = paliwo + serwis (w tym ubezpieczenia)
  distanceKm: number | null; // z odometrów (paliwo + serwis), null gdy < 2 punktów
  costPerKm: number | null; // total / distanceKm
  byServiceType: Record<string, number>;
}

/**
 * Z-291 — TCO pojazdu: zagregowany koszt posiadania (paliwo + serwis, w tym
 * ubezpieczenia) oraz koszt na kilometr (z rozpiętości odometrów). Czysta funkcja
 * (testowalna), spinana z widokiem floty i budżetem.
 */
export function computeVehicleTCO(fuelLogs: FuelLogLike[], services: ServiceRecordLike[]): VehicleTCO {
  const fuelCost = fuelLogs.reduce((s, l) => s + (l.totalCost ?? 0), 0);
  let serviceCost = 0;
  let insuranceCost = 0;
  const byServiceType: Record<string, number> = {};
  for (const s of services) {
    const c = s.cost ?? 0;
    serviceCost += c;
    byServiceType[s.type] = (byServiceType[s.type] ?? 0) + c;
    if (s.type === "insurance") insuranceCost += c;
  }
  const total = fuelCost + serviceCost;

  const odos = [
    ...fuelLogs.map((l) => l.odometer),
    ...services.map((s) => s.odometer),
  ].filter((o): o is number => typeof o === "number" && o > 0);
  const distanceKm = odos.length >= 2 ? Math.max(...odos) - Math.min(...odos) : null;
  const costPerKm = distanceKm && distanceKm > 0 ? Math.round((total / distanceKm) * 100) / 100 : null;

  return { fuelCost, serviceCost, insuranceCost, total, distanceKm, costPerKm, byServiceType };
}
