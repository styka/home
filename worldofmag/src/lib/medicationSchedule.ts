// Czyste funkcje pomocnicze dla harmonogramu leków/pielęgnacji. Bez Prisma/React —
// współdzielone między serwerem (akcje, kalendarz, AI) a klientem (UI). Operujemy na
// dniu LOKALNYM ("YYYY-MM-DD"), spójnie z modułem Nawyków (habitStats), bez UTC-shift.

import { isoDate, parseDays } from "@/lib/habitStats";
import type { DoseSlot, MedicationLog, MedicationSchedule } from "@/types";

/** Parsuje `timesOfDay` (JSON tablica "HH:MM") → posortowane, unikalne godziny. */
export function parseTimes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const valid = arr.filter((t): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
  return Array.from(new Set(valid)).sort();
}

/** "HH:MM" → minuty od północy (do generowania i sortowania slotów HOURLY). */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Pełna liczba dni między dwiema datami (po dniu lokalnym). */
function dayDiff(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Czy harmonogram jest w ogóle aktywny danego dnia (flaga + okno kuracji). */
export function isActiveOn(schedule: MedicationSchedule, date: Date): boolean {
  if (!schedule.active) return false;
  const day = isoDate(date);
  if (day < isoDate(new Date(schedule.startDate))) return false;
  if (schedule.endDate && day > isoDate(new Date(schedule.endDate))) return false;
  return true;
}

/**
 * Sloty (godziny "HH:MM") należne danego dnia. Pusta tablica = nic tego dnia.
 * - WEEKLY: dzień tygodnia w daysOfWeek → timesOfDay.
 * - DAILY:  co `interval` dni licząc od startDate → timesOfDay.
 * - HOURLY: co `interval` godzin od hourlyStart do hourlyEnd (codziennie w oknie).
 */
export function slotsForDate(schedule: MedicationSchedule, date: Date): string[] {
  if (!isActiveOn(schedule, date)) return [];

  if (schedule.freqType === "WEEKLY") {
    const days = parseDays(schedule.daysOfWeek);
    if (days && !days.has(date.getDay())) return [];
    return parseTimes(schedule.timesOfDay);
  }

  if (schedule.freqType === "HOURLY") {
    const start = schedule.hourlyStart && /^\d{2}:\d{2}$/.test(schedule.hourlyStart) ? schedule.hourlyStart : "08:00";
    const end = schedule.hourlyEnd && /^\d{2}:\d{2}$/.test(schedule.hourlyEnd) ? schedule.hourlyEnd : "22:00";
    const step = Math.max(1, schedule.interval) * 60;
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);
    const out: string[] = [];
    for (let m = startMin; m <= endMin; m += step) {
      out.push(`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`);
    }
    return out;
  }

  // DAILY — co `interval` dni od startDate.
  const interval = Math.max(1, schedule.interval);
  const diff = dayDiff(new Date(schedule.startDate), date);
  if (diff < 0 || diff % interval !== 0) return [];
  return parseTimes(schedule.timesOfDay);
}

/**
 * Buduje agendę dnia: iloczyn (harmonogram × slotsForDate) złączony z logami
 * (po `date`+`slot`). Zwraca posortowane po godzinie pozycje do odhaczania.
 */
export function buildDayAgenda(
  schedules: MedicationSchedule[],
  logs: MedicationLog[],
  date: Date
): DoseSlot[] {
  const day = isoDate(date);
  const logByKey = new Map<string, MedicationLog>();
  for (const l of logs) logByKey.set(`${l.scheduleId}|${l.slot}`, l);

  const out: DoseSlot[] = [];
  for (const s of schedules) {
    for (const slot of slotsForDate(s, date)) {
      const log = logByKey.get(`${s.id}|${slot}`);
      out.push({
        scheduleId: s.id,
        kind: s.kind,
        name: s.name,
        dosage: s.dosage,
        instructions: s.instructions,
        slot,
        done: !!log,
        outcome: log ? log.outcome : null,
      });
    }
  }

  out.sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : a.name.localeCompare(b.name)));
  void day; // (klucz dnia używany przez wołającego do filtrowania logów)
  return out;
}

/** Krótki, czytelny opis cykliczności do UI/AI (np. "co 8 godz., 08:00–22:00"). */
export function describeFrequency(schedule: MedicationSchedule): string {
  if (schedule.freqType === "HOURLY") {
    const start = schedule.hourlyStart ?? "08:00";
    const end = schedule.hourlyEnd ?? "22:00";
    return `co ${Math.max(1, schedule.interval)} godz. (${start}–${end})`;
  }
  const times = parseTimes(schedule.timesOfDay);
  const timesLabel = times.length ? times.join(", ") : "—";
  if (schedule.freqType === "WEEKLY") {
    const names = ["nd", "pon", "wt", "śr", "czw", "pt", "sb"];
    const days = parseDays(schedule.daysOfWeek);
    const dayLabel = days ? Array.from(days).sort().map((d) => names[d]).join(", ") : "codziennie";
    return `${dayLabel} o ${timesLabel}`;
  }
  const every = Math.max(1, schedule.interval) === 1 ? "codziennie" : `co ${schedule.interval} dni`;
  return `${every} o ${timesLabel}`;
}
