// Czysta logika generowania slotów rezerwacji (M2). Bez DB — łatwo testować.

export type AvailabilityRule = { weekday: number; startMin: number; endMin: number };
export type BookedInterval = { startMin: number; endMin: number };

export const WEEKDAY_LABELS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];

/** Minuty od północy dla podanej daty (czas lokalny). */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** "HH:MM" z minut od północy. */
export function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → minuty od północy (lub null gdy niepoprawne). */
export function labelToMin(label: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/**
 * Generuje początki wolnych slotów (w minutach od północy) dla danego dnia:
 * z reguł dostępności tego dnia tygodnia, krokiem = czas trwania usługi,
 * z pominięciem slotów już zajętych i (gdy dziś) tych w przeszłości.
 */
export function generateDaySlots(
  rules: AvailabilityRule[],
  weekday: number,
  durationMin: number,
  booked: BookedInterval[],
  nowMinIfToday: number | null
): number[] {
  if (durationMin <= 0) return [];
  const slots: number[] = [];
  for (const r of rules) {
    if (r.weekday !== weekday) continue;
    for (let s = r.startMin; s + durationMin <= r.endMin; s += durationMin) {
      const e = s + durationMin;
      if (nowMinIfToday != null && s < nowMinIfToday) continue;
      if (booked.some((b) => s < b.endMin && e > b.startMin)) continue;
      slots.push(s);
    }
  }
  return Array.from(new Set(slots)).sort((a, b) => a - b);
}
