"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Task } from "@/types";

interface CompletedSectionProps {
  tasks: Task[];
  renderTask: (task: Task) => React.ReactNode;
}

// Sekcja „Zrobione / Anulowane" na dole listy zadań (filtr „Wszystkie").
// Domyślnie zwinięta — ukończone zadania nie zaśmiecają widoku, a nagłówek
// pełni rolę przycisku rozwijania (z licznikiem i obracaną strzałką).
export function CompletedSection({ tasks, renderTask }: CompletedSectionProps) {
  const [open, setOpen] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 px-4 py-1 text-xs font-medium w-full sticky top-0 focus:outline-none"
        style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
      >
        <ChevronRight
          size={12}
          style={{ transition: "transform 0.12s", transform: open ? "rotate(90deg)" : "none", flexShrink: 0 }}
        />
        ✓ Zrobione / Anulowane
        <span style={{ fontWeight: 400 }}>({tasks.length})</span>
      </button>
      {open && tasks.map(renderTask)}
    </div>
  );
}
