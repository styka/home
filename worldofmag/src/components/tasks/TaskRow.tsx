"use client";

import { useState, useTransition, useMemo } from "react";
import { Clock, ChevronRight, Paperclip } from "lucide-react";
import { toggleTaskStatus, updateTask } from "@/actions/tasks";
import { TaskTagBadge } from "./TaskTagBadge";
import { RecurringBadge } from "./RecurringBadge";
import { StatusIcon } from "./StatusIcon";
import type { Task, ProjectStatusConfig } from "@/types";
import { TASK_PRIORITY_COLORS, DEFAULT_STATUS_CONFIG, statusMetaFor, parseStatusConfig } from "@/types";

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
  statusConfig?: ProjectStatusConfig;
}

export function TaskRow({ task, isFocused, isSelected, onFocus, onOpen, rowRef, indent = 0, statusConfig = DEFAULT_STATUS_CONFIG }: TaskRowProps) {
  const [isPending, startTransition] = useTransition();
  const [editingDate, setEditingDate] = useState(false);
  // Meta statusu z WŁASNEJ listy zadania (w widokach zbiorczych `statusConfig` jest scalony
  // z wielu list — własna konfiguracja projektu daje pewność poprawnej etykiety/ikony/koloru).
  const effectiveConfig = useMemo(
    () => (task.project?.statusConfig ? parseStatusConfig(task.project.statusConfig) : statusConfig),
    [task.project?.statusConfig, statusConfig]
  );
  const statusMeta = statusMetaFor(task.status, effectiveConfig);
  const isTerminal = statusMeta.isTerminal;
  const dateInfo = formatDate(task.dueDate);
  const priorityColor = TASK_PRIORITY_COLORS[task.priority];
  const tags = task.tags ?? [];
  const hasSubtasks = (task._count?.subtasks ?? 0) > 0;
  const hasComments = (task._count?.comments ?? 0) > 0;

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => { await toggleTaskStatus(task.id); });
  }

  function handleDateClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingDate(true);
  }

  function handleDateChange(value: string) {
    setEditingDate(false);
    const newDate = value ? new Date(value + "T12:00:00") : null;
    startTransition(async () => {
      await updateTask(task.id, { dueDate: newDate });
    });
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
        opacity: isTerminal ? 0.55 : 1,
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
        style={{ color: statusMeta.color }}
        title="Zmień status"
      >
        {isPending ? (
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent-blue)" }} />
        ) : (
          <StatusIcon name={statusMeta.icon} size={16} color={statusMeta.color} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm"
            style={{
              color: "var(--text-primary)",
              textDecoration: isTerminal ? "line-through" : undefined,
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
          {editingDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
              onChange={(e) => handleDateChange(e.target.value)}
              onBlur={(e) => handleDateChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditingDate(false); } }}
              onClick={(e) => e.stopPropagation()}
              className="text-xs bg-transparent focus:outline-none"
              style={{ color: "var(--text-muted)", border: "none", width: 110 }}
            />
          ) : dateInfo ? (
            <span
              className="text-xs cursor-pointer hover:underline"
              onClick={handleDateClick}
              title="Kliknij, aby zmienić datę"
              style={{
                color: dateInfo.isOverdue ? "var(--accent-red)" : dateInfo.isToday ? "var(--accent-amber)" : "var(--text-muted)",
                fontWeight: dateInfo.isOverdue || dateInfo.isToday ? 500 : undefined,
              }}
            >
              {dateInfo.text}
            </span>
          ) : null}

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
