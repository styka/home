"use client";

import { TaskRow } from "./TaskRow";
import { CompletedSection } from "./CompletedSection";
import type { Task, TaskStatusFilter, ViewMode } from "@/types";

interface TaskListProps {
  tasks: Task[];
  filter: TaskStatusFilter;
  viewMode: ViewMode;
  /** "default" = naturalne grupowanie widoku (po dniach/projektach); "priority" = grupowanie po priorytetach (jak w „Dziś"). */
  groupBy: "default" | "priority";
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

/**
 * Sortowanie wewnątrz grupy: po terminie rosnąco — najbardziej zaległe (najwcześniejsze)
 * na górze, terminy przyszłe niżej; zadania bez terminu na końcu (stabilnie wg `order`).
 */
function byDueDateAsc(a: Task, b: Task): number {
  const da = a.dueDate ? new Date(a.dueDate).getTime() : null;
  const db = b.dueDate ? new Date(b.dueDate).getTime() : null;
  if (da === null && db === null) return (a.order ?? 0) - (b.order ?? 0);
  if (da === null) return 1;
  if (db === null) return -1;
  if (da !== db) return da - db;
  return (a.order ?? 0) - (b.order ?? 0);
}

export function TaskList({ tasks, filter, viewMode, groupBy, selectedTagIds, focusedTaskId, onFocus, onOpen, rowRefs }: TaskListProps) {
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

  // Upcoming view: group by day (chyba że użytkownik wybrał grupowanie po priorytetach)
  if (viewMode === "upcoming" && groupBy === "default") {
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
            {[...dayTasks].sort(byDueDateAsc).map(renderTask)}
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

  // Overdue view: flat list sorted oldest first (po terminie z czasem) — chyba że grupowanie po priorytetach
  if (viewMode === "overdue" && groupBy === "default") {
    return (
      <div className="flex-1 overflow-y-auto">
        {[...filtered].sort(byDueDateAsc).map(renderTask)}
      </div>
    );
  }

  // "all" view: group by project (chyba że użytkownik wybrał grupowanie po priorytetach)
  if (viewMode === "all" && groupBy === "default") {
    const done = filter === "ALL"
      ? applyTagFilter(tasks.filter((t) => t.status === "DONE" || t.status === "CANCELLED"))
      : [];

    const projectMap = new Map<string, { label: string; tasks: Task[] }>();
    for (const t of filtered) {
      const key = t.projectId ?? "__none__";
      if (!projectMap.has(key)) {
        const p = t.project;
        const label = p ? (p.isInbox ? `📥 ${p.name}` : `${p.emoji ?? "📋"} ${p.name}`) : "Bez projektu";
        projectMap.set(key, { label, tasks: [] });
      }
      projectMap.get(key)!.tasks.push(t);
    }

    return (
      <div className="flex-1 overflow-y-auto">
        {Array.from(projectMap.entries()).map(([key, { label, tasks: groupTasks }]) => (
          <div key={key}>
            <div
              className="flex items-center gap-2 px-4 py-1 text-xs font-medium sticky top-0"
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
            >
              {label}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({groupTasks.length})</span>
            </div>
            {[...groupTasks].sort(byDueDateAsc).map(renderTask)}
          </div>
        ))}
        <CompletedSection tasks={done} renderTask={renderTask} />
      </div>
    );
  }

  // Grupowanie po priorytetach: domyślne dla „Dziś"/projektu oraz dla każdego widoku,
  // gdy użytkownik przełączy prezentację na „Priorytety". Wewnątrz grup sort po terminie z czasem.
  const done = filter === "ALL"
    ? applyTagFilter(tasks.filter((t) => t.status === "DONE" || t.status === "CANCELLED"))
    : [];

  return (
    <div className="flex-1 overflow-y-auto">
      {PRIORITY_ORDER.map((priority) => {
        const group = filtered.filter((t) => t.priority === priority).sort(byDueDateAsc);
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
      <CompletedSection tasks={done} renderTask={renderTask} />
    </div>
  );
}
