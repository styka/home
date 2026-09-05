"use client";

import type { TaskStatusFilter } from "@/types";
import { TASK_STATUS_FILTERS, TASK_STATUS_FILTER_LABELS } from "@/types";

interface TaskFiltersProps {
  // Klucz zakładki: "ALL" | status systemowy | klucz własnego statusu (stąd string).
  active: string;
  counts: Record<string, number>;
  onChange: (f: string) => void;
  // Zakładki statusów do pokazania (zależne od konfiguracji listy). Domyślnie wszystkie systemowe.
  filters?: string[];
  // Etykiety zakładek (zawiera też nazwy własnych statusów). Fallback: klucz statusu.
  labels?: Record<string, string>;
  // Czy pokazać wiersz zakładek statusu. W Kanbanie ukrywamy (kolumny = statusy). Domyślnie true.
  showStatusTabs?: boolean;
}

/**
 * 125 (zgł. 3): wiersz to znowu SAME zakładki statusów. Scalenie z filtrem etykiet (118) przy
 * kilku wybranych tagach wypychało zakładki poza kadr — filtr mieszka teraz w górnym pasku akcji
 * widoku (`FiltrTagow` w `TasksPage`), więc zakładki mają cały wiersz dla siebie, a Kanban
 * (kolumny = statusy) nie renderuje wiersza wcale.
 */
export function TaskFilters({ active, counts, onChange, filters = TASK_STATUS_FILTERS, labels, showStatusTabs = true }: TaskFiltersProps) {
  if (!showStatusTabs) return null;
  return (
    <div
      className="flex-shrink-0 border-b"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <div className="flex items-center gap-0 overflow-x-auto px-2" style={{ minHeight: 38 }}>
        {filters.map((f) => {
          const isActive = active === f;
          const count = counts[f];
          return (
            <button
              key={f}
              onClick={() => onChange(f)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap focus:outline-none flex-shrink-0"
              style={{
                color: isActive ? "var(--accent-blue)" : "var(--text-muted)",
                borderBottom: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {labels?.[f] ?? TASK_STATUS_FILTER_LABELS[f as TaskStatusFilter] ?? f}
              {count > 0 && (
                <span
                  className="rounded-full px-1.5"
                  style={{
                    background: isActive ? "var(--accent-blue)" : "var(--bg-elevated)",
                    color: isActive ? "var(--on-accent)" : "var(--text-muted)",
                    fontSize: 10,
                    minWidth: 16,
                    textAlign: "center",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
