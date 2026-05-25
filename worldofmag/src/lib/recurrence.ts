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
      d.setMonth(d.getMonth() + rule.interval);
      return d;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + rule.interval);
      return d;
    default:
      return null;
  }
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
