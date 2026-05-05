"use client";

import { TaskRow } from "./TaskRow";
import type { Task, TaskStatusFilter, ViewMode } from "@/types";

interface TaskListProps {
  tasks: Task[];
  filter: TaskStatusFilter;
  viewMode: ViewMode;
  selectedTagIds: string[];
  focusedTaskId: string | null;
  onFocus: (id: string) => void;
  onOpen: (id: string) => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "🔴 Pilne",
  HIGH: "🟠 Wysoki",
  MEDIUM: "🟡 Średni",
  LOW: "🔵 Niski",
  NONE: "⚪ Brak priorytetu",
};

export function TaskList({ tasks, filter, viewMode, selectedTagIds, focusedTaskId, onFocus, onOpen, rowRefs }: TaskListProps) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function applyTagFilter(list: Task[]): Task[] {
    if (selectedTagIds.length === 0) return list;
    return list.filter((t) =>
      selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid))
    );
  }

  function applyStatusFilter(list: Task[]): Task[] {
    if (filter === "ALL") return list.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
    return list.filter((t) => t.status === filter);
  }

  const filtered = applyTagFilter(applyStatusFilter(tasks));

  function renderTask(task: Task) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        isFocused={focusedTaskId === task.id}
        isSelected={focusedTaskId === task.id}
        onFocus={() => onFocus(task.id)}
        onOpen={() => onOpen(task.id)}
        rowRef={(el) => { if (el) rowRefs.current.set(task.id, el); else rowRefs.current.delete(task.id); }}
      />
    );
  }

  const emptyLabel: Record<ViewMode, string> = {
    today: "Brak zadań na dziś",
    upcoming: "Brak nadchodzących zadań",
    overdue: "Brak zaległych zadań",
    all: "Brak zadań",
    project: "Brak zadań w projekcie",
  };

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-16" style={{ color: "var(--text-muted)" }}>
        <div className="text-4xl mb-3">✓</div>
        <p className="text-sm">{emptyLabel[viewMode]}</p>
        {filter !== "ALL" && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Spróbuj zmienić filtr statusu</p>}
      </div>
    );
  }

  // Upcoming view: group by day
  if (viewMode === "upcoming") {
    const withDate = filtered.filter((t) => t.dueDate);
    const withoutDate = filtered.filter((t) => !t.dueDate);

    const dayMap = new Map<string, { label: string; date: Date; tasks: Task[] }>();
    withDate.forEach((t) => {
      const d = new Date(t.dueDate!);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!dayMap.has(key)) {
        const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.floor((taskDay.getTime() - todayStart.getTime()) / 86400000);
        let label: string;
        if (diff === 1) label = "Jutro";
        else if (diff < 7) label = d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "short" });
        else label = d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: diff > 365 ? "numeric" : undefined });
        dayMap.set(key, { label, date: taskDay, tasks: [] });
      }
      dayMap.get(key)!.tasks.push(t);
    });

    const entries = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="flex-1 overflow-y-auto">
        {entries.map(([key, { label, tasks: dayTasks }]) => (
          <div key={key}>
            <div
              className="flex items-center gap-2 px-4 py-1 text-xs font-medium sticky top-0"
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
            >
              {label}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({dayTasks.length})</span>
            </div>
            {dayTasks.map(renderTask)}
          </div>
        ))}
        {withoutDate.length > 0 && (
          <div>
            <div
              className="flex items-center gap-2 px-4 py-1 text-xs font-medium sticky top-0"
              style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
            >
              Bez terminu
              <span style={{ fontWeight: 400 }}>({withoutDate.length})</span>
            </div>
            {withoutDate.map(renderTask)}
          </div>
        )}
      </div>
    );
  }

  // Overdue view: flat list sorted oldest first
  if (viewMode === "overdue") {
    return (
      <div className="flex-1 overflow-y-auto">
        {filtered.map(renderTask)}
      </div>
    );
  }

  // Today / all / project: group by priority
  const done = filter === "ALL"
    ? applyTagFilter(tasks.filter((t) => t.status === "DONE" || t.status === "CANCELLED"))
    : [];

  return (
    <div className="flex-1 overflow-y-auto">
      {PRIORITY_ORDER.map((priority) => {
        const group = filtered.filter((t) => t.priority === priority);
        if (group.length === 0) return null;
        return (
          <div key={priority}>
            <div
              className="flex items-center gap-2 px-4 py-1 text-xs font-medium sticky top-0"
              style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
            >
              {PRIORITY_LABELS[priority]}
              <span style={{ fontWeight: 400 }}>({group.length})</span>
            </div>
            {group.map(renderTask)}
          </div>
        );
      })}
      {done.length > 0 && (
        <div>
          <div
            className="flex items-center gap-2 px-4 py-1 text-xs font-medium sticky top-0"
            style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
          >
            ✓ Zrobione / Anulowane
            <span style={{ fontWeight: 400 }}>({done.length})</span>
          </div>
          {done.map(renderTask)}
        </div>
      )}
    </div>
  );
}
