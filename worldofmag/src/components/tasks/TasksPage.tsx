"use client";

import { useState, useRef, useMemo, useTransition, useCallback, useEffect } from "react";
import { Search, X, Sparkles, PenLine, Bell, BellOff } from "lucide-react";
import { TaskProjectSidebar } from "./TaskProjectSidebar";
import { TaskFilters } from "./TaskFilters";
import { TaskList } from "./TaskList";
import { TaskDetail } from "./TaskDetail";
import { AITaskInput } from "./AITaskInput";
import { QuickAddTask, type QuickAddTaskHandle } from "./QuickAddTask";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { deleteTask, toggleTaskStatus } from "@/actions/tasks";
import type { Task, TaskFilter, TaskProject, TaskTagDef } from "@/types";
import { TASK_FILTERS, TASK_STATUS_CYCLE } from "@/types";

type AddMode = "ai" | "manual";

interface TasksPageProps {
  tasks: Task[];
  currentProject: TaskProject | null;
  allProjects: TaskProject[];
  allTags: TaskTagDef[];
  projectId: string;
  teamMembers: Array<{ id: string; name: string | null; email: string | null; image: string | null }>;
}

const VIRTUAL_LABELS: Record<string, { label: string; emoji: string }> = {
  today: { label: "Dziś", emoji: "📅" },
  upcoming: { label: "Nadchodzące", emoji: "📆" },
  overdue: { label: "Zaległe", emoji: "⚠️" },
};

export function TasksPage({ tasks, currentProject, allProjects, allTags, projectId, teamMembers }: TasksPageProps) {
  const [activeFilter, setActiveFilter] = useState<TaskFilter>("ALL");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<string[] | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("manual");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [, startTransition] = useTransition();
  const quickAddRef = useRef<QuickAddTaskHandle>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  // Check notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotificationsEnabled(Notification.permission === "granted");
    }
    checkDueNotifications(tasks);
  }, [tasks]);

  function checkDueNotifications(taskList: Task[]) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60 * 1000); // 30 min window
    taskList.forEach((t) => {
      if (!t.dueDate || t.status === "DONE" || t.status === "CANCELLED") return;
      const due = new Date(t.dueDate);
      if (due >= now && due <= soon) {
        new Notification(`Zadanie za chwilę: ${t.title}`, {
          body: `Termin: ${due.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`,
          icon: "/icons/icon-192.png",
        });
      }
    });
  }

  async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotificationsEnabled(perm === "granted");
  }

  // Filtered tasks for display
  const displayedTasks = useMemo(() => {
    if (aiSearchResults !== null) {
      return aiSearchResults.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as Task[];
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some((tt) => tt.tag.name.includes(q))
      );
    }
    return tasks;
  }, [tasks, searchQuery, aiSearchResults]);

  // Count for filter tabs
  const counts = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    return {
      ALL: tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED").length,
      TODAY: tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < todayEnd).length,
      UPCOMING: tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= todayEnd).length,
      IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      DONE: tasks.filter((t) => t.status === "DONE").length,
      OVERDUE: tasks.filter((t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== "DONE" && t.status !== "CANCELLED").length,
    } as Record<TaskFilter, number>;
  }, [tasks]);

  const focusedTask = focusedTaskId ? tasks.find((t) => t.id === focusedTaskId) : null;
  const filteredForNav = displayedTasks;

  function navigateDown() {
    if (filteredForNav.length === 0) return;
    const idx = filteredForNav.findIndex((t) => t.id === focusedTaskId);
    const next = filteredForNav[idx + 1] ?? filteredForNav[0];
    setFocusedTaskId(next.id);
    rowRefs.current.get(next.id)?.scrollIntoView({ block: "nearest" });
  }

  function navigateUp() {
    if (filteredForNav.length === 0) return;
    const idx = filteredForNav.findIndex((t) => t.id === focusedTaskId);
    const prev = idx <= 0 ? filteredForNav[filteredForNav.length - 1] : filteredForNav[idx - 1];
    setFocusedTaskId(prev.id);
    rowRefs.current.get(prev.id)?.scrollIntoView({ block: "nearest" });
  }

  const handlers = useMemo(
    () => ({
      onQuickAdd: () => {
        setAddMode("manual");
        setTimeout(() => quickAddRef.current?.focus(), 10);
      },
      onNavigateDown: navigateDown,
      onNavigateUp: navigateUp,
      onToggleStatus: () => {
        if (!focusedTaskId) return;
        startTransition(() => toggleTaskStatus(focusedTaskId));
      },
      onDelete: () => {
        if (!focusedTaskId) return;
        const idx = filteredForNav.findIndex((t) => t.id === focusedTaskId);
        const next = filteredForNav[idx + 1] ?? filteredForNav[idx - 1];
        if (openTaskId === focusedTaskId) setOpenTaskId(null);
        setFocusedTaskId(next?.id ?? null);
        startTransition(() => deleteTask(focusedTaskId));
      },
      onEdit: () => {
        if (!focusedTaskId) return;
        setOpenTaskId(focusedTaskId);
      },
      onSearch: () => {
        setIsSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 10);
      },
      onFilterTab: (index: number) => setActiveFilter(TASK_FILTERS[index] ?? "ALL"),
      onCommandPalette: () => {},
      onEscape: () => {
        if (aiSearchResults) { setAiSearchResults(null); setSearchQuery(""); return; }
        if (isSearchOpen) { setSearchQuery(""); setIsSearchOpen(false); return; }
        if (openTaskId) { setOpenTaskId(null); return; }
        setFocusedTaskId(null);
      },
    }),
    [focusedTaskId, filteredForNav, openTaskId, isSearchOpen, aiSearchResults]
  );

  useKeyboardShortcuts(handlers);

  async function handleAISearch() {
    if (!searchQuery.trim()) return;
    setIsAISearching(true);
    try {
      const res = await fetch("/api/llm/tasks/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          tasks: tasks.slice(0, 100).map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            tags: t.tags?.map((tt) => tt.tag.name),
            status: t.status,
            priority: t.priority,
          })),
        }),
      });
      const data = await res.json();
      const matches: number[] = data.matches ?? [];
      setAiSearchResults(matches.map((idx) => tasks[idx]?.id).filter(Boolean));
    } catch { /* ignore */ } finally {
      setIsAISearching(false);
    }
  }

  const title = currentProject
    ? `${currentProject.emoji} ${currentProject.name}`
    : VIRTUAL_LABELS[projectId]
    ? `${VIRTUAL_LABELS[projectId].emoji} ${VIRTUAL_LABELS[projectId].label}`
    : "Zadania";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Project sidebar (desktop only) */}
      <TaskProjectSidebar projects={allProjects} currentProjectId={projectId} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          {/* Mobile: project picker */}
          <div className="md:hidden flex-1 mr-2">
            <select
              value={projectId}
              onChange={(e) => { window.location.href = `/tasks/${e.target.value}`; }}
              className="bg-transparent text-sm font-semibold focus:outline-none w-full"
              style={{ color: "var(--text-primary)" }}
            >
              <option value="today">📅 Dziś</option>
              <option value="upcoming">📆 Nadchodzące</option>
              <option value="overdue">⚠️ Zaległe</option>
              {allProjects.filter((p) => p.isInbox).map((p) => (
                <option key={p.id} value={p.id}>📥 {p.name}</option>
              ))}
              {allProjects.filter((p) => !p.isInbox).map((p) => (
                <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
              ))}
            </select>
          </div>

          {/* Desktop: title */}
          <h1 className="hidden md:block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {counts.ALL > 0 && `${counts.ALL} aktywne`}
            </span>

            {/* Search button */}
            <button
              onClick={() => { setIsSearchOpen((v) => !v); setTimeout(() => searchRef.current?.focus(), 10); }}
              className="p-1.5 rounded focus:outline-none"
              style={{ color: isSearchOpen ? "var(--accent-blue)" : "var(--text-muted)" }}
              title="Szukaj (/ lub f)"
            >
              <Search size={15} />
            </button>

            {/* Notifications */}
            <button
              onClick={requestNotifications}
              className="p-1.5 rounded focus:outline-none"
              style={{ color: notificationsEnabled ? "var(--accent-amber)" : "var(--text-muted)" }}
              title={notificationsEnabled ? "Powiadomienia włączone" : "Włącz powiadomienia"}
            >
              {notificationsEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {isSearchOpen && (
          <div
            className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
          >
            <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setAiSearchResults(null); }}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); setIsSearchOpen(false); setAiSearchResults(null); } }}
              placeholder="Szukaj zadań… (Enter = szukaj AI)"
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: "var(--text-primary)" }}
            />
            {searchQuery && (
              <button
                onClick={handleAISearch}
                disabled={isAISearching}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded focus:outline-none"
                style={{ backgroundColor: "var(--accent-purple)", color: "#fff" }}
                title="Wyszukaj semantycznie przez AI"
              >
                {isAISearching ? (
                  <span className="flex items-center gap-1"><span className="animate-spin text-xs">⟳</span> AI</span>
                ) : (
                  <><Sparkles size={11} /> AI</>
                )}
              </button>
            )}
            {(searchQuery || aiSearchResults) && (
              <button onClick={() => { setSearchQuery(""); setAiSearchResults(null); }} style={{ color: "var(--text-muted)" }}>
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Add mode toggle */}
        <div
          className="flex border-b flex-shrink-0"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          <button
            onClick={() => setAddMode("ai")}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium focus:outline-none"
            style={{
              color: addMode === "ai" ? "var(--accent-blue)" : "var(--text-muted)",
              borderBottom: addMode === "ai" ? "2px solid var(--accent-blue)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            <Sparkles size={11} /> AI
          </button>
          <button
            onClick={() => { setAddMode("manual"); setTimeout(() => quickAddRef.current?.focus(), 10); }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium focus:outline-none"
            style={{
              color: addMode === "manual" ? "var(--accent-green)" : "var(--text-muted)",
              borderBottom: addMode === "manual" ? "2px solid var(--accent-green)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            <PenLine size={11} /> Ręcznie
          </button>
        </div>

        {/* Add input */}
        {addMode === "ai" ? (
          <AITaskInput projectId={projectId} allTags={allTags} />
        ) : (
          <QuickAddTask ref={quickAddRef} projectId={projectId} />
        )}

        {/* Filters */}
        <TaskFilters
          active={activeFilter}
          counts={counts}
          onChange={setActiveFilter}
          allTags={allTags}
          selectedTagIds={selectedTagIds}
          onTagToggle={(id) => setSelectedTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
        />

        {/* AI search results banner */}
        {aiSearchResults !== null && (
          <div className="px-4 py-1.5 border-b flex items-center gap-2" style={{ borderColor: "var(--border)", backgroundColor: "rgba(168,85,247,0.08)" }}>
            <Sparkles size={11} style={{ color: "var(--accent-purple)" }} />
            <span className="text-xs" style={{ color: "var(--accent-purple)" }}>
              Wyniki wyszukiwania AI: {aiSearchResults.length} zadań
            </span>
            <button onClick={() => setAiSearchResults(null)} className="ml-auto focus:outline-none" style={{ color: "var(--text-muted)" }}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Content area with optional detail panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <TaskList
            tasks={displayedTasks}
            filter={activeFilter}
            selectedTagIds={selectedTagIds}
            focusedTaskId={focusedTaskId}
            onFocus={setFocusedTaskId}
            onOpen={(id) => setOpenTaskId(id)}
            rowRefs={rowRefs}
          />

          {/* Detail panel — desktop slide-in */}
          {openTask && (
            <div
              className="hidden md:flex flex-col border-l flex-shrink-0"
              style={{ width: 380, borderColor: "var(--border)" }}
            >
              <TaskDetail
                task={openTask}
                allTags={allTags}
                onClose={() => setOpenTaskId(null)}
                onDelete={() => { setOpenTaskId(null); setFocusedTaskId(null); }}
              />
            </div>
          )}

          {/* Detail panel — mobile modal */}
          {openTask && (
            <div
              className="md:hidden fixed inset-0 z-50 flex flex-col"
              style={{ backgroundColor: "var(--bg-surface)" }}
            >
              <TaskDetail
                task={openTask}
                allTags={allTags}
                onClose={() => setOpenTaskId(null)}
                onDelete={() => { setOpenTaskId(null); setFocusedTaskId(null); }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
