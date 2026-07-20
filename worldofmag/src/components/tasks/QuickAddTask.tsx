"use client";

import { useState, useRef, useTransition, useImperativeHandle, forwardRef } from "react";
import { Plus, Loader2, Calendar } from "lucide-react";
import { createTask } from "@/actions/tasks";
import { llm } from "@/lib/llm-client";
import { useToast } from "@/components/ui/Toast";
import type { Task, TaskPriority } from "@/types";

export interface QuickAddTaskHandle {
  focus: () => void;
}

/** Awaryjny tytuł z treści, gdy LLM jest niedostępny: pierwszy wiersz, przycięty do ~60 znaków. */
function deriveLocalTitle(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= 60) return firstLine;
  const cut = firstLine.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

interface QuickAddTaskProps {
  projectId: string;
  /** Po utworzeniu zadania — otwiera jego szczegóły, by ustawić pozostałe parametry.
   *  Przekazuje cały obiekt, bo w widokach wirtualnych (Dziś/Nadchodzące…) nowe zadanie
   *  trafia do Skrzynki i nie wchodzi do przefiltrowanej listy — panel używa go jako fallback. */
  onCreated?: (task: Task) => void;
}

export const QuickAddTask = forwardRef<QuickAddTaskHandle, QuickAddTaskProps>(
  function QuickAddTask({ projectId, onCreated }, ref) {
    const [value, setValue] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("NONE");
    const [dueDate, setDueDate] = useState("");
    const [showExtra, setShowExtra] = useState(false);
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    useImperativeHandle(ref, () => ({
      focus: () => { inputRef.current?.focus(); setShowExtra(true); },
    }));

    function handleSubmit(e?: React.FormEvent) {
      e?.preventDefault();
      const text = value.trim();
      if (!text) return;

      startTransition(async () => {
        try {
          // Wpisany tekst traktujemy jako TREŚĆ zadania, a tytuł generujemy z niej.
          // Wyjątek: krótki, jednowierszowy tekst to po prostu sam tytuł (np. „kup mleko") —
          // wtedy nie dublujemy go w opisie ani nie wołamy LLM.
          const isShortTitle = !text.includes("\n") && text.length <= 50;

          let title = text;
          let description: string | null = null;

          if (!isShortTitle) {
            description = text;
            title = deriveLocalTitle(text);
            try {
              const res = await llm.tasks.suggestTitle(text);
              if (res.title?.trim()) title = res.title.trim();
            } catch {
              /* brak LLM / offline — zostaje tytuł lokalny */
            }
          }

          const created = await createTask({
            title,
            description,
            priority,
            dueDate: dueDate ? new Date(dueDate + "T12:00:00") : null,
            projectId: ["today", "upcoming", "overdue", "all"].includes(projectId) ? null : projectId,
          });
          setValue("");
          setDueDate("");
          setPriority("NONE");
          setShowExtra(false);
          onCreated?.(created);
        } catch (err) {
          showToast(err instanceof Error ? err.message : "Nie udało się dodać zadania", "error");
        }
      });
    }

    const PRIORITY_OPTS: { value: TaskPriority; label: string; color: string }[] = [
      { value: "NONE", label: "—", color: "var(--text-muted)" },
      { value: "LOW", label: "↓", color: "#3b82f6" },
      { value: "MEDIUM", label: "◆", color: "#f59e0b" },
      { value: "HIGH", label: "↑", color: "#ef4444" },
      { value: "URGENT", label: "‼", color: "#dc2626" },
    ];

    const currentPriority = PRIORITY_OPTS.find((p) => p.value === priority)!;

    return (
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Priority picker */}
          <button
            type="button"
            onClick={() => {
              const opts: TaskPriority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];
              const idx = opts.indexOf(priority);
              setPriority(opts[(idx + 1) % opts.length]);
            }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded focus:outline-none text-sm font-bold"
            style={{ color: currentPriority.color }}
            title="Priorytet (kliknij by zmienić)"
          >
            {currentPriority.label}
          </button>

          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setShowExtra(true)}
            placeholder="Dodaj lub opisz zadanie — tytuł powstanie sam (a / n)"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />

          {showExtra && (
            <div
              className="flex items-center gap-1 rounded border px-2 py-1"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
            >
              <Calendar size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-transparent text-xs focus:outline-none"
                style={{ color: "var(--text-secondary)", width: 116 }}
                title="Termin"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!value.trim() || isPending}
            className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded focus:outline-none disabled:opacity-30"
            style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          </button>
        </div>
      </form>
    );
  }
);
