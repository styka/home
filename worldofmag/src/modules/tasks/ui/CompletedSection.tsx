"use client";

import { TaskGroup } from "./TaskGroup";
import type { Task } from "@/types";

interface CompletedSectionProps {
  tasks: Task[];
  renderTask: (task: Task) => React.ReactNode;
}

// Sekcja „Zrobione / Anulowane" na dole listy zadań (filtr „Wszystkie").
// Domyślnie ZWINIĘTA (w przeciwieństwie do pozostałych grup) — ukończone
// zadania nie zaśmiecają widoku. Kolejność domyślna (znacznik „✓ <data>" na
// wierszach pokazuje datę wykonania — patrz TaskRow).
export function CompletedSection({ tasks, renderTask }: CompletedSectionProps) {
  if (tasks.length === 0) return null;

  return (
    <TaskGroup label="✓ Zrobione / Anulowane" count={tasks.length} defaultOpen={false} muted>
      {tasks.map(renderTask)}
    </TaskGroup>
  );
}
