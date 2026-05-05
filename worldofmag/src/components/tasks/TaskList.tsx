"use client";

import { TaskRow } from "./TaskRow";
import type { Task, TaskFilter } from "@/types";

interface TaskListProps {
  tasks: Task[];
  filter: TaskFilter;
  selectedTagIds: string[];
  focusedTaskId: string | null;
  onFocus: (id: string) => void;
  onOpen: (id: string) => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

export function TaskList({ tasks, filter, selectedTagIds, focusedTaskId, onFocus, onOpen, rowRefs }: TaskListProps) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  function applyFilters(list: Task[]): Task[] {
    let result = list;

    if (filter === "TODAY") {
      result = result.filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < todayEnd);
    } else if (filter === "UPCOMING") {
      result = result.filter((t) => t.dueDate && new Date(t.dueDate) >= todayEnd);
    } else if (filter === "OVERDUE") {
      result = result.filter((t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== "DONE" && t.status !== "CANCELLED");
    } else if (filter === "IN_PROGRESS") {
      result = result.filter((t) => t.status === "IN_PROGRESS");
    } else if (filter === "DONE") {
      result = result.filter((t) => t.status === "DONE");
    } else {
      // ALL: hide DONE and CANCELLED by default
      result = result.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
    }

    if (selectedTagIds.length > 0) {
      result = result.filter((t) =>
        selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid))
      );
    }

    return result;
  }

  const filtered = applyFilters(tasks);
  const done = filter === "ALL" ? tasks.filter((t) => t.status === "DONE" || t.status === "CANCELLED") : [];

  // Group active tasks by priority for ALL view
  const groupByPriority = filter === "ALL";
  const priorities = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as const;

  if (filtered.length === 0 && done.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-16" style={{ color: "var(--text-muted)" }}>
        <div className="text-4xl mb-3">✓</div>
        <p className="text-sm">Brak zadań do wyświetlenia</p>
      </div>
    );
  }

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

  return (
    <div className="flex-1 overflow-y-auto">
      {groupByPriority ? (
        <>
          {priorities.map((priority) => {
            const group = filtered.filter((t) => t.priority === priority);
            if (group.length === 0) return null;
            const labels: Record<string, string> = { URGENT: "🔴 Pilne", HIGH: "🟠 Wysoki", MEDIUM: "🟡 Średni", LOW: "🔵 Niski", NONE: "⚪ Brak priorytetu" };
            return (
              <div key={priority}>
                <div
                  className="flex items-center gap-2 px-4 py-1 text-xs font-medium sticky top-0"
                  style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-base)", borderBottom: `1px solid var(--border)` }}
                >
                  {labels[priority]}
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({group.length})</span>
                </div>
                {group.map(renderTask)}
              </div>
            );
          })}
          {done.length > 0 && (
            <div>
              <div
                className="flex items-center gap-2 px-4 py-1 text-xs font-medium sticky top-0"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-base)", borderBottom: `1px solid var(--border)` }}
              >
                ✓ Zrobione / Anulowane
                <span style={{ fontWeight: 400 }}>({done.length})</span>
              </div>
              {done.map(renderTask)}
            </div>
          )}
        </>
      ) : (
        filtered.map(renderTask)
      )}
    </div>
  );
}
