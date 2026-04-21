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
      className="flex items-center gap-1 px-4 border-b"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      {FILTER_TABS.map((tab, i) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px",
              "focus:outline-none"
            )}
            style={{
              borderBottomColor: isActive ? "var(--accent-blue)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--text-muted)";
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
                  minWidth: "18px",
                  textAlign: "center",
                }}
              >
                {counts[tab]}
              </span>
            )}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-2 py-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          <kbd>1</kbd>–<kbd>5</kbd> filter &nbsp; <kbd>j</kbd><kbd>k</kbd> navigate &nbsp; <kbd>Space</kbd> toggle &nbsp; <kbd>⌘K</kbd> palette
        </span>
      </div>
    </div>
  );
}
