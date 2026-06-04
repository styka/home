"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface TaskGroupProps {
  label: React.ReactNode;
  count: number;
  /** Domyślny stan rozwinięcia. Zwykłe grupy (dziś/nadchodzące/projekty/priorytety)
   *  są domyślnie rozwinięte; „Zrobione / Anulowane" przekazuje `false`. */
  defaultOpen?: boolean;
  /** Wycisza kolor nagłówka (text-muted zamiast text-secondary). */
  muted?: boolean;
  children: React.ReactNode;
}

// Zwijana sekcja-grupa na liście zadań. Nagłówek pełni rolę przycisku rozwijania
// (z licznikiem i obracaną strzałką) — wspólny dla wszystkich grup (dni, projekty,
// priorytety, „Zrobione"). Stan zwinięcia jest lokalny (per-grupa, per-render widoku).
export function TaskGroup({ label, count, defaultOpen = true, muted = false, children }: TaskGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 px-4 py-1 text-xs font-medium w-full sticky top-0 focus:outline-none"
        style={{ color: muted ? "var(--text-muted)" : "var(--text-secondary)", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
      >
        <ChevronRight
          size={12}
          style={{ transition: "transform 0.12s", transform: open ? "rotate(90deg)" : "none", flexShrink: 0 }}
        />
        {label}
        <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({count})</span>
      </button>
      {open && children}
    </div>
  );
}
