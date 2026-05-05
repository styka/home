"use client";

import { useState, useRef, useTransition, useImperativeHandle, forwardRef } from "react";
import { Plus, Loader2 } from "lucide-react";
import { createTask } from "@/actions/tasks";
import type { TaskPriority } from "@/types";

export interface QuickAddTaskHandle {
  focus: () => void;
}

interface QuickAddTaskProps {
  projectId: string;
}

export const QuickAddTask = forwardRef<QuickAddTaskHandle, QuickAddTaskProps>(
  function QuickAddTask({ projectId }, ref) {
    const [value, setValue] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("NONE");
    const [dueDate, setDueDate] = useState("");
    const [showExtra, setShowExtra] = useState(false);
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => { inputRef.current?.focus(); setShowExtra(true); },
    }));

    function handleSubmit(e?: React.FormEvent) {
      e?.preventDefault();
      const title = value.trim();
      if (!title) return;

      startTransition(async () => {
        await createTask({
          title,
          priority,
          dueDate: dueDate ? new Date(dueDate) : null,
          projectId: ["today", "upcoming", "overdue"].includes(projectId) ? null : projectId,
        });
        setValue("");
        setDueDate("");
        setPriority("NONE");
        setShowExtra(false);
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
            placeholder="Dodaj zadanie… (a / n)"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />

          {showExtra && (
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-transparent text-xs focus:outline-none border rounded px-1 py-0.5"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", width: 120 }}
              title="Termin"
            />
          )}

          <button
            type="submit"
            disabled={!value.trim() || isPending}
            className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded focus:outline-none disabled:opacity-30"
            style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          </button>
        </div>
      </form>
    );
  }
);
