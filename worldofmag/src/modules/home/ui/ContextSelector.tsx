"use client";

import { ShoppingCart, CheckSquare, FileText } from "lucide-react";

const MODULES = [
  { id: "shopping", label: "Zakupy", icon: <ShoppingCart size={13} /> },
  { id: "tasks", label: "Zadania", icon: <CheckSquare size={13} /> },
  { id: "notes", label: "Notatki", icon: <FileText size={13} /> },
] as const;

interface ContextSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function ContextSelector({ selected, onChange }: ContextSelectorProps) {
  const allSelected = selected.length === MODULES.length;

  function toggle(id: string) {
    if (selected.includes(id)) {
      const next = selected.filter((s) => s !== id);
      onChange(next.length === 0 ? MODULES.map((m) => m.id) : next);
    } else {
      onChange([...selected, id]);
    }
  }

  function selectAll() {
    onChange(MODULES.map((m) => m.id));
  }

  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
        Kontekst AI
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={selectAll}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            border: `1px solid ${allSelected ? "var(--accent-purple)" : "var(--border)"}`,
            background: allSelected ? "rgba(168,85,247,0.12)" : "var(--bg-surface)",
            color: allSelected ? "var(--accent-purple)" : "var(--text-secondary)",
            cursor: "pointer",
            transition: "all 0.1s",
          }}
        >
          Wszystko
        </button>
        {MODULES.map((mod) => {
          const isActive = selected.includes(mod.id);
          return (
            <button
              key={mod.id}
              onClick={() => toggle(mod.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                border: `1px solid ${isActive && !allSelected ? "var(--accent-blue)" : "var(--border)"}`,
                background: isActive && !allSelected ? "rgba(59,130,246,0.12)" : "var(--bg-surface)",
                color: isActive && !allSelected ? "var(--accent-blue)" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.1s",
              }}
            >
              {mod.icon}
              {mod.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
