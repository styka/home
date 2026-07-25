import type { RecurringRule } from "@/types";

/**
 * Given a base date and a recurring rule, returns the next occurrence date,
 * or null if the rule type is unknown. Shared by Tasks and Pets modules.
 */
export function computeNextDue(from: Date, rule: RecurringRule): Date | null {
  const d = new Date(from);
  switch (rule.type) {
    case "DAILY":
      d.setDate(d.getDate() + rule.interval);
      return d;
    case "WEEKLY":
      if (rule.daysOfWeek?.length) {
        const currentDay = d.getDay();
        const sorted = [...rule.daysOfWeek].sort((a, b) => a - b);
        const next = sorted.find((day) => day > currentDay);
        if (next !== undefined) {
          d.setDate(d.getDate() + (next - currentDay));
        } else {
          d.setDate(d.getDate() + (7 - currentDay + sorted[0]));
        }
        return d;
      }
      d.setDate(d.getDate() + 7 * rule.interval);
      return d;
    case "MONTHLY":
      if (rule.dayOfMonth) {
        // Fixed day-of-month: land on that day regardless of the base date's
        // day. Set day to 1 BEFORE shifting months so a high base day (e.g. 31)
        // can't roll the month over, then clamp to the target month length.
        d.setDate(1);
        d.setMonth(d.getMonth() + rule.interval);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(rule.dayOfMonth, lastDay));
      } else {
        d.setMonth(d.getMonth() + rule.interval);
      }
      return d;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + rule.interval);
      return d;
    default:
      return null;
  }
}

/** Wyliczone pola następnego wystąpienia zadania cyklicznego. */
export interface RecurringSuccessor {
  /** Termin następnego wystąpienia. */
  nextDue: Date;
  /** Data startu następnego wystąpienia (zachowuje wyprzedzenie względem terminu);
   * `null`, gdy poprzednik nie miał kompletu start+termin. */
  nextStart: Date | null;
}

/**
 * Czysta logika wyliczania pól następnika zadania cyklicznego (bez bazy danych) — wspólna dla
 * wszystkich wejść (UI, operacje zbiorcze, asystent AI). Zwraca `null`, gdy seria się skończyła
 * (nieznana reguła albo termin za `endDate`).
 *
 * `anchor` liczy bazę terminu: `COMPLETION` = od daty wykonania; `DUE` (domyślnie) = od terminu
 * zadania (fallback: data wykonania). `nextDueOverride` (ISO) pomija `computeNextDue`.
 */
export function computeRecurringSuccessor(
  input: { recurring: RecurringRule; dueDate: Date | null; startDate: Date | null; completedAt: Date },
  opts: { anchor?: "DUE" | "COMPLETION"; nextDueOverride?: string } = {},
): RecurringSuccessor | null {
  const rule = input.recurring;
  const anchor = opts.anchor ?? rule.anchor;
  const base = anchor === "COMPLETION" ? input.completedAt : input.dueDate ?? input.completedAt;
  const nextDue = opts.nextDueOverride ? new Date(opts.nextDueOverride) : computeNextDue(base, rule);
  if (!nextDue) return null;
  if (rule.endDate && nextDue > new Date(rule.endDate)) return null;

  // Zachowaj wyprzedzenie startu względem terminu (przesuwamy startDate o tę samą różnicę co termin).
  // Bez kompletu start+termin nie da się policzyć → start pomijamy.
  let nextStart: Date | null = null;
  if (input.startDate && input.dueDate) {
    nextStart = new Date(input.startDate.getTime() + (nextDue.getTime() - input.dueDate.getTime()));
  }
  return { nextDue, nextStart };
}

/** Parse a JSON-encoded RecurringRule string; returns null on empty/invalid. */
export function parseRecurringRule(raw: string | null | undefined): RecurringRule | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RecurringRule;
  } catch {
    return null;
  }
}

const DAY_NAMES = ["nd", "pon", "wt", "śr", "czw", "pt", "sb"];

/** Krótki, czytelny opis reguły cykliczności do UI/AI (np. "co tydzień: pon, śr"). */
export function describeRecurringRule(rule: RecurringRule | null | undefined): string | null {
  if (!rule) return null;
  const n = Math.max(1, rule.interval || 1);
  let base: string;
  switch (rule.type) {
    case "DAILY":
      base = n === 1 ? "codziennie" : `co ${n} dni`;
      break;
    case "WEEKLY": {
      const every = n === 1 ? "co tydzień" : `co ${n} tyg.`;
      const days = rule.daysOfWeek?.length
        ? `: ${[...rule.daysOfWeek].sort((a, b) => a - b).map((d) => DAY_NAMES[d] ?? String(d)).join(", ")}`
        : "";
      base = `${every}${days}`;
      break;
    }
    case "MONTHLY": {
      const every = n === 1 ? "co miesiąc" : `co ${n} mies.`;
      base = rule.dayOfMonth ? `${every} (${rule.dayOfMonth}. dnia)` : every;
      break;
    }
    case "YEARLY":
      base = n === 1 ? "co rok" : `co ${n} lata`;
      break;
    default:
      return null;
  }
  if (rule.endDate) base += ` do ${String(rule.endDate).slice(0, 10)}`;
  return base;
}
