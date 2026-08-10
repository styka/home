"use client";

import type { TaskTagDef } from "@/types";

interface TaskTagBadgeProps {
  tag: TaskTagDef;
  onRemove?: () => void;
  size?: "sm" | "xs";
}

export function TaskTagBadge({ tag, onRemove, size = "sm" }: TaskTagBadgeProps) {
  const hex = tag.color ?? "#6b7280";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-medium"
      style={{
        background: `rgba(${r},${g},${b},0.15)`,
        color: hex,
        border: `1px solid rgba(${r},${g},${b},0.3)`,
        fontSize: size === "xs" ? 10 : 11,
        padding: size === "xs" ? "0px 5px" : "1px 7px",
        lineHeight: 1.6,
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="hover:opacity-70 focus:outline-none leading-none"
          style={{ fontSize: 12, marginLeft: 1 }}
          aria-label="Remove tag"
        >
          ×
        </button>
      )}
    </span>
  );
}
