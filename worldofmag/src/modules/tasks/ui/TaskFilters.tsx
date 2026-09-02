"use client";

import type { TaskStatusFilter, TaskTagDef } from "@/types";
import { TASK_STATUS_FILTERS, TASK_STATUS_FILTER_LABELS } from "@/types";
import { FiltrTagow } from "./FiltrTagow";

interface TaskFiltersProps {
  // Klucz zakładki: "ALL" | status systemowy | klucz własnego statusu (stąd string).
  active: string;
  counts: Record<string, number>;
  onChange: (f: string) => void;
  allTags: TaskTagDef[];
  selectedTagIds: string[];
  onTagToggle: (id: string) => void;
  /** Zdejmuje wszystkie etykiety naraz („Wszystkie" w panelu). Pusty wybór = wszystkie zadania. */
  onTagsClear: () => void;
  // Zakładki statusów do pokazania (zależne od konfiguracji listy). Domyślnie wszystkie systemowe.
  filters?: string[];
  // Etykiety zakładek (zawiera też nazwy własnych statusów). Fallback: klucz statusu.
  labels?: Record<string, string>;
  // Czy pokazać wiersz zakładek statusu. W Kanbanie ukrywamy (kolumny = statusy). Domyślnie true.
  showStatusTabs?: boolean;
}

export function TaskFilters({ active, counts, onChange, allTags, selectedTagIds, onTagToggle, onTagsClear, filters = TASK_STATUS_FILTERS, labels, showStatusTabs = true }: TaskFiltersProps) {
  // Bez zakładek i bez tagów nie ma czego pokazywać (Kanban bez tagów) — nie renderuj pustego paska.
  if (!showStatusTabs && allTags.length === 0) return null;
  return (
    <div
      className="flex-shrink-0 border-b"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      {/* 118 (zgł. 1): JEDEN wiersz — zakładki statusu i filtr etykiet obok siebie. Do 118 filtr
          zajmował własny, drugi wiersz nawet bez żadnej wybranej etykiety, więc chrome nad listą
          rósł o ~38 px na darmo. Zakładki przewijają się we własnym polu (`flex-1 min-w-0`),
          filtr stoi po prawej; wysokość wiersza jest stała niezależnie od liczby etykiet. */}
      <div className="flex items-center gap-0 px-2" style={{ minHeight: 38 }}>
        {showStatusTabs && (
          <div className="flex min-w-0 flex-1 items-center gap-0 overflow-x-auto">
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
        )}

        {/* 100 (AC-6..AC-9): jeden przycisk z licznikiem zamiast chipsa na każdą istniejącą
            etykietę; semantyka filtru (koniunkcja w `TasksPage`) zostaje bez zmiany. */}
        {allTags.length > 0 && (
          <div className="ml-auto flex min-w-0 shrink items-center">
            <FiltrTagow
              wszystkie={allTags}
              wybrane={selectedTagIds}
              onPrzelacz={onTagToggle}
              onWyczysc={onTagsClear}
            />
          </div>
        )}
      </div>
    </div>
  );
}
