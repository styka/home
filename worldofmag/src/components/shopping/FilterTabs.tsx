"use client";

import { FILTER_TABS, FILTER_LABELS, type FilterTab } from "@/types";
import { cn } from "@/lib/cn";

interface FilterTabsProps {
  active: FilterTab;
  counts: Record<FilterTab, number>;
  onChange: (tab: FilterTab) => void;
}

export function FilterTabs({ active, counts, onChange }: FilterTabsProps) {
  return (
    <div
      className="flex items-center border-b overflow-x-auto"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <div className="flex items-center gap-0.5 px-2 flex-shrink-0">
        {FILTER_TABS.map((tab, i) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              onClick={() => onChange(tab)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-3 text-xs font-medium border-b-2 -mb-px whitespace-nowrap",
                "focus:outline-none"
              )}
              style={{
                borderBottomColor: isActive ? "var(--accent-blue)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
              }}
              title={`${FILTER_LABELS[tab]} (${i + 1})`}
            >
              {FILTER_LABELS[tab]}
              {counts[tab] > 0 && (
                <span
                  className="text-xs px-1 rounded"
                  style={{
                    backgroundColor: isActive ? "rgba(59,130,246,0.15)" : "var(--bg-elevated)",
                    color: isActive ? "var(--accent-blue)" : "var(--text-muted)",
                    minWidth: "16px",
                    textAlign: "center",
                  }}
                >
                  {counts[tab]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Keyboard hints — desktop only */}
      <div className="hidden md:flex ml-auto items-center gap-2 px-4 py-2 flex-shrink-0">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          <kbd>1</kbd>–<kbd>5</kbd>&nbsp; <kbd>j</kbd><kbd>k</kbd>&nbsp; <kbd>Space</kbd>&nbsp; <kbd>⌘K</kbd>
        </span>
      </div>
    </div>
  );
}
