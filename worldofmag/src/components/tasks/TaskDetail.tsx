"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  X, Trash2, CheckCircle2, Circle, Clock, AlertCircle, MinusCircle, Loader2,
  RefreshCw, Tag, User, Calendar, Timer, ChevronDown, Plus, Send, Sparkles,
  Copy, RotateCcw, Share2, MessageSquare,
} from "lucide-react";
import { updateTask, deleteTask, updateTaskTags, addTaskComment, deleteTaskComment, createTask, completeRecurringTask } from "@/actions/tasks";
import { createTaskTag } from "@/actions/taskTags";
import { TaskTagBadge } from "./TaskTagBadge";
import type { Task, TaskStatus, TaskPriority, TaskTagDef, RecurringRule } from "@/types";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from "@/types";

interface TaskDetailProps {
  task: Task;
  allTags: TaskTagDef[];
  onClose: () => void;
  onDelete: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "TODO", label: "Do zrobienia", icon: <Circle size={14} />, color: "var(--text-muted)" },
  { value: "IN_PROGRESS", label: "W trakcie", icon: <Clock size={14} />, color: "var(--accent-blue)" },
  { value: "DONE", label: "Zrobione", icon: <CheckCircle2 size={14} />, color: "var(--accent-green)" },
  { value: "DEFERRED", label: "Odłożone", icon: <AlertCircle size={14} />, color: "var(--accent-amber)" },
  { value: "CANCELLED", label: "Anulowane", icon: <MinusCircle size={14} />, color: "var(--text-muted)" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "NONE", label: "Brak", color: "var(--text-muted)" },
  { value: "LOW", label: "Niski", color: "#3b82f6" },
  { value: "MEDIUM", label: "Średni", color: "#f59e0b" },
  { value: "HIGH", label: "Wysoki", color: "#ef4444" },
  { value: "URGENT", label: "Pilne", color: "#dc2626" },
];

const RECURRING_TYPES = [
  { value: "DAILY", label: "Codziennie" },
  { value: "WEEKLY", label: "Co tydzień" },
  { value: "MONTHLY", label: "Co miesiąc" },
  { value: "YEARLY", label: "Co rok" },
];
const DAY_LABELS = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

export function TaskDetail({ task, allTags, onClose, onDelete }: TaskDetailProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
  const [startDate, setStartDate] = useState(task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : "");
  const [estimatedMins, setEstimatedMins] = useState(task.estimatedMins?.toString() ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>((task.tags ?? []).map((t) => t.tag.id));
  const [newTagName, setNewTagName] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showRecurring, setShowRecurring] = useState(!!task.recurring);
  const [recurringType, setRecurringType] = useState<RecurringRule["type"]>("WEEKLY");
  const [recurringInterval, setRecurringInterval] = useState(1);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
    setStartDate(task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : "");
    setEstimatedMins(task.estimatedMins?.toString() ?? "");
    setSelectedTagIds((task.tags ?? []).map((t) => t.tag.id));
    setShowRecurring(!!task.recurring);
    if (task.recurring) {
      try {
        const r: RecurringRule = JSON.parse(task.recurring);
        setRecurringType(r.type);
        setRecurringInterval(r.interval);
        setRecurringDays(r.daysOfWeek ?? []);
        setRecurringEndDate(r.endDate ?? "");
      } catch { /* ignore */ }
    }
  }, [task.id]);

  function autosave(patch: Parameters<typeof updateTask>[1]) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      startTransition(() => updateTask(task.id, patch));
    }, 600);
  }

  function handleStatusChange(s: TaskStatus) {
    setStatus(s);
    if (s === "DONE" && task.recurring) {
      startTransition(() => completeRecurringTask(task.id));
    } else {
      startTransition(() => updateTask(task.id, { status: s }));
    }
  }

  function handlePriorityChange(p: TaskPriority) {
    setPriority(p);
    startTransition(() => updateTask(task.id, { priority: p }));
  }

  function handleTitleBlur() {
    if (title.trim() && title !== task.title) {
      startTransition(() => updateTask(task.id, { title }));
    }
  }

  function handleDescriptionBlur() {
    if (description !== (task.description ?? "")) {
      startTransition(() => updateTask(task.id, { description: description || null }));
    }
  }

  function handleDueDateChange(v: string) {
    setDueDate(v);
    startTransition(() => updateTask(task.id, { dueDate: v ? new Date(v) : null }));
  }

  function handleEstimatedChange(v: string) {
    setEstimatedMins(v);
    const mins = parseInt(v);
    if (!isNaN(mins) || v === "") {
      autosave({ estimatedMins: v ? mins : null });
    }
  }

  function toggleTag(tagId: string) {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    setSelectedTagIds(next);
    startTransition(() => updateTaskTags(task.id, next));
  }

  async function handleAddTag() {
    if (!newTagName.trim()) return;
    const existing = allTags.find((t) => t.name === newTagName.trim().toLowerCase());
    let tagId = existing?.id;
    if (!tagId) {
      const tag = await createTaskTag(newTagName.trim());
      tagId = tag.id;
    }
    const next = [...selectedTagIds, tagId];
    setSelectedTagIds(next);
    startTransition(() => updateTaskTags(task.id, next));
    setNewTagName("");
    setShowTagInput(false);
  }

  function handleRecurringSave() {
    const rule: RecurringRule = {
      type: recurringType,
      interval: recurringInterval,
      daysOfWeek: recurringType === "WEEKLY" ? recurringDays : undefined,
      endDate: recurringEndDate || null,
    };
    startTransition(() => updateTask(task.id, { recurring: rule }));
  }

  function handleRecurringClear() {
    setShowRecurring(false);
    startTransition(() => updateTask(task.id, { recurring: null }));
  }

  function handleAddComment() {
    if (!commentText.trim()) return;
    startTransition(async () => {
      await addTaskComment(task.id, commentText);
      setCommentText("");
    });
  }

  function handleAddSubtask() {
    if (!newSubtask.trim()) return;
    startTransition(async () => {
      await createTask({ title: newSubtask.trim(), parentTaskId: task.id, projectId: task.projectId });
      setNewSubtask("");
    });
  }

  async function handleAISuggestSubtasks() {
    setAiLoading("subtasks");
    setAiSuggestions([]);
    try {
      const res = await fetch("/api/llm/tasks/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: { title, description }, mode: "subtasks" }),
      });
      const data = await res.json();
      setAiSuggestions(data.subtasks ?? []);
    } catch { /* ignore */ } finally {
      setAiLoading(null);
    }
  }

  async function handleAIEstimate() {
    setAiLoading("estimate");
    try {
      const res = await fetch("/api/llm/tasks/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: { title, description }, mode: "estimate" }),
      });
      const data = await res.json();
      if (data.estimatedMins) {
        setEstimatedMins(String(data.estimatedMins));
        startTransition(() => updateTask(task.id, { estimatedMins: data.estimatedMins }));
      }
    } catch { /* ignore */ } finally {
      setAiLoading(null);
    }
  }

  const statusOpt = STATUS_OPTIONS.find((s) => s.value === status)!;
  const comments = (task.comments ?? []) as NonNullable<Task["comments"]>;

  return (
    <div
      className="flex flex-col h-full border-l overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          {isPending && <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent-blue)" }} />}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Szczegóły zadania</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { if (confirm("Usunąć zadanie?")) { startTransition(() => deleteTask(task.id)); onDelete(); } }}
            className="p-1.5 rounded hover:opacity-70 focus:outline-none"
            style={{ color: "var(--accent-red)" }}
            title="Usuń zadanie"
          >
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:opacity-70 focus:outline-none" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Status + Priority */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            className="flex-1 bg-transparent text-sm focus:outline-none border rounded px-2 py-1"
            style={{ borderColor: "var(--border)", color: statusOpt.color }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
            className="bg-transparent text-sm focus:outline-none border rounded px-2 py-1"
            style={{ borderColor: "var(--border)", color: TASK_PRIORITY_COLORS[priority], width: 100 }}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full bg-transparent font-semibold focus:outline-none"
            style={{ fontSize: 16, color: "var(--text-primary)", lineHeight: 1.4 }}
            placeholder="Tytuł zadania…"
          />
        </div>

        {/* Description */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            rows={3}
            placeholder="Dodaj opis (Markdown obsługiwany)…"
            className="w-full bg-transparent text-sm focus:outline-none resize-none"
            style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
          />
        </div>

        {/* Dates + Time */}
        <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Calendar size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <label className="text-xs w-20 flex-shrink-0" style={{ color: "var(--text-muted)" }}>Termin</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className="flex-1 bg-transparent text-xs focus:outline-none border rounded px-2 py-1"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <label className="text-xs w-20 flex-shrink-0" style={{ color: "var(--text-muted)" }}>Start</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); startTransition(() => updateTask(task.id, { startDate: e.target.value ? new Date(e.target.value) : null })); }}
              className="flex-1 bg-transparent text-xs focus:outline-none border rounded px-2 py-1"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Timer size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <label className="text-xs w-20 flex-shrink-0" style={{ color: "var(--text-muted)" }}>Szacowany czas</label>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={estimatedMins}
                onChange={(e) => handleEstimatedChange(e.target.value)}
                placeholder="min"
                min={0}
                className="bg-transparent text-xs focus:outline-none border rounded px-2 py-1"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", width: 64 }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>min</span>
              <button
                onClick={handleAIEstimate}
                disabled={aiLoading === "estimate"}
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded focus:outline-none"
                style={{ color: "var(--accent-purple)", background: "rgba(168,85,247,0.1)" }}
                title="Oszacuj przez AI"
              >
                {aiLoading === "estimate" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                AI
              </button>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1 mb-2">
            <Tag size={13} style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Tagi</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button key={tag.id} onClick={() => toggleTag(tag.id)} className="focus:outline-none" style={{ opacity: selectedTagIds.includes(tag.id) ? 1 : 0.35 }}>
                <TaskTagBadge tag={tag} />
              </button>
            ))}
            {showTagInput ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(); if (e.key === "Escape") { setShowTagInput(false); setNewTagName(""); } }}
                  placeholder="Nowy tag…"
                  className="bg-transparent text-xs focus:outline-none border-b"
                  style={{ borderColor: "var(--accent-blue)", color: "var(--text-primary)", width: 80 }}
                />
                <button onClick={handleAddTag} className="text-xs focus:outline-none" style={{ color: "var(--accent-blue)" }}>+</button>
              </div>
            ) : (
              <button onClick={() => setShowTagInput(true)} className="text-xs px-1.5 py-0.5 rounded focus:outline-none" style={{ color: "var(--text-muted)", border: "1px dashed var(--border)" }}>
                + Tag
              </button>
            )}
          </div>
        </div>

        {/* Recurring */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setShowRecurring((v) => !v)}
            className="flex items-center gap-1.5 text-xs focus:outline-none"
            style={{ color: showRecurring ? "var(--accent-purple)" : "var(--text-muted)" }}
          >
            <RefreshCw size={12} />
            {showRecurring ? "Powtarzanie skonfigurowane" : "Ustaw powtarzanie"}
            <ChevronDown size={12} style={{ transform: showRecurring ? "rotate(180deg)" : undefined, transition: "transform 150ms" }} />
          </button>

          {showRecurring && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={recurringType}
                  onChange={(e) => setRecurringType(e.target.value as RecurringRule["type"])}
                  className="bg-transparent text-xs border rounded px-2 py-1 focus:outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  {RECURRING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>co</span>
                <input
                  type="number"
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className="bg-transparent text-xs border rounded px-2 py-1 focus:outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)", width: 48 }}
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {recurringType === "DAILY" ? "dni" : recurringType === "WEEKLY" ? "tyg." : recurringType === "MONTHLY" ? "mies." : "lat"}
                </span>
              </div>

              {recurringType === "WEEKLY" && (
                <div className="flex gap-1">
                  {DAY_LABELS.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => setRecurringDays((prev) => prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx])}
                      className="w-7 h-7 rounded text-xs focus:outline-none"
                      style={{
                        backgroundColor: recurringDays.includes(idx) ? "var(--accent-purple)" : "var(--bg-elevated)",
                        color: recurringDays.includes(idx) ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Koniec:</span>
                <input
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  className="bg-transparent text-xs border rounded px-2 py-1 focus:outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                />
              </div>

              <div className="flex gap-2">
                <button onClick={handleRecurringSave} className="text-xs px-2 py-1 rounded focus:outline-none" style={{ backgroundColor: "var(--accent-purple)", color: "#fff" }}>
                  Zapisz
                </button>
                <button onClick={handleRecurringClear} className="text-xs focus:outline-none" style={{ color: "var(--text-muted)" }}>
                  Usuń powtarzanie
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Podzadania {(task.subtasks ?? []).length > 0 && `(${(task.subtasks ?? []).filter((s) => s.status === "DONE").length}/${(task.subtasks ?? []).length})`}
            </span>
            <button
              onClick={handleAISuggestSubtasks}
              disabled={aiLoading === "subtasks"}
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded focus:outline-none"
              style={{ color: "var(--accent-purple)", background: "rgba(168,85,247,0.1)" }}
              title="Sugeruj podzadania przez AI"
            >
              {aiLoading === "subtasks" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              AI
            </button>
          </div>

          {/* AI suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="mb-2 space-y-1">
              {aiSuggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>{s}</span>
                  <button
                    onClick={() => {
                      startTransition(async () => {
                        await createTask({ title: s, parentTaskId: task.id, projectId: task.projectId });
                        setAiSuggestions((prev) => prev.filter((_, idx) => idx !== i));
                      });
                    }}
                    className="text-xs px-1.5 py-0.5 rounded focus:outline-none"
                    style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Existing subtasks */}
          {(task.subtasks ?? []).map((sub) => (
            <div key={sub.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={sub.status === "DONE"}
                onChange={() => startTransition(() => updateTask(sub.id, { status: sub.status === "DONE" ? "TODO" : "DONE" }))}
                className="flex-shrink-0"
                style={{ accentColor: "var(--accent-green)" }}
              />
              <span className="text-sm flex-1" style={{ color: "var(--text-secondary)", textDecoration: sub.status === "DONE" ? "line-through" : undefined }}>
                {sub.title}
              </span>
            </div>
          ))}

          {/* Add subtask */}
          <div className="flex items-center gap-2 mt-2">
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }}
              placeholder="Dodaj podzadanie…"
              className="flex-1 bg-transparent text-xs focus:outline-none border-b"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)", paddingBottom: 2 }}
            />
            <button onClick={handleAddSubtask} disabled={!newSubtask.trim()} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--accent-blue)" }}>
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Comments */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare size={13} style={{ color: "var(--text-muted)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Komentarze {comments.length > 0 && `(${comments.length})`}
            </span>
          </div>

          {comments.map((c) => (
            <div key={c.id} className="mb-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {c.user?.name ?? "Anonim"}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(c.createdAt).toLocaleDateString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{c.content}</p>
            </div>
          ))}

          <div className="flex items-center gap-2 mt-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
              placeholder="Dodaj komentarz…"
              className="flex-1 bg-transparent text-xs focus:outline-none border rounded px-2 py-1.5"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <button onClick={handleAddComment} disabled={!commentText.trim()} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--accent-blue)" }}>
              <Send size={13} />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="px-4 py-3 text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
          <div>Utworzone: {new Date(task.createdAt).toLocaleString("pl-PL")}</div>
          <div>Zaktualizowane: {new Date(task.updatedAt).toLocaleString("pl-PL")}</div>
          {task.completedAt && <div>Ukończone: {new Date(task.completedAt).toLocaleString("pl-PL")}</div>}
        </div>
      </div>
    </div>
  );
}
