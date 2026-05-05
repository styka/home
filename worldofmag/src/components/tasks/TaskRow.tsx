"use client";

import { useTransition } from "react";
import { Circle, CheckCircle2, Clock, AlertCircle, MinusCircle, ChevronRight, RefreshCw, Paperclip } from "lucide-react";
import { toggleTaskStatus } from "@/actions/tasks";
import { TaskTagBadge } from "./TaskTagBadge";
import { RecurringBadge } from "./RecurringBadge";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { TASK_PRIORITY_COLORS } from "@/types";

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  TODO: <Circle size={16} />,
  IN_PROGRESS: <Clock size={16} style={{ color: "var(--accent-blue)" }} />,
  DONE: <CheckCircle2 size={16} style={{ color: "var(--accent-green)" }} />,
  CANCELLED: <MinusCircle size={16} style={{ color: "var(--text-muted)" }} />,
  DEFERRED: <AlertCircle size={16} style={{ color: "var(--accent-amber)" }} />,
};

function formatDate(date: Date | null): { text: string; isOverdue: boolean; isToday: boolean } | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((taskDay.getTime() - today.getTime()) / 86400000);

  const isToday = diff === 0;
  const isOverdue = diff < 0;

  let text: string;
  if (diff === 0) text = "Dziś";
  else if (diff === 1) text = "Jutro";
  else if (diff === -1) text = "Wczoraj";
  else if (diff > 1 && diff < 7) text = d.toLocaleDateString("pl-PL", { weekday: "short" });
  else text = d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });

  return { text, isOverdue, isToday };
}

interface TaskRowProps {
  task: Task;
  isFocused: boolean;
  isSelected: boolean;
  onFocus: () => void;
  onOpen: () => void;
  rowRef?: (el: HTMLDivElement | null) => void;
  indent?: number;
}

export function TaskRow({ task, isFocused, isSelected, onFocus, onOpen, rowRef, indent = 0 }: TaskRowProps) {
  const [isPending, startTransition] = useTransition();
  const isDone = task.status === "DONE";
  const isCancelled = task.status === "CANCELLED";
  const dateInfo = formatDate(task.dueDate);
  const priorityColor = TASK_PRIORITY_COLORS[task.priority];
  const tags = task.tags ?? [];
  const hasSubtasks = (task._count?.subtasks ?? 0) > 0;
  const hasComments = (task._count?.comments ?? 0) > 0;

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(() => toggleTaskStatus(task.id));
  }

  return (
    <div
      ref={rowRef}
      onClick={() => { onFocus(); onOpen(); }}
      className="flex items-start gap-2 px-3 py-2 cursor-pointer group"
      style={{
        paddingLeft: 12 + indent * 20,
        backgroundColor: isFocused ? "var(--bg-elevated)" : undefined,
        borderLeft: isFocused ? "2px solid var(--accent-blue)" : "2px solid transparent",
        opacity: isDone || isCancelled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => { if (!isFocused) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
      onMouseLeave={(e) => { if (!isFocused) e.currentTarget.style.backgroundColor = ""; }}
    >
      {/* Priority indicator */}
      <div
        className="flex-shrink-0 self-center"
        style={{
          width: 3,
          height: 20,
          borderRadius: 2,
          backgroundColor: task.priority !== "NONE" ? priorityColor : "transparent",
          marginRight: 2,
        }}
        title={`Priorytet: ${task.priority}`}
      />

      {/* Status toggle */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="flex-shrink-0 mt-0.5 focus:outline-none hover:opacity-70"
        style={{ color: isDone ? "var(--accent-green)" : "var(--text-muted)" }}
        title="Zmień status"
      >
        {isPending ? (
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent-blue)" }} />
        ) : (
          STATUS_ICONS[task.status]
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm"
            style={{
              color: "var(--text-primary)",
              textDecoration: isDone || isCancelled ? "line-through" : undefined,
            }}
          >
            {task.title}
          </span>

          {/* Indicators */}
          {hasSubtasks && (
            <span className="flex items-center gap-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <ChevronRight size={11} />
              {task._count?.subtasks}
            </span>
          )}
          {hasComments && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              <Paperclip size={10} />
            </span>
          )}
          {task.recurring && <RecurringBadge recurring={task.recurring} />}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {/* Due date */}
          {dateInfo && (
            <span
              className="text-xs"
              style={{
                color: dateInfo.isOverdue ? "var(--accent-red)" : dateInfo.isToday ? "var(--accent-amber)" : "var(--text-muted)",
                fontWeight: dateInfo.isOverdue || dateInfo.isToday ? 500 : undefined,
              }}
            >
              {dateInfo.text}
            </span>
          )}

          {/* Estimated time */}
          {task.estimatedMins && (
            <span className="text-xs flex items-center gap-0.5" style={{ color: "var(--text-muted)" }}>
              <Clock size={10} />
              {task.estimatedMins >= 60
                ? `${Math.floor(task.estimatedMins / 60)}h${task.estimatedMins % 60 ? ` ${task.estimatedMins % 60}m` : ""}`
                : `${task.estimatedMins}m`}
            </span>
          )}

          {/* Tags */}
          {tags.slice(0, 3).map(({ tag }) => (
            <TaskTagBadge key={tag.id} tag={tag} size="xs" />
          ))}
          {tags.length > 3 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>+{tags.length - 3}</span>
          )}

          {/* Assignee */}
          {task.assignee && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              → {task.assignee.name ?? task.assignee.email}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
