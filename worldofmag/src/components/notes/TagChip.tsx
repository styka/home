"use client";

import { X } from "lucide-react";
import type { Tag } from "@/types";

interface TagChipProps {
  tag: Tag;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  size?: "sm" | "xs";
}

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "#3b82f6": { bg: "rgba(59,130,246,0.2)", text: "#3b82f6" },
  "#10b981": { bg: "rgba(16,185,129,0.2)", text: "#10b981" },
  "#f59e0b": { bg: "rgba(245,158,11,0.2)", text: "#f59e0b" },
  "#ef4444": { bg: "rgba(239,68,68,0.2)", text: "#ef4444" },
  "#8b5cf6": { bg: "rgba(139,92,246,0.2)", text: "#8b5cf6" },
  "#ec4899": { bg: "rgba(236,72,153,0.2)", text: "#ec4899" },
  "#06b6d4": { bg: "rgba(6,182,212,0.2)", text: "#06b6d4" },
  "#84cc16": { bg: "rgba(132,204,22,0.2)", text: "#84cc16" },
};

export function getTagStyle(color: string | null) {
  if (color && TAG_COLORS[color]) return TAG_COLORS[color];
  return { bg: "rgba(176,176,176,0.15)", text: "var(--text-secondary)" };
}

export const TAG_COLOR_OPTIONS = Object.keys(TAG_COLORS);

export function TagChip({ tag, onRemove, onClick, active, size = "xs" }: TagChipProps) {
  const style = getTagStyle(tag.color);
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-1.5 py-0 text-[11px]";

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full font-medium ${padding} ${onClick ? "cursor-pointer" : ""}`}
      style={{
        backgroundColor: active ? style.bg : `${style.bg}`,
        color: style.text,
        opacity: active === false ? 0.5 : 1,
        border: active ? `1px solid ${style.text}40` : "1px solid transparent",
      }}
    >
      #{tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="hover:opacity-70 focus:outline-none"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}
