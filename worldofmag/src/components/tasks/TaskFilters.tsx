"use client";

import type { TaskStatusFilter, TaskTagDef } from "@/types";
import { TASK_STATUS_FILTERS, TASK_STATUS_FILTER_LABELS } from "@/types";
import { TaskTagBadge } from "./TaskTagBadge";

interface TaskFiltersProps {
  active: TaskStatusFilter;
  counts: Record<TaskStatusFilter, number>;
  onChange: (f: TaskStatusFilter) => void;
  allTags: TaskTagDef[];
  selectedTagIds: string[];
  onTagToggle: (id: string) => void;
}

export function TaskFilters({ active, counts, onChange, allTags, selectedTagIds, onTagToggle }: TaskFiltersProps) {
  return (
    <div
      className="flex-shrink-0 border-b"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <div className="flex items-center gap-0 overflow-x-auto px-2" style={{ minHeight: 38 }}>
        {TASK_STATUS_FILTERS.map((f) => {
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
              {TASK_STATUS_FILTER_LABELS[f]}
              {count > 0 && (
                <span
                  className="rounded-full px-1.5"
                  style={{
                    background: isActive ? "var(--accent-blue)" : "var(--bg-elevated)",
                    color: isActive ? "#fff" : "var(--text-muted)",
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

      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => onTagToggle(tag.id)}
              className="focus:outline-none flex-shrink-0"
              style={{ opacity: selectedTagIds.length === 0 || selectedTagIds.includes(tag.id) ? 1 : 0.4 }}
            >
              <TaskTagBadge tag={tag} size="xs" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
