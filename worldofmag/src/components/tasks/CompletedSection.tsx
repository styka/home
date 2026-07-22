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

  // Przegląd „co zrobiłem kiedy": najnowsze wykonania na górze. Sortujemy po EFEKTYWNEJ
  // dacie wykonania (completedAt, a dla cyklicznych — lastCompletedAt); brak daty → na końcu.
  const doneTime = (t: Task) => {
    const d = t.completedAt ?? t.lastCompletedAt;
    return d ? new Date(d).getTime() : 0;
  };
  const ordered = sortBy === "completedAt" ? [...tasks].sort((a, b) => doneTime(b) - doneTime(a)) : tasks;

  // Gdy użytkownik włączy sortowanie po dacie wykonania, rozwijamy sekcję (domyślnie
  // zwiniętą), żeby przesortowana kolejność była od razu widoczna, a nagłówek sygnalizuje
  // aktywny sort. `key={sortBy}` remountuje grupę, więc ponownie stosuje `defaultOpen`.
  return (
    <TaskGroup
      key={sortBy}
      label={sortBy === "completedAt" ? "✓ Zrobione / Anulowane — wg daty wykonania" : "✓ Zrobione / Anulowane"}
      count={ordered.length}
      defaultOpen={sortBy === "completedAt"}
      muted
    >
      {ordered.map(renderTask)}
    </TaskGroup>
  );
}
