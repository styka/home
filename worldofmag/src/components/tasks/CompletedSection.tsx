"use client";

import { TaskGroup } from "./TaskGroup";
import type { Task } from "@/types";

interface CompletedSectionProps {
  tasks: Task[];
  renderTask: (task: Task) => React.ReactNode;
  /** "completedAt" = sortuj wykonane po dacie wykonania (najnowsze na górze). */
  sortBy?: "default" | "completedAt";
}

// Sekcja „Zrobione / Anulowane" na dole listy zadań (filtr „Wszystkie").
// Domyślnie ZWINIĘTA (w przeciwieństwie do pozostałych grup) — ukończone
// zadania nie zaśmiecają widoku.
export function CompletedSection({ tasks, renderTask, sortBy = "default" }: CompletedSectionProps) {
  if (tasks.length === 0) return null;

  // Przegląd „co zrobiłem kiedy": najnowsze wykonania na górze; brak completedAt na końcu.
  const ordered =
    sortBy === "completedAt"
      ? [...tasks].sort((a, b) => {
          const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return tb - ta;
        })
      : tasks;

  // Gdy użytkownik włączy sortowanie po dacie wykonania, rozwijamy sekcję (domyślnie
  // zwiniętą), żeby przesortowana kolejność była od razu widoczna. `key={sortBy}`
  // remountuje grupę przy przełączeniu sortu, więc ponownie stosuje `defaultOpen`.
  return (
    <TaskGroup
      key={sortBy}
      label="✓ Zrobione / Anulowane"
      count={ordered.length}
      defaultOpen={sortBy === "completedAt"}
      muted
    >
      {ordered.map(renderTask)}
    </TaskGroup>
  );
}
