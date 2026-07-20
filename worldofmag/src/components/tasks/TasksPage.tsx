"use client";

import { useState, useRef, useMemo, useTransition, useEffect } from "react";
import Link from "next/link";
import { Search, X, Sparkles, Bell, BellOff, SlidersHorizontal, ListTree, Flag, Pencil, List as ListIcon, Columns3, CalendarRange, Trash2, CalendarCheck, CheckSquare } from "lucide-react";
import { TaskFilters } from "./TaskFilters";
import { TaskList } from "./TaskList";
import { KanbanBoard } from "./KanbanBoard";
import { TimelineView } from "./TimelineView";
import { TaskDetail } from "./TaskDetail";
import { TaskStatusConfigEditor } from "./TaskStatusConfigEditor";
import { QuickAddTask, type QuickAddTaskHandle } from "./QuickAddTask";
import { ProjectActionsMenu } from "./ProjectActionsMenu";
import { TaskListClipboardButton } from "./TaskListClipboardButton";
import { BulkActionBar, type BulkPatch } from "./BulkActionBar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { deleteTask, toggleTaskStatus, bulkUpdateTasks, bulkDeleteTasks } from "@/actions/tasks";
import type { Task, TaskProject, TaskTagDef, TaskStatusFilter, ViewMode, ProjectStatusConfig } from "@/types";
import { resolveStatuses, statusMetaFor, DEFAULT_STATUS_CONFIG } from "@/types";

interface TasksPageProps {
  tasks: Task[];
  allProjects: TaskProject[];
  allTags: TaskTagDef[];
  projectId: string;
  inboxId: string;
  viewMode: ViewMode;
  projectName: string;
  teamMembers: Array<{ id: string; name: string | null; email: string | null; image: string | null }>;
  initialFilter?: TaskStatusFilter;
  initialOpenTaskId?: string;
  statusConfig?: ProjectStatusConfig;
  canEditStatuses?: boolean;
  isAdmin?: boolean;
  /** Widok wielu projektów: projekty w zakresie (chipy pod nagłówkiem). */
  scopeProjects?: Array<{ id: string; name: string; emoji: string; isInbox: boolean }>;
  /** Id zapisanej grupy projektów (gdy widok otwarty z grupy) — do edycji. */
  multiGroupId?: string;
}

export function TasksPage({ tasks, allProjects, allTags, projectId, inboxId, viewMode, projectName, teamMembers, initialFilter, initialOpenTaskId, statusConfig = DEFAULT_STATUS_CONFIG, canEditStatuses = false, isAdmin = false, scopeProjects = [], multiGroupId }: TasksPageProps) {
  const [statusConfigOpen, setStatusConfigOpen] = useState(false);
  // Klucz aktywnej zakładki: "ALL" | status systemowy | klucz własnego statusu.
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter ?? "ALL");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<string[] | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(initialOpenTaskId ?? null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialOpenTaskId ?? null);
  // Świeżo dodane zadanie — fallback dla panelu szczegółów. W widokach wirtualnych
  // (Dziś/Nadchodzące/Zaległe) nowe zadanie trafia do Skrzynki bez terminu, więc nie
  // wchodzi do przefiltrowanej `tasks`; trzymamy zwrócony obiekt, by panel i tak się otworzył.
  const [justCreated, setJustCreated] = useState<Task | null>(null);
  // „Migawka" ostatniej znanej wersji otwartego zadania. Gdy zmiana statusu lub terminu
  // wypchnie zadanie z bieżącego (przefiltrowanego serwerowo) widoku — np. ukończenie w
  // widoku aktywnych albo zmiana terminu poza „Dziś"/„Nadchodzące" — zadania nie ma już w
  // propie `tasks`, więc bez tej migawki panel szczegółów/edycji by się zamknął. Trzymamy
  // panel otwarty na ostatniej znanej wersji; z listy zadanie i tak znika.
  const [openTaskSnapshot, setOpenTaskSnapshot] = useState<Task | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  // Prezentacja listy: "default" = naturalne grupowanie widoku (dni/projekty), "priority" = po priorytetach.
  // Dotyczy widoków „Nadchodzące/Zaległe/Wszystkie" (Dziś i projekty są zawsze po priorytetach).
  const [groupBy, setGroupBy] = useState<"default" | "priority">("default");
  const [sortBy, setSortBy] = useState<"default" | "completedAt">("default");
  const [layout, setLayout] = useState<"list" | "kanban" | "timeline">("list");
  const canToggleGrouping = viewMode === "upcoming" || viewMode === "overdue" || viewMode === "all" || viewMode === "multi";
  const [, startTransition] = useTransition();
  // Bulkowa (zbiorcza) edycja — tryb zaznaczania + zaznaczone id + kotwica zakresu (Shift).
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const quickAddRef = useRef<QuickAddTaskHandle>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);
  // Zadania, dla których już wysłaliśmy powiadomienie (klucz: id + termin).
  // Przeżywa re-rendery i zmiany propu `tasks`, więc nie dublujemy notyfikacji.
  const notifiedRef = useRef<Set<string>>(new Set());

  // For virtual views, create tasks in inbox instead
  const isVirtualView = ["today", "upcoming", "overdue", "all", "multi"].includes(projectId);
  const addProjectId = isVirtualView ? inboxId : projectId;

  // Świeża wersja z listy; jeśli zadania tam (jeszcze/już) nie ma — użyj świeżo utworzonego.
  const liveOpenTask = openTaskId
    ? tasks.find((t) => t.id === openTaskId) ?? (justCreated?.id === openTaskId ? justCreated : null)
    : null;
  // Panel pokazuje świeżą wersję, a gdy zadanie wypadło z widoku — ostatnią migawkę
  // (tylko dla aktualnie otwartego id, żeby nie pokazać poprzedniego zadania).
  const openTask = openTaskId
    ? liveOpenTask ?? (openTaskSnapshot?.id === openTaskId ? openTaskSnapshot : null)
    : null;

  // Najnowsza lista zadań dla timera — bez tego interwał (zależności []) widziałby
  // tylko `tasks` z pierwszego renderu.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotificationsEnabled(Notification.permission === "granted");
    }
    checkDueNotifications(tasks);
  }, [tasks]);

  // Preferencja grupowania przeżywa nawigację między widokami (localStorage).
  useEffect(() => {
    const saved = localStorage.getItem("tasks.groupBy");
    if (saved === "priority" || saved === "default") setGroupBy(saved);
    const savedSort = localStorage.getItem("tasks.sortBy");
    if (savedSort === "completedAt" || savedSort === "default") setSortBy(savedSort);
  }, []);
  useEffect(() => {
    localStorage.setItem("tasks.groupBy", groupBy);
  }, [groupBy]);
  useEffect(() => {
    localStorage.setItem("tasks.sortBy", sortBy);
  }, [sortBy]);

  // Cykliczne sprawdzanie terminów. Wcześniej `checkDueNotifications` odpalało się
  // tylko przy montażu i zmianie propu `tasks`, więc przypomnienie „10 min przed"
  // pojawiało się jedynie przypadkiem (gdy akurat coś przeładowało listę). Timer co
  // 30 s gwarantuje, że termin zostanie złapany niezależnie od zmian danych.
  useEffect(() => {
    const id = setInterval(() => checkDueNotifications(tasksRef.current), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Otwarte szczegóły → wpis w historii, by przycisk „wstecz" zamykał panel
  // (zamiast opuszczać stronę), zwłaszcza na mobile.
  // Po zamknięciu panelu porzuć fallback świeżo utworzonego zadania (każda ścieżka zamknięcia).
  useEffect(() => {
    if (!openTaskId) { setJustCreated(null); setOpenTaskSnapshot(null); }
  }, [openTaskId]);

  // Dopóki otwarte zadanie jest w widoku, odświeżamy jego migawkę. Gdy zniknie z listy
  // (zmiana statusu/terminu), migawka zostaje ostatnią znaną wersją i panel nie zamyka się.
  useEffect(() => {
    if (liveOpenTask) setOpenTaskSnapshot(liveOpenTask);
  }, [liveOpenTask]);

  useEffect(() => {
    if (!openTaskId) return;
    window.history.pushState({ taskDetail: true }, "");
    const onPop = () => setOpenTaskId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [openTaskId]);

  // Wyświetla powiadomienie. Preferuje Service Worker (`registration.showNotification`),
  // bo iOS Safari / PWA NIE wspiera konstruktora `new Notification()` — tam działa tylko
  // ścieżka SW. Na desktopie SW też działa.
  //
  // UWAGA: `navigator.serviceWorker.ready` to obietnica, która NIGDY nie jest odrzucana —
  // gdy SW nie jest aktywny (np. błąd rejestracji), zawiesza się w nieskończoność. Poprzednia
  // wersja czekała na nią bez limitu, więc przy niezdrowym SW powiadomienia na komputerze
  // przestawały działać (brak fallbacku). Dlatego ścigamy `ready` z krótkim timeoutem i przy
  // braku aktywnego SW spadamy na konstruktor (desktop), a gdy i to się nie uda — milczymy.
  async function showTaskNotification(title: string, options: NotificationOptions) {
    if ("serviceWorker" in navigator) {
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        if (reg && "showNotification" in reg) {
          await reg.showNotification(title, options);
          return;
        }
      } catch {
        /* spadamy do fallbacku poniżej */
      }
    }
    try {
      new Notification(title, options);
    } catch {
      /* środowisko bez wsparcia powiadomień */
    }
  }

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
      void showTaskNotification(`Zadanie za chwilę: ${t.title}`, {
        body: `Projekt: ${projectLabel} · Termin: ${time}`,
        icon: "/pwa-icon/192",
        tag: key, // ten sam tag = system nie zdubluje powiadomienia
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
    const result: Record<string, number> = {};
    // „Aktywne" = statusy nie-terminalne (DONE/CANCELLED wykluczone, ale W weryfikacji liczy się).
    result["ALL"] = tasks.filter((t) => !statusMetaFor(t.status, statusConfig).isTerminal).length;
    for (const s of resolveStatuses(statusConfig)) {
      result[s.key] = tasks.filter((t) => t.status === s.key).length;
    }
    return result;
  }, [tasks, statusConfig]);

  // Etykiety zakładek (z nazwami własnych statusów); „ALL" stałe.
  const filterLabels = useMemo<Record<string, string>>(
    () => ({ ALL: "Wszystkie", ...Object.fromEntries(resolveStatuses(statusConfig).map((s) => [s.key, s.label])) }),
    [statusConfig]
  );

  // Zakładki filtrów zależne od konfiguracji listy: „Wszystkie" + włączone statusy.
  const statusFilters = useMemo<string[]>(
    () => ["ALL", ...statusConfig.enabled],
    [statusConfig]
  );

  // Zadania faktycznie widoczne w bieżącej zakładce — to samo filtrowanie co w TaskList
  // (status zakładki + tagi, na bazie wyników wyszukiwania). Używane przez przycisk
  // „Kopiuj prompt dla Claude", żeby kopiował dokładnie to, co admin ma przed sobą,
  // a nie wszystkie aktywne zadania listy.
  const visibleTasks = useMemo(() => {
    const byStatus =
      activeFilter === "ALL"
        ? displayedTasks.filter((t) => !statusMetaFor(t.status, statusConfig).isTerminal)
        : displayedTasks.filter((t) => t.status === activeFilter);
    if (selectedTagIds.length === 0) return byStatus;
    return byStatus.filter((t) =>
      selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid))
    );
  }, [displayedTasks, activeFilter, selectedTagIds, statusConfig]);

  // ─── Bulkowa edycja: handlery zaznaczenia ──────────────────────────────────
  function finishSelection(msg: string | null) {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setLastSelectedId(null);
    setBulkMessage(msg);
    if (msg) setTimeout(() => setBulkMessage(null), 4000);
  }
  function toggleSelectOne(id: string) {
    setSelectionMode(true);
    setSelectedIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setLastSelectedId(id);
  }
  function selectRange(ids: string[]) {
    setSelectionMode(true);
    setSelectedIds((s) => { const n = new Set(s); ids.forEach((i) => n.add(i)); return n; });
    setLastSelectedId(ids[ids.length - 1] ?? null);
  }
  function toggleSelectAllVisible() {
    const ids = visibleTasks.map((t) => t.id);
    const allSel = ids.length > 0 && ids.every((i) => selectedIds.has(i));
    if (allSel) { setSelectedIds(new Set()); setLastSelectedId(null); }
    else { setSelectionMode(true); setSelectedIds(new Set(ids)); }
  }
  function applyBulk(patch: BulkPatch) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkUpdateTasks(ids, patch);
      finishSelection(res.skipped > 0 ? `Zmieniono ${res.updated} z ${ids.length} (pominięto ${res.skipped})` : `Zmieniono ${res.updated}`);
    });
  }
  function deleteBulk() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Usunąć ${ids.length} zaznaczonych zadań? Trafią do Kosza.`)) return;
    startBulkTransition(async () => {
      const res = await bulkDeleteTasks(ids);
      finishSelection(res.skipped > 0 ? `Usunięto ${res.deleted} z ${ids.length} (pominięto ${res.skipped})` : `Usunięto ${res.deleted}`);
    });
  }

  // Zaznaczanie działa tylko w widoku listy — przy zmianie układu wyczyść stan.
  useEffect(() => {
    if (layout !== "list") { setSelectionMode(false); setSelectedIds(new Set()); setLastSelectedId(null); }
  }, [layout]);

  // Kanban: kolumny = wszystkie włączone statusy (także terminalne, by kolumna „Zrobione” się
  // wypełniała) — nie zawężamy po zakładce statusu (w Kanbanie ukryta), filtrujemy tylko po tagach
  // (wyszukiwanie już zawarte w `displayedTasks`). Wcześniej Kanban dostawał surowe `displayedTasks`,
  // więc tagi go nie filtrowały.
  const kanbanTasks = useMemo(() => {
    if (selectedTagIds.length === 0) return displayedTasks;
    return displayedTasks.filter((t) => selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid)));
  }, [displayedTasks, selectedTagIds]);

  // Timeline: zakładka statusu działa („Wszystkie” = wszystkie statusy, jak dotąd; konkretny status
  // zawęża) + filtr tagów (AND). Wcześniej Timeline dostawał surowe `displayedTasks`, więc ani zakładki
  // ani tagi nie miały efektu.
  const timelineTasks = useMemo(() => {
    const byStatus = activeFilter === "ALL" ? displayedTasks : displayedTasks.filter((t) => t.status === activeFilter);
    if (selectedTagIds.length === 0) return byStatus;
    return byStatus.filter((t) => selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid)));
  }, [displayedTasks, activeFilter, selectedTagIds]);

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
      onFilterTab: (index: number) => setActiveFilter(statusFilters[index] ?? "ALL"),
      onCommandPalette: () => {},
      onEscape: () => {
        if (selectionMode || selectedIds.size > 0) { finishSelection(null); return; }
        if (aiSearchResults) { setAiSearchResults(null); setSearchQuery(""); return; }
        if (isSearchOpen) { setSearchQuery(""); setIsSearchOpen(false); return; }
        if (openTaskId) { setOpenTaskId(null); return; }
        setFocusedTaskId(null);
      },
    }),
    [focusedTaskId, filteredForNav, openTaskId, isSearchOpen, aiSearchResults, statusFilters, selectionMode, selectedIds]
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
            {projectId === "multi" && <option value="multi">🗂 Wiele projektów</option>}
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

        {/* Actions — na wąskich ekranach (iPhone) rząd ikon przewija się w poziomie zamiast
            wypadać poza kadr. Uwaga: kontener z overflow przycina wewnętrzne popovery (overflow-y
            liczy się jako auto), więc akcje z rozwijanym menu (ProjectActionsMenu) trzymamy POZA
            strefą scrolla — przypięte po prawej, zawsze widoczne i nieobcięte. */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto [&>*]:flex-shrink-0">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {counts.ALL > 0 && `${counts.ALL} aktywne`}
          </span>

          <Link
            href="/trash"
            className="flex items-center justify-center p-1.5 rounded"
            style={{ color: "var(--text-muted)" }}
            title="Kosz (usunięte do przywrócenia)"
          >
            <Trash2 size={15} />
          </Link>

          {/* Przełącznik prezentacji: naturalne grupowanie widoku ↔ po priorytetach */}
          {canToggleGrouping && (
            <div
              className="flex items-center rounded overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => setGroupBy("default")}
                className="flex items-center justify-center p-1.5 focus:outline-none"
                style={{
                  color: groupBy === "default" ? "var(--text-primary)" : "var(--text-muted)",
                  backgroundColor: groupBy === "default" ? "var(--bg-hover)" : "transparent",
                }}
                title="Grupuj jak w widoku (dni / projekty)"
              >
                <ListTree size={15} />
              </button>
              <button
                onClick={() => setGroupBy("priority")}
                className="flex items-center justify-center p-1.5 focus:outline-none"
                style={{
                  color: groupBy === "priority" ? "var(--text-primary)" : "var(--text-muted)",
                  backgroundColor: groupBy === "priority" ? "var(--bg-hover)" : "transparent",
                }}
                title="Grupuj po priorytetach (jak w „Dziś”)"
              >
                <Flag size={15} />
              </button>
            </div>
          )}

          {/* Sortuj sekcję „Zrobione" po dacie wykonania (przegląd „co kiedy zrobiłem") */}
          <button
            onClick={() => setSortBy((s) => (s === "completedAt" ? "default" : "completedAt"))}
            className="p-1.5 rounded focus:outline-none"
            style={{ color: sortBy === "completedAt" ? "var(--accent-blue)" : "var(--text-muted)" }}
            title={sortBy === "completedAt" ? "Zrobione: sortowane po dacie wykonania (kliknij, by wyłączyć)" : "Sortuj zrobione po dacie wykonania"}
          >
            <CalendarCheck size={15} />
          </button>

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

          {canEditStatuses && (
            <button
              onClick={() => setStatusConfigOpen(true)}
              className="p-1.5 rounded focus:outline-none"
              style={{ color: "var(--text-muted)" }}
              title="Statusy listy (konfiguracja)"
            >
              <SlidersHorizontal size={15} />
            </button>
          )}

          {/* Bulkowa edycja: wejście w tryb zaznaczania (tylko widok listy) */}
          {layout === "list" && (
            <button
              onClick={() => { if (selectionMode || selectedIds.size > 0) finishSelection(null); else setSelectionMode(true); }}
              className="p-1.5 rounded focus:outline-none"
              style={{ color: selectionMode ? "var(--accent-blue)" : "var(--text-muted)" }}
              title="Zaznacz wiele (edycja zbiorcza)"
              aria-label="Zaznacz wiele zadań"
            >
              <CheckSquare size={15} />
            </button>
          )}

          {/* Przełącznik układu: Lista / Kanban / Timeline (T1/T2) */}
          <div className="flex items-center gap-0.5 rounded" style={{ border: "1px solid var(--border)" }}>
            {([
              { key: "list", label: "Lista", Icon: ListIcon },
              { key: "kanban", label: "Kanban", Icon: Columns3 },
              { key: "timeline", label: "Timeline", Icon: CalendarRange },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setLayout(key)}
                className="p-1.5 focus:outline-none"
                title={label}
                aria-label={label}
                style={{ color: layout === key ? "var(--accent-blue)" : "var(--text-muted)", background: layout === key ? "var(--bg-hover)" : "transparent" }}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>

          {/* Admin: skopiuj prompt dla Claude Code z zadaniami widocznymi w tej zakładce */}
          {isAdmin && <TaskListClipboardButton tasks={visibleTasks} />}
          </div>

          {/* Akcje projektu (zmień nazwę / usuń) — POZA strefą scrolla, żeby rozwijane menu
              nie było przycinane przez overflow; przypięte po prawej, zawsze widoczne. */}
          {viewMode === "project" && (() => {
            const current = allProjects.find((p) => p.id === projectId);
            return current && !current.isInbox
              ? <div className="flex-shrink-0"><ProjectActionsMenu project={current} /></div>
              : null;
          })()}
        </div>
      </div>

      {/* Pasek zakresu widoku wielu projektów: zawsze widać, z jakich projektów są zadania.
          Każdy chip prowadzi do pojedynczego projektu; ołówek otwiera edycję zapisanego widoku. */}
      {viewMode === "multi" && scopeProjects.length > 0 && (
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 border-b flex-shrink-0 overflow-x-auto"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
        >
          <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
            Projekty:
          </span>
          {scopeProjects.map((p) => (
            <Link
              key={p.id}
              href={`/tasks/${p.id}`}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs flex-shrink-0"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              title={`Otwórz projekt: ${p.name}`}
            >
              <span>{p.isInbox ? "📥" : p.emoji}</span>
              <span className="truncate" style={{ maxWidth: 140 }}>{p.name}</span>
            </Link>
          ))}
          {multiGroupId && (
            <Link
              href={`/tasks/multi?group=${multiGroupId}&edit=1`}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs flex-shrink-0 ml-1"
              style={{ color: "var(--text-muted)" }}
              title="Edytuj grupę (nazwa / projekty)"
            >
              <Pencil size={11} />
            </Link>
          )}
        </div>
      )}

      {canEditStatuses && statusConfigOpen && (
        <TaskStatusConfigEditor
          projectId={projectId}
          config={statusConfig}
          onClose={() => setStatusConfigOpen(false)}
        />
      )}

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
              style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}
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

      <QuickAddTask
        ref={quickAddRef}
        projectId={addProjectId}
        onCreated={(t) => { setJustCreated(t); setOpenTaskId(t.id); setFocusedTaskId(t.id); }}
      />

      <TaskFilters
        active={activeFilter}
        counts={counts}
        onChange={setActiveFilter}
        allTags={allTags}
        selectedTagIds={selectedTagIds}
        onTagToggle={(id) => setSelectedTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
        filters={statusFilters}
        labels={filterLabels}
        showStatusTabs={layout !== "kanban"}
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
        {layout === "kanban" ? (
          <KanbanBoard tasks={kanbanTasks} statusConfig={statusConfig} onOpen={(id) => setOpenTaskId(id)} />
        ) : layout === "timeline" ? (
          <TimelineView tasks={timelineTasks} statusConfig={statusConfig} onOpen={(id) => setOpenTaskId(id)} />
        ) : (
          <TaskList
            tasks={displayedTasks}
            filter={activeFilter}
            statusConfig={statusConfig}
            viewMode={viewMode}
            groupBy={canToggleGrouping ? groupBy : "default"}
            sortBy={sortBy}
            selectedTagIds={selectedTagIds}
            focusedTaskId={focusedTaskId}
            onFocus={setFocusedTaskId}
            onOpen={(id) => setOpenTaskId(id)}
            rowRefs={rowRefs}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            lastSelectedId={lastSelectedId}
            onToggleOne={toggleSelectOne}
            onSelectRange={selectRange}
          />
        )}

        {/* Detail panel — desktop */}
        {openTask && (
          <div
            className="hidden md:flex flex-col border-l flex-shrink-0"
            style={{ width: 380, borderColor: "var(--border)" }}
          >
            <TaskDetail
              task={openTask}
              allTags={allTags}
              allProjects={allProjects}
              statusConfig={statusConfig}
              onClose={() => setOpenTaskId(null)}
              onDelete={() => { setOpenTaskId(null); setFocusedTaskId(null); }}
            />
          </div>
        )}

        {/* Detail panel — mobile modal (padding-top = pasek stanu/notch iPhone).
            data-omnia-overlay="panel": szczegóły zadania to ekran roboczy, nie przelotny dialog —
            wykluczamy je z detekcji „modalu treściowego" (useOverlayState), a jednocześnie
            sygnalizujemy „panel roboczy", by pływające przyciski (asystent AI, „zgłoś błąd")
            zostały WYNIESIONE NAD ten panel (podbity z-index), zamiast zniknąć pod nim.
            WAŻNE: ten div (mimo md:hidden) jest w DOM także na desktopie — na komputerze panelu
            nie widać, a przyciski i tak działają, więc podniesiony z-index jest nieszkodliwy. */}
        {openTask && (
          <div
            data-omnia-overlay="panel"
            className="md:hidden fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: "var(--bg-surface)", paddingTop: "env(safe-area-inset-top)" }}
          >
            <TaskDetail
              task={openTask}
              allTags={allTags}
              allProjects={allProjects}
              statusConfig={statusConfig}
              onClose={() => setOpenTaskId(null)}
              onDelete={() => { setOpenTaskId(null); setFocusedTaskId(null); }}
            />
          </div>
        )}
      </div>

      {/* Pasek akcji zbiorczych — widoczny gdy coś zaznaczono (tylko widok listy) */}
      {layout === "list" && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          totalVisible={visibleTasks.length}
          allSelected={visibleTasks.length > 0 && visibleTasks.every((t) => selectedIds.has(t.id))}
          pending={bulkPending}
          statusConfig={statusConfig}
          allProjects={allProjects}
          allTags={allTags}
          onSelectAll={toggleSelectAllVisible}
          onClear={() => finishSelection(null)}
          onApply={applyBulk}
          onDelete={deleteBulk}
        />
      )}

      {/* Krótki komunikat wyniku operacji zbiorczej */}
      {bulkMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg text-sm shadow-lg pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)", backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          {bulkMessage}
        </div>
      )}

    </div>
  );
}
