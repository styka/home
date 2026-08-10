"use client";

import { RefreshCw } from "lucide-react";
import type { RecurringRule } from "@/types";

const DAY_NAMES = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

function formatRecurring(rule: RecurringRule): string {
  const interval = rule.interval === 1 ? "" : `co ${rule.interval} `;
  switch (rule.type) {
    case "DAILY":
      return rule.interval === 1 ? "codziennie" : `co ${rule.interval} dni`;
    case "WEEKLY":
      if (rule.daysOfWeek?.length) {
        return rule.daysOfWeek.sort().map((d) => DAY_NAMES[d]).join(", ");
      }
      return rule.interval === 1 ? "co tydzień" : `co ${rule.interval} tyg.`;
    case "MONTHLY":
      return rule.interval === 1 ? "co miesiąc" : `co ${rule.interval} mies.`;
    case "YEARLY":
      return rule.interval === 1 ? "co rok" : `co ${rule.interval} lat`;
    default:
      return "cyklicznie";
  }
}

interface RecurringBadgeProps {
  recurring: string;
}

export function RecurringBadge({ recurring }: RecurringBadgeProps) {
  let rule: RecurringRule;
  try {
    rule = JSON.parse(recurring);
  } catch {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded text-xs"
      style={{ color: "var(--accent-purple)", background: "rgba(168,85,247,0.1)", padding: "1px 5px" }}
      title={`Powtarza się: ${formatRecurring(rule)}`}
    >
      <RefreshCw size={9} />
      <span>{formatRecurring(rule)}</span>
    </span>
  );
}
