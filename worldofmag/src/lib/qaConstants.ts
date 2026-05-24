export const SCENARIO_TYPES = ["positive", "negative", "edge"] as const;
export type ScenarioType = (typeof SCENARIO_TYPES)[number];

export const PRIORITIES = ["P0", "P1", "P2"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
  positive: "Pozytywny",
  negative: "Negatywny",
  edge: "Edge case",
};

export const SCENARIO_TYPE_COLORS: Record<ScenarioType, string> = {
  positive: "var(--accent-green)",
  negative: "var(--accent-red)",
  edge: "var(--accent-amber)",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: "P0 — Smoke",
  P1: "P1 — Regression",
  P2: "P2 — Nice-to-have",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  P0: "var(--accent-red)",
  P1: "var(--accent-amber)",
  P2: "var(--text-muted)",
};

export function getScenarioTypeLabel(type: string): string {
  return SCENARIO_TYPE_LABELS[type as ScenarioType] ?? type;
}

export function getScenarioTypeColor(type: string): string {
  return SCENARIO_TYPE_COLORS[type as ScenarioType] ?? "var(--text-muted)";
}

export function getPriorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority as Priority] ?? priority;
}

export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority as Priority] ?? "var(--text-muted)";
}
