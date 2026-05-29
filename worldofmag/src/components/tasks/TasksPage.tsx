"use client";

import { useState, useRef, useMemo, useTransition, useEffect } from "react";
import Link from "next/link";
import { Search, X, Sparkles, Bell, BellOff } from "lucide-react";
import { TaskFilters } from "./TaskFilters";
import { TaskList } from "./TaskList";
import { TaskDetail } from "./TaskDetail";
import { QuickAddTask, type QuickAddTaskHandle } from "./QuickAddTask";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { deleteTask, toggleTaskStatus } from "@/actions/tasks";
import type { Task, TaskProject, TaskTagDef, TaskStatusFilter, ViewMode } from "@/types";
import { TASK_STATUS_FILTERS } from "@/types";

interface TasksPageProps {
  tasks: Task[];
  allProjects: TaskProject[];
  allTags: TaskTagDef[];
  projectId: string;
  inboxId: string;
  viewMode: ViewMode;
  projectName: string;
  teamMembers: Array<{ id: string; name: string | null; email: string | null; image: string | null }>;
}

export function TasksPage({ tasks, allProjects, allTags, projectId, inboxId, viewMode, projectName, teamMembers }: TasksPageProps) {
  const [activeFilter, setActiveFilter] = useState<TaskStatusFilter>("ALL");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<string[] | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [, startTransition] = useTransition();
  const quickAddRef = useRef<QuickAddTaskHandle>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);
  // Zadania, dla których już wysłaliśmy powiadomienie (klucz: id + termin).
  // Przeżywa re-rendery i zmiany propu `tasks`, więc nie dublujemy notyfikacji.
  const notifiedRef = useRef<Set<string>>(new Set());

  // For virtual views, create tasks in inbox instead
  const isVirtualView = ["today", "upcoming", "overdue", "all"].includes(projectId);
  const addProjectId = isVirtualView ? inboxId : projectId;

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotificationsEnabled(Notification.permission === "granted");
    }
    checkDueNotifications(tasks);
  }, [tasks]);

  // Otwarte szczegóły → wpis w historii, by przycisk „wstecz" zamykał panel
  // (zamiast opuszczać stronę), zwłaszcza na mobile.
  useEffect(() => {
    if (!openTaskId) return;
    window.history.pushState({ taskDetail: true }, "");
    const onPop = () => setOpenTaskId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [openTaskId]);

  function checkDueNotifications(taskList: Task[]) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60 * 1000);
    taskList.forEach((t) => {
      if (!t.dueDate || t.status === "DONE" || t.status === "CANCELLED") return;
      const due = new Date(t.dueDate);
      if (due < now || due > soon) return;
      // Dedup: jedno powiadomienie na zadanie + termin. Bez tego każdy re-render
      // (zmiana propu `tasks` / rewalidacja) wysyłał kolejną notyfikację.
      const key = `${t.id}:${t.dueDate}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      // Treść wskazuje konkretny projekt (a nie tylko nazwę aplikacji „Omnia”, którą
      // system doklepuje jako źródło powiadomienia).
      const project = t.project?.isInbox ? "Skrzynka" : t.project?.name ?? "Skrzynka";
      const projectLabel = t.project?.emoji ? `${t.project.emoji} ${project}` : project;
      const time = due.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      new Notification(`Zadanie za chwilę: ${t.title}`, {
        body: `Projekt: ${projectLabel} · Termin: ${time}`,
        icon: "/pwa-icon/192",
      });
    });
  }

  async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotificationsEnabled(perm === "granted");
  }

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

  const counts = useMemo(() => {
    const result = {} as Record<TaskStatusFilter, number>;
    result["ALL"] = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED").length;
    result["TODO"] = tasks.filter((t) => t.status === "TODO").length;
    result["IN_PROGRESS"] = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    result["DONE"] = tasks.filter((t) => t.status === "DONE").length;
    result["DEFERRED"] = tasks.filter((t) => t.status === "DEFERRED").length;
    result["CANCELLED"] = tasks.filter((t) => t.status === "CANCELLED").length;
    return result;
  }, [tasks]);

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
        setTimeout(() => quickAddRef.current?.focus(), 10);
      },
      onNavigateDown: navigateDown,
      onNavigateUp: navigateUp,
      onToggleStatus: () => {
        if (!focusedTaskId) return;
        startTransition(async () => { await toggleTaskStatus(focusedTaskId); });
      },
      onDelete: () => {
        if (!focusedTaskId) return;
        if (!confirm("Usunąć zadanie?")) return;
        const idx = filteredForNav.findIndex((t) => t.id === focusedTaskId);
        const next = filteredForNav[idx + 1] ?? filteredForNav[idx - 1];
        if (openTaskId === focusedTaskId) setOpenTaskId(null);
        setFocusedTaskId(next?.id ?? null);
        startTransition(async () => { await deleteTask(focusedTaskId); });
      },
      onEdit: () => {
        if (!focusedTaskId) return;
        setOpenTaskId(focusedTaskId);
      },
      onSearch: () => {
        setIsSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 10);
      },
      onFilterTab: (index: number) => setActiveFilter(TASK_STATUS_FILTERS[index] ?? "ALL"),
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

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden h-full">
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
            <option value="all">◎ Wszystkie</option>
            {allProjects.filter((p) => p.isInbox).map((p) => (
              <option key={p.id} value={p.id}>📥 {p.name}</option>
            ))}
            {allProjects.filter((p) => !p.isInbox).map((p) => (
              <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
            ))}
          </select>
        </div>

        {/* Desktop: title — klik = strona główna działu Zadania */}
        <Link
          href="/tasks"
          className="hidden md:block text-sm font-semibold"
          style={{ color: "var(--text-primary)", textDecoration: "none" }}
          title="Zadania — strona główna działu"
        >
          {projectName}
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {counts.ALL > 0 && `${counts.ALL} aktywne`}
          </span>

          <button
            onClick={() => { setIsSearchOpen((v) => !v); setTimeout(() => searchRef.current?.focus(), 10); }}
            className="p-1.5 rounded focus:outline-none"
            style={{ color: isSearchOpen ? "var(--accent-blue)" : "var(--text-muted)" }}
            title="Szukaj (/ lub f)"
          >
            <Search size={15} />
          </button>

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
            onKeyDown={(e) => {
              if (e.key === "Escape") { setSearchQuery(""); setIsSearchOpen(false); setAiSearchResults(null); }
              if (e.key === "Enter") handleAISearch();
            }}
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

      <QuickAddTask ref={quickAddRef} projectId={addProjectId} />

      <TaskFilters
        active={activeFilter}
        counts={counts}
        onChange={setActiveFilter}
        allTags={allTags}
        selectedTagIds={selectedTagIds}
        onTagToggle={(id) => setSelectedTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
      />

      {aiSearchResults !== null && (
        <div className="px-4 py-1.5 border-b flex items-center gap-2" style={{ borderColor: "var(--border)", backgroundColor: "rgba(168,85,247,0.08)" }}>
          <Sparkles size={11} style={{ color: "var(--accent-purple)" }} />
          <span className="text-xs" style={{ color: "var(--accent-purple)" }}>
            Wyniki AI: {aiSearchResults.length} zadań
          </span>
          <button onClick={() => setAiSearchResults(null)} className="ml-auto focus:outline-none" style={{ color: "var(--text-muted)" }}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <TaskList
          tasks={displayedTasks}
          filter={activeFilter}
          viewMode={viewMode}
          selectedTagIds={selectedTagIds}
          focusedTaskId={focusedTaskId}
          onFocus={setFocusedTaskId}
          onOpen={(id) => setOpenTaskId(id)}
          rowRefs={rowRefs}
        />

        {/* Detail panel — desktop */}
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

        {/* Detail panel — mobile modal (padding-top = pasek stanu/notch iPhone) */}
        {openTask && (
          <div
            className="md:hidden fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: "var(--bg-surface)", paddingTop: "env(safe-area-inset-top)" }}
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
  );
}
