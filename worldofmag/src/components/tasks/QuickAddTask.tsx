"use client";

import { useState, useRef, useTransition, useImperativeHandle, forwardRef } from "react";
import { Plus, Loader2 } from "lucide-react";
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
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    useImperativeHandle(ref, () => ({
      focus: () => { inputRef.current?.focus(); },
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

          // Szybkie przechwytywanie: zapisujemy tytuł (+priorytet). Termin, projekt,
          // powtarzalność, podzadania itd. ustawia się w pełnym formularzu (TaskDetail),
          // otwieranym kliknięciem zadania — spójnie z edycją i innymi modułami.
          const created = await createTask({
            title,
            description,
            priority,
            dueDate: null,
            projectId: ["today", "upcoming", "overdue", "all"].includes(projectId) ? null : projectId,
          });
          setValue("");
          setPriority("NONE");
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
        {/* Szybkie przechwytywanie: jeden czysty rząd [priorytet][tytuł][+] — mieści się
            zawsze (mobile i desktop), przycisk „+" nigdy nie ucieka poza ekran. Termin i
            pozostałe pola ustawia się w pełnym formularzu (TaskDetail) po kliknięciu zadania. */}
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Priority picker */}
          <button
            type="button"
            onClick={() => {
              const opts: TaskPriority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];
              const idx = opts.indexOf(priority);
              setPriority(opts[(idx + 1) % opts.length]);
            }}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded focus:outline-none text-sm font-bold"
            style={{ color: currentPriority.color }}
            title="Priorytet (kliknij by zmienić)"
          >
            {currentPriority.label}
          </button>

          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Dodaj lub opisz zadanie — tytuł powstanie sam (a / n)"
            className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />

          <button
            type="submit"
            disabled={!value.trim() || isPending}
            className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded focus:outline-none disabled:opacity-30"
            style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
            title="Dodaj zadanie"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>
      </form>
    );
  }
);
