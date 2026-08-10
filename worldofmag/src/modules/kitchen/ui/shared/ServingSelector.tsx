"use client";

import { Minus, Plus } from "lucide-react";

interface ServingSelectorProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
  label?: string;
}

export function ServingSelector({ value, onChange, min = 1, max = 99, className, label }: ServingSelectorProps) {
  return (
    <div
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      {label ? (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      ) : null}
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        aria-label="Zmniejsz porcje"
      >
        <Minus size={14} />
      </button>
      <span
        className="px-2 text-sm font-medium tabular-nums"
        style={{ color: "var(--text-primary)", minWidth: 28, textAlign: "center" }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        aria-label="Zwiększ porcje"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
