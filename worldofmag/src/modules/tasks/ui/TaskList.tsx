"use client";

import { TaskRow } from "./TaskRow";
import { CompletedSection } from "./CompletedSection";
import { TaskGroup } from "./TaskGroup";
import type { Task, ViewMode, ProjectStatusConfig } from "@/types";
import { DEFAULT_STATUS_CONFIG, statusMetaFor } from "@/types";

interface TaskListProps {
  tasks: Task[];
  // "ALL" | status systemowy | klucz własnego statusu.
  filter: string;
  viewMode: ViewMode;
  /** "default" = naturalne grupowanie widoku (po dniach/projektach); "priority" = grupowanie po priorytetach (jak w „Dziś"). */
  groupBy: "default" | "priority";
  selectedTagIds: string[];
  focusedTaskId: string | null;
  onFocus: (id: string) => void;
  onOpen: (id: string) => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  statusConfig?: ProjectStatusConfig;
  /** Tryb zaznaczania (bulk). */
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  /** Kotwica zakresu (ostatnio klikniętego) — do Shift+klik. */
  lastSelectedId?: string | null;
  /** Toggle pojedynczego zadania (ustawia kotwicę). */
  onToggleOne?: (id: string) => void;
  /** Zaznaczenie zakresu (Shift+klik) — dodaje wszystkie id z zakresu. */
  onSelectRange?: (ids: string[]) => void;
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

export function TaskList({ tasks, filter, viewMode, groupBy, selectedTagIds, focusedTaskId, onFocus, onOpen, rowRefs, statusConfig = DEFAULT_STATUS_CONFIG, selectionMode = false, selectedIds, lastSelectedId, onToggleOne, onSelectRange }: TaskListProps) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isTerminal = (status: string) => statusMetaFor(status, statusConfig).isTerminal;

  // Kolejność renderu (wypełniana przez renderTask) — do zakresu Shift+klik, który
  // liczymy po faktycznej, widocznej kolejności wierszy niezależnie od grupowania.
  const orderedIds: string[] = [];
  const selectable = !!onToggleOne;

  function handleRowSelect(id: string, shiftKey: boolean) {
    if (shiftKey && lastSelectedId && onSelectRange) {
      const a = orderedIds.indexOf(lastSelectedId);
      const b = orderedIds.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        onSelectRange(orderedIds.slice(lo, hi + 1));
        return;
      }
    }
    onToggleOne?.(id);
  }

  function applyTagFilter(list: Task[]): Task[] {
    if (selectedTagIds.length === 0) return list;
    return list.filter((t) =>
      selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid))
    );
  }

  function applyStatusFilter(list: Task[]): Task[] {
    if (filter === "ALL") return list.filter((t) => !isTerminal(t.status));
    return list.filter((t) => t.status === filter);
  }

  const filtered = applyTagFilter(applyStatusFilter(tasks));

  function renderTask(task: Task) {
    orderedIds.push(task.id);
    return (
      <TaskRow
        key={task.id}
        task={task}
        isFocused={focusedTaskId === task.id}
        isSelected={focusedTaskId === task.id}
        onFocus={() => onFocus(task.id)}
        onOpen={() => onOpen(task.id)}
        rowRef={(el) => { if (el) rowRefs.current.set(task.id, el); else rowRefs.current.delete(task.id); }}
        statusConfig={statusConfig}
        selectionMode={selectionMode}
        isChecked={selectedIds?.has(task.id) ?? false}
        onToggleSelect={selectable ? (shiftKey) => handleRowSelect(task.id, shiftKey) : undefined}
      />
    );
  }

  const emptyLabel: Record<ViewMode, string> = {
    today: "Brak zadań na dziś",
    upcoming: "Brak nadchodzących zadań",
    overdue: "Brak zaległych zadań",
    all: "Brak zadań",
    project: "Brak zadań w projekcie",
    multi: "Brak zadań w wybranych projektach",
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
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: selectionMode ? 140 : undefined }}>
        {entries.map(([key, { label, tasks: dayTasks }]) => (
          <TaskGroup key={key} label={label} count={dayTasks.length}>
            {[...dayTasks].sort(byDueDateAsc).map(renderTask)}
          </TaskGroup>
        ))}
        {withoutDate.length > 0 && (
          <TaskGroup label="Bez terminu" count={withoutDate.length} muted>
            {withoutDate.map(renderTask)}
          </TaskGroup>
        )}
      </div>
    );
  }

  // Overdue view: flat list sorted oldest first (po terminie z czasem) — chyba że grupowanie po priorytetach
  if (viewMode === "overdue" && groupBy === "default") {
    return (
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: selectionMode ? 140 : undefined }}>
        {[...filtered].sort(byDueDateAsc).map(renderTask)}
      </div>
    );
  }

  // "all"/"multi" view: group by project (chyba że użytkownik wybrał grupowanie po priorytetach)
  if ((viewMode === "all" || viewMode === "multi") && groupBy === "default") {
    const done = filter === "ALL"
      ? applyTagFilter(tasks.filter((t) => isTerminal(t.status)))
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
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: selectionMode ? 140 : undefined }}>
        {Array.from(projectMap.entries()).map(([key, { label, tasks: groupTasks }]) => (
          <TaskGroup key={key} label={label} count={groupTasks.length}>
            {[...groupTasks].sort(byDueDateAsc).map(renderTask)}
          </TaskGroup>
        ))}
        <CompletedSection tasks={done} renderTask={renderTask} />
      </div>
    );
  }

  // Grupowanie po priorytetach: domyślne dla „Dziś"/projektu oraz dla każdego widoku,
  // gdy użytkownik przełączy prezentację na „Priorytety". Wewnątrz grup sort po terminie z czasem.
  const done = filter === "ALL"
    ? applyTagFilter(tasks.filter((t) => isTerminal(t.status)))
    : [];

  return (
    <div className="flex-1 overflow-y-auto" style={{ paddingBottom: selectionMode ? 140 : undefined }}>
      {PRIORITY_ORDER.map((priority) => {
        const group = filtered.filter((t) => t.priority === priority).sort(byDueDateAsc);
        if (group.length === 0) return null;
        return (
          <TaskGroup key={priority} label={PRIORITY_LABELS[priority]} count={group.length} muted>
            {group.map(renderTask)}
          </TaskGroup>
        );
      })}
      <CompletedSection tasks={done} renderTask={renderTask} />
    </div>
  );
}
