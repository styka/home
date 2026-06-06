"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  X, Trash2, CheckCircle2, Circle, Clock, AlertCircle, MinusCircle, Loader2,
  RefreshCw, Tag, Calendar, Timer, ChevronDown, ChevronLeft, Plus, Send, Sparkles,
  MessageSquare, Share2, UserMinus, Eye, Undo2, FolderInput,
} from "lucide-react";
import { updateTask, deleteTask, updateTaskTags, addTaskComment, createTask, completeRecurringTask, shareTaskByEmail, removeTaskShare } from "@/actions/tasks";
import { createTaskTag } from "@/actions/taskTags";
import { TaskTagBadge } from "./TaskTagBadge";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import type { Task, TaskStatus, TaskPriority, TaskTagDef, RecurringRule, ProjectStatusConfig, TaskProject } from "@/types";
import { TASK_PRIORITY_COLORS, statusMeta, DEFAULT_STATUS_CONFIG } from "@/types";

interface TaskDetailProps {
  task: Task;
  allTags: TaskTagDef[];
  allProjects?: TaskProject[];
  statusConfig?: ProjectStatusConfig;
  onClose: () => void;
  onDelete: () => void;
}

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

export function TaskDetail({ task, allTags, allProjects = [], statusConfig = DEFAULT_STATUS_CONFIG, onClose, onDelete }: TaskDetailProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
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
  const [recurringAnchor, setRecurringAnchor] = useState<"DUE" | "COMPLETION">("DUE");
  const [newSubtask, setNewSubtask] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareRole, setShareRole] = useState<"VIEWER" | "EDITOR">("VIEWER");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: wrap async server actions for startTransition
  function run(fn: () => Promise<unknown>) {
    startTransition(async () => { await fn(); });
  }

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
    setStartDate(task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : "");
    setEstimatedMins(task.estimatedMins?.toString() ?? "");
    setSelectedTagIds((task.tags ?? []).map((t) => t.tag.id));
    setEditingDesc(false);
    setShowRecurring(!!task.recurring);
    if (task.recurring) {
      try {
        const r: RecurringRule = JSON.parse(task.recurring);
        setRecurringType(r.type);
        setRecurringInterval(r.interval);
        setRecurringDays(r.daysOfWeek ?? []);
        setRecurringEndDate(r.endDate ?? "");
        setRecurringAnchor(r.anchor ?? "DUE");
      } catch { /* ignore */ }
    }
  }, [task.id]);

  function autosave(patch: Parameters<typeof updateTask>[1]) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      run(() => updateTask(task.id, patch));
    }, 600);
  }

  function handleStatusChange(s: TaskStatus) {
    setStatus(s);
    if (s === "DONE" && task.recurring) {
      run(() => completeRecurringTask(task.id));
    } else {
      run(() => updateTask(task.id, { status: s }));
    }
  }

  function handlePriorityChange(p: TaskPriority) {
    setPriority(p);
    run(() => updateTask(task.id, { priority: p }));
  }

  function handleTitleBlur() {
    if (title.trim() && title !== task.title) {
      run(() => updateTask(task.id, { title }));
    }
  }

  function handleDescriptionBlur() {
    setEditingDesc(false);
    if (description !== (task.description ?? "")) {
      run(() => updateTask(task.id, { description: description || null }));
    }
  }

  function handleDueDateChange(v: string) {
    setDueDate(v);
    run(() => updateTask(task.id, { dueDate: v ? new Date(v) : null }));
  }

  function handleStartDateChange(v: string) {
    setStartDate(v);
    run(() => updateTask(task.id, { startDate: v ? new Date(v) : null }));
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
    run(() => updateTaskTags(task.id, next));
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
    run(() => updateTaskTags(task.id, next));
    setNewTagName("");
    setShowTagInput(false);
  }

  function handleRecurringSave() {
    const rule: RecurringRule = {
      type: recurringType,
      interval: recurringInterval,
      daysOfWeek: recurringType === "WEEKLY" ? recurringDays : undefined,
      endDate: recurringEndDate || null,
      anchor: recurringAnchor,
    };
    run(() => updateTask(task.id, { recurring: rule }));
  }

  function handleRecurringClear() {
    setShowRecurring(false);
    run(() => updateTask(task.id, { recurring: null }));
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

  function handleDelete() {
    if (!confirm("Usunąć zadanie?")) return;
    startTransition(async () => {
      await deleteTask(task.id);
      onDelete();
    });
  }

  async function handleShare() {
    if (!shareEmail.trim()) return;
    setShareError("");
    const res = await shareTaskByEmail(task.id, shareEmail.trim(), shareRole);
    if (res.error) {
      setShareError(res.error);
    } else {
      setShareEmail("");
    }
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
        run(() => updateTask(task.id, { estimatedMins: data.estimatedMins }));
      }
    } catch { /* ignore */ } finally {
      setAiLoading(null);
    }
  }

  // Opcje statusu = włączone statusy listy (zawsze z bieżącym, nawet gdy wyłączony) — „skok" do dowolnego.
  const enabledKeys = statusConfig.enabled.length ? statusConfig.enabled : DEFAULT_STATUS_CONFIG.enabled;
  const optionKeys: TaskStatus[] = enabledKeys.includes(status) ? enabledKeys : [...enabledKeys, status];
  const statusOptions = optionKeys.map((k) => ({ value: k, ...statusMeta(k) }));
  const statusOpt = statusMeta(status);
  const comments = (task.comments ?? []) as NonNullable<Task["comments"]>;

  return (
    <div
      className="flex flex-col h-full border-l overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1">
          {/* Mobile: wyraźny powrót */}
          <button
            onClick={onClose}
            className="md:hidden flex items-center gap-1 -ml-1.5 pr-2 py-1.5 rounded focus:outline-none"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Wróć do listy zadań"
          >
            <ChevronLeft size={18} />
            <span className="text-sm">Wróć</span>
          </button>
          {isPending && <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent-blue)" }} />}
          <span className="text-xs hidden md:inline" style={{ color: "var(--text-muted)" }}>Szczegóły zadania</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
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
            {statusOptions.map((s) => (
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

        {/* Weryfikacja — gdy zadanie czeka na zatwierdzenie */}
        {status === "IN_VERIFICATION" && (
          <div
            className="flex flex-col gap-2 px-4 py-3 border-b"
            style={{ borderColor: "var(--border)", background: "rgba(245,158,11,0.08)" }}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--accent-amber)" }}>
              <Eye size={13} /> Oczekuje na weryfikację
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange("DONE")}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded focus:outline-none"
                style={{ backgroundColor: "var(--accent-green)", color: "var(--on-accent)" }}
                title="Zweryfikowano — oznacz jako zrobione"
              >
                <CheckCircle2 size={13} /> Zatwierdź
              </button>
              <button
                onClick={() => handleStatusChange("IN_PROGRESS")}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded focus:outline-none border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                title="Odrzuć — wróć do realizacji (lub wybierz inny status powyżej)"
              >
                <Undo2 size={13} /> Odrzuć
              </button>
            </div>
          </div>
        )}

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

        {/* Description — Markdown: klik = edycja, blur = render */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <style>{MARKDOWN_STYLES}</style>
          {editingDesc ? (
            <textarea
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              rows={Math.max(3, description.split("\n").length)}
              placeholder="Dodaj opis (Markdown obsługiwany)…"
              className="w-full bg-transparent text-sm focus:outline-none resize-none"
              style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
            />
          ) : description.trim() ? (
            <div
              onClick={() => setEditingDesc(true)}
              className="text-sm cursor-text"
              style={{ color: "var(--text-secondary)" }}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(description) }}
            />
          ) : (
            <button
              onClick={() => setEditingDesc(true)}
              className="text-sm text-left w-full focus:outline-none"
              style={{ color: "var(--text-muted)" }}
            >
              Dodaj opis (Markdown obsługiwany)…
            </button>
          )}
        </div>

        {/* Dates + Time */}
        <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: "var(--border)" }}>
          {allProjects.length > 0 && (
            <div className="flex items-center gap-2">
              <FolderInput size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <label className="text-xs w-20 flex-shrink-0" style={{ color: "var(--text-muted)" }}>Projekt</label>
              <select
                value={task.projectId ?? ""}
                onChange={(e) => { if (e.target.value && e.target.value !== task.projectId) run(() => updateTask(task.id, { projectId: e.target.value })); }}
                className="flex-1 bg-transparent text-xs focus:outline-none border rounded px-2 py-1"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                title="Przenieś do innego projektu"
              >
                {task.projectId == null && <option value="">— bez projektu —</option>}
                {[...allProjects].sort((a, b) => Number(b.isInbox) - Number(a.isInbox)).map((p) => (
                  <option key={p.id} value={p.id}>{p.isInbox ? "📥" : p.emoji} {p.name}</option>
                ))}
              </select>
            </div>
          )}
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
              onChange={(e) => handleStartDateChange(e.target.value)}
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTag();
                    if (e.key === "Escape") { setShowTagInput(false); setNewTagName(""); }
                  }}
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

              <div className="flex items-center gap-2">
                <span className="text-xs w-20 flex-shrink-0" style={{ color: "var(--text-muted)" }}>Następny termin</span>
                <select
                  value={recurringAnchor}
                  onChange={(e) => setRecurringAnchor(e.target.value as "DUE" | "COMPLETION")}
                  className="flex-1 bg-transparent text-xs border rounded px-2 py-1 focus:outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  title="Od czego liczyć kolejny termin po wykonaniu"
                >
                  <option value="DUE">licz od terminu</option>
                  <option value="COMPLETION">licz od daty wykonania</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button onClick={handleRecurringSave} className="text-xs px-2 py-1 rounded focus:outline-none" style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}>
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
                    style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
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
                onChange={() => run(() => updateTask(sub.id, { status: sub.status === "DONE" ? "TODO" : "DONE" }))}
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

        {/* Sharing */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Share2 size={13} style={{ color: "var(--text-muted)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Udostępnianie</span>
          </div>

          {/* Existing shares */}
          {(task.shares ?? []).length > 0 && (
            <div className="space-y-1 mb-2">
              {(task.shares ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>
                    {s.user?.name ?? s.user?.email ?? s.team?.name ?? "Nieznany"}
                    <span className="ml-1" style={{ color: "var(--text-muted)" }}>
                      ({s.role === "EDITOR" ? "Edytor" : "Widz"})
                    </span>
                  </span>
                  <button
                    onClick={() => run(() => removeTaskShare(s.id))}
                    className="focus:outline-none hover:opacity-70"
                    style={{ color: "var(--text-muted)" }}
                    title="Usuń dostęp"
                  >
                    <UserMinus size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add share by email */}
          <div className="flex items-center gap-1.5">
            <input
              value={shareEmail}
              onChange={(e) => { setShareEmail(e.target.value); setShareError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleShare(); }}
              placeholder="Email użytkownika…"
              className="flex-1 bg-transparent text-xs focus:outline-none border rounded px-2 py-1"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <select
              value={shareRole}
              onChange={(e) => setShareRole(e.target.value as "VIEWER" | "EDITOR")}
              className="bg-transparent text-xs focus:outline-none border rounded px-1 py-1"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <option value="VIEWER">Widz</option>
              <option value="EDITOR">Edytor</option>
            </select>
            <button
              onClick={handleShare}
              disabled={!shareEmail.trim()}
              className="text-xs px-2 py-1 rounded focus:outline-none disabled:opacity-30"
              style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
            >
              +
            </button>
          </div>
          {shareError && (
            <p className="text-xs mt-1" style={{ color: "var(--accent-red)" }}>{shareError}</p>
          )}
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
