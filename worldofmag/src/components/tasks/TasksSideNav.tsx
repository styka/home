"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarClock, CalendarDays, AlertCircle, Inbox, Tag, Plus,
  Loader2, Pencil, Check, X, LayoutList, Trash2, CheckSquare, Square, Layers, ChevronRight,
} from "lucide-react";
import { getTaskProjects, createTaskProject, updateTaskProject, deleteTaskProject } from "@/actions/taskProjects";
import { getProjectGroups, createProjectGroup, updateProjectGroup, deleteProjectGroup } from "@/actions/projectGroups";
import type { TaskProject, ProjectGroup } from "@/types";

const VIRTUAL_VIEWS = [
  { id: "today", label: "Dziś", Icon: CalendarClock },
  { id: "upcoming", label: "Nadchodzące", Icon: CalendarDays },
  { id: "overdue", label: "Zaległe", Icon: AlertCircle },
  { id: "all", label: "Wszystkie", Icon: LayoutList },
] as const;

// Presety koloru grupy (kropka-znacznik przy projekcie). Wartości to tokeny motywu.
const GROUP_COLORS = [
  "var(--accent-blue)",
  "var(--accent-green)",
  "var(--accent-amber)",
  "var(--accent-red)",
  "var(--accent-purple)",
] as const;

const EXPANDED_KEY = "tasks.groups.expanded";

type GroupEditorState = {
  mode: "create" | "edit";
  id?: string;
  name: string;
  emoji: string;
  color: string | null;
  selected: string[];
};

export function TasksSideNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Inline edytor grupy projektów (tworzenie lub edycja).
  const [groupEditor, setGroupEditor] = useState<GroupEditorState | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  // Id grupy, dla której edytor już auto-otwarto z URL (?edit=1) — by nie odpalał się
  // ponownie po zapisie (reload zmienia `groups`, a edit=1 zostaje w URL).
  const [autoEditedId, setAutoEditedId] = useState<string | null>(null);
  // Rozwinięte grupy (folder-drzewko) — przeżywa nawigację (localStorage).
  const [expanded, setExpanded] = useState<string[]>([]);

  const reload = useCallback(() => {
    getTaskProjects().then(setProjects).catch(() => {});
    getProjectGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPANDED_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) setExpanded(v.filter((x): x is string => typeof x === "string"));
      }
    } catch { /* noop */ }
  }, []);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  const inbox = projects.find((p) => p.isInbox);
  const regularProjects = projects.filter((p) => !p.isInbox);
  // Projekty wybieralne w edytorze grupy: Skrzynka + zwykłe projekty.
  const selectableProjects = [...(inbox ? [inbox] : []), ...regularProjects];

  const activeGroupId = pathname === "/tasks/multi" ? (searchParams.get("group") ?? searchParams.get("view")) : null;

  /** Grupy, do których należy dany projekt (kierunek projekt → grupy). */
  function groupsForProject(projectId: string): ProjectGroup[] {
    return groups.filter((g) => g.projectIds.includes(projectId));
  }

  // Wejście z „ołówka" na pasku zakresu: /tasks/multi?group=<id>&edit=1 → otwórz edytor (raz na id).
  useEffect(() => {
    if (searchParams.get("edit") !== "1") { setAutoEditedId(null); return; }
    const id = searchParams.get("group") ?? searchParams.get("view");
    if (!id || groups.length === 0 || id === autoEditedId) return;
    const g = groups.find((x) => x.id === id);
    if (g) {
      setGroupEditor({ mode: "edit", id: g.id, name: g.name, emoji: g.emoji, color: g.color, selected: [...g.projectIds] });
      setAutoEditedId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, groups]);

  function isActive(id: string) {
    return pathname === `/tasks/${id}`;
  }

  function itemStyle(id: string) {
    return {
      paddingLeft: 40,
      paddingTop: 5,
      paddingBottom: 5,
      paddingRight: 8,
      backgroundColor: isActive(id) ? "var(--bg-elevated)" : hovered === id ? "var(--bg-hover)" : undefined,
      color: isActive(id) ? "var(--text-primary)" : "var(--text-muted)",
    };
  }

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createTaskProject(newName.trim());
      setNewName("");
      setIsAdding(false);
      reload();
    });
  }

  function handleEdit(id: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      await updateTaskProject(id, { name: editName.trim() });
      setEditingId(null);
      reload();
    });
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const project = projects.find((p) => p.id === id);
    const count = project?._count?.tasks ?? 0;
    const name = project?.name ?? "ten projekt";
    const msg =
      count > 0
        ? `Usunąć projekt „${name}"?\n\n${count} zadań NIE zostanie usuniętych — stracą przypisanie do projektu, ale pozostaną widoczne w „Wszystkie".`
        : `Usunąć projekt „${name}"?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteTaskProject(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Nie udało się usunąć projektu");
      }
      reload();
    });
  }

  // ——— Grupy projektów ———

  function openCreateGroup() {
    setGroupError(null);
    setGroupEditor({ mode: "create", name: "", emoji: "🗂", color: null, selected: [] });
  }

  function openEditGroup(g: ProjectGroup, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setGroupError(null);
    setGroupEditor({ mode: "edit", id: g.id, name: g.name, emoji: g.emoji, color: g.color, selected: [...g.projectIds] });
  }

  function toggleEditorProject(id: string) {
    setGroupEditor((prev) =>
      prev
        ? { ...prev, selected: prev.selected.includes(id) ? prev.selected.filter((x) => x !== id) : [...prev.selected, id] }
        : prev
    );
  }

  function suggestedName(selected: string[]): string {
    const names = selected
      .map((id) => selectableProjects.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[];
    return names.slice(0, 3).join(" + ") + (names.length > 3 ? " +…" : "");
  }

  function saveGroup() {
    if (!groupEditor) return;
    if (groupEditor.selected.length === 0) { setGroupError("Wybierz co najmniej jeden projekt"); return; }
    const name = (groupEditor.name.trim() || suggestedName(groupEditor.selected)).slice(0, 80);
    const payload = { name, emoji: groupEditor.emoji.trim() || "🗂", color: groupEditor.color, projectIds: groupEditor.selected };
    const editor = groupEditor;
    startTransition(async () => {
      try {
        if (editor.mode === "edit" && editor.id) {
          await updateProjectGroup(editor.id, payload);
        } else {
          await createProjectGroup(payload);
        }
        setGroupEditor(null);
        setGroupError(null);
        reload();
      } catch (err) {
        setGroupError(err instanceof Error ? err.message : "Nie udało się zapisać grupy");
      }
    });
  }

  function handleDeleteGroup(g: ProjectGroup, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Usunąć grupę „${g.name}"?\n\nProjekty i zadania pozostaną nienaruszone — usuwasz tylko tę grupę.`)) return;
    startTransition(async () => {
      try { await deleteProjectGroup(g.id); } catch { /* ignore */ }
      reload();
    });
  }

  /** Wiersz projektu zagnieżdżony pod rozwiniętą grupą (lekki link, bez akcji). */
  function renderNestedProject(p: TaskProject) {
    return (
      <Link
        key={`nested:${p.id}`}
        href={`/tasks/${p.id}`}
        onMouseEnter={() => setHovered(`nested:${p.id}`)}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs py-1"
        style={{
          paddingLeft: 56,
          paddingRight: 8,
          backgroundColor: isActive(p.id) ? "var(--bg-elevated)" : hovered === `nested:${p.id}` ? "var(--bg-hover)" : undefined,
          color: isActive(p.id) ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span>{p.isInbox ? "📥" : p.emoji}</span>
        <span className="flex-1 truncate">{p.name}</span>
        {(p._count?.tasks ?? 0) > 0 && <span style={{ fontSize: 10 }}>{p._count!.tasks}</span>}
      </Link>
    );
  }

  return (
    <div className="pb-2">
      {VIRTUAL_VIEWS.map(({ id, label, Icon }) => (
        <Link
          key={id}
          href={`/tasks/${id}`}
          onMouseEnter={() => setHovered(id)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center gap-2 mx-2 rounded text-xs"
          style={itemStyle(id)}
        >
          <Icon size={12} />
          {label}
        </Link>
      ))}

      <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      {inbox && (
        <Link
          href={`/tasks/${inbox.id}`}
          onMouseEnter={() => setHovered(inbox.id)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center gap-2 mx-2 rounded text-xs"
          style={itemStyle(inbox.id)}
        >
          <Inbox size={12} />
          <span className="flex-1">Skrzynka</span>
          {(inbox._count?.tasks ?? 0) > 0 && (
            <span style={{ fontSize: 10 }}>{inbox._count!.tasks}</span>
          )}
        </Link>
      )}

      {/* ——— Grupy projektów (foldery nad projektami) ——— */}
      <div className="flex items-center justify-between mx-2 pr-1 mt-1" style={{ paddingLeft: 16 }}>
        <span className="flex items-center gap-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)", fontSize: 10 }}>
          <Layers size={11} /> Grupy
        </span>
        <button
          onClick={openCreateGroup}
          className="focus:outline-none hover:opacity-70 p-0.5"
          style={{ color: "var(--text-muted)" }}
          title="Nowa grupa projektów"
        >
          <Plus size={12} />
        </button>
      </div>

      {groups.map((g) => {
        const active = activeGroupId === g.id;
        const isOpen = expanded.includes(g.id);
        const members = g.projectIds
          .map((pid) => projects.find((p) => p.id === pid))
          .filter((p): p is TaskProject => !!p);
        return (
          <div key={g.id}>
            <div
              onMouseEnter={() => setHovered(`group:${g.id}`)}
              onMouseLeave={() => setHovered(null)}
              className="flex items-center mx-2 rounded"
              style={{ backgroundColor: active ? "var(--bg-elevated)" : hovered === `group:${g.id}` ? "var(--bg-hover)" : undefined }}
            >
              <button
                onClick={() => toggleExpanded(g.id)}
                className="flex items-center justify-center focus:outline-none flex-shrink-0"
                style={{ paddingLeft: 18, paddingRight: 2, color: "var(--text-muted)", height: 26 }}
                title={isOpen ? "Zwiń grupę" : "Rozwiń grupę"}
                aria-expanded={isOpen}
              >
                <ChevronRight size={12} style={{ transition: "transform 0.12s", transform: isOpen ? "rotate(90deg)" : "none" }} />
              </button>
              <Link
                href={`/tasks/multi?group=${g.id}`}
                className="flex items-center gap-2 flex-1 text-xs py-1 min-w-0"
                style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
                title={`${g.projectIds.length} projekty — otwórz wspólny widok`}
              >
                {g.color
                  ? <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: g.color }} />
                  : <span className="flex-shrink-0">{g.emoji}</span>}
                <span className="flex-1 truncate">{g.name}</span>
                {(g.activeCount ?? 0) > 0 && <span style={{ fontSize: 10 }}>{g.activeCount}</span>}
              </Link>
              {hovered === `group:${g.id}` && (
                <div className="flex items-center gap-1 mr-1.5 flex-shrink-0">
                  <button onClick={(e) => openEditGroup(g, e)} className="focus:outline-none hover:opacity-70" style={{ color: "var(--text-muted)" }} title="Edytuj grupę">
                    <Pencil size={10} />
                  </button>
                  <button onClick={(e) => handleDeleteGroup(g, e)} className="focus:outline-none hover:opacity-70" style={{ color: "var(--accent-red)" }} title="Usuń grupę">
                    <Trash2 size={10} />
                  </button>
                </div>
              )}
            </div>
            {isOpen && (
              members.length > 0
                ? members.map(renderNestedProject)
                : <div className="text-xs py-1" style={{ paddingLeft: 56, color: "var(--text-muted)" }}>Brak dostępnych projektów</div>
            )}
          </div>
        );
      })}

      {groupEditor && (
        <div className="mx-2 mt-1 mb-2 p-2 rounded" style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1 mb-2">
            <input
              value={groupEditor.emoji}
              onChange={(e) => setGroupEditor((p) => p ? { ...p, emoji: e.target.value.slice(0, 2) } : p)}
              className="w-7 text-center bg-transparent text-sm focus:outline-none rounded"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              aria-label="Ikona grupy"
            />
            <input
              autoFocus
              value={groupEditor.name}
              onChange={(e) => setGroupEditor((p) => p ? { ...p, name: e.target.value } : p)}
              onKeyDown={(e) => { if (e.key === "Enter") saveGroup(); if (e.key === "Escape") setGroupEditor(null); }}
              placeholder={groupEditor.selected.length ? suggestedName(groupEditor.selected) : "Nazwa grupy…"}
              className="flex-1 bg-transparent text-xs focus:outline-none rounded px-1.5 py-1"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {/* Kolor grupy (kropka-znacznik) */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Kolor:</span>
            <button
              onClick={() => setGroupEditor((p) => p ? { ...p, color: null } : p)}
              className="rounded-full focus:outline-none flex items-center justify-center"
              style={{ width: 16, height: 16, border: "1px solid var(--border)", color: "var(--text-muted)" }}
              title="Bez koloru"
            >
              {groupEditor.color === null && <Check size={9} />}
            </button>
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setGroupEditor((p) => p ? { ...p, color: c } : p)}
                className="rounded-full focus:outline-none"
                style={{ width: 16, height: 16, backgroundColor: c, outline: groupEditor.color === c ? "2px solid var(--text-primary)" : "none", outlineOffset: 1 }}
                title="Kolor grupy"
              />
            ))}
          </div>

          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Projekty w grupie:</div>
          <div className="max-h-44 overflow-y-auto -mx-0.5">
            {selectableProjects.length === 0 && (
              <div className="text-xs px-1 py-1" style={{ color: "var(--text-muted)" }}>Brak projektów</div>
            )}
            {selectableProjects.map((p) => {
              const checked = groupEditor.selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleEditorProject(p.id)}
                  className="flex items-center gap-2 w-full rounded text-xs px-1 py-1 focus:outline-none"
                  style={{ color: checked ? "var(--text-primary)" : "var(--text-secondary)" }}
                >
                  {checked
                    ? <CheckSquare size={13} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
                    : <Square size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                  <span className="flex-shrink-0">{p.isInbox ? "📥" : p.emoji}</span>
                  <span className="flex-1 truncate text-left">{p.name}</span>
                </button>
              );
            })}
          </div>

          {groupError && <div className="text-xs mt-1.5" style={{ color: "var(--accent-red)" }}>{groupError}</div>}

          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={saveGroup}
              disabled={isPending}
              className="flex items-center gap-1 rounded text-xs px-2 py-1 focus:outline-none disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {groupEditor.mode === "edit" ? "Zapisz" : "Utwórz grupę"}
            </button>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {groupEditor.selected.length} wybrane
            </span>
            <button
              onClick={() => { setGroupEditor(null); setGroupError(null); }}
              className="ml-auto focus:outline-none rounded p-1"
              style={{ color: "var(--text-muted)" }}
              title="Anuluj"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ——— Projekty (płaska lista; znacznik = przynależność do grup) ——— */}
      <div className="mx-2 mt-1 mb-0.5 uppercase tracking-wide" style={{ paddingLeft: 16, color: "var(--text-muted)", fontSize: 10 }}>
        Projekty
      </div>

      {regularProjects.map((p) => {
        const memberOf = groupsForProject(p.id);
        return (
        <div
          key={p.id}
          onMouseEnter={() => setHovered(p.id)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center mx-2 rounded"
          style={{ backgroundColor: isActive(p.id) ? "var(--bg-elevated)" : hovered === p.id ? "var(--bg-hover)" : undefined }}
        >
          {editingId === p.id ? (
            <div className="flex items-center gap-1 flex-1 py-1 pr-2" style={{ paddingLeft: 40 }}>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleEdit(p.id); if (e.key === "Escape") setEditingId(null); }}
                className="flex-1 bg-transparent text-xs focus:outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              <button onClick={() => handleEdit(p.id)} className="focus:outline-none" style={{ color: "var(--accent-green)" }}>
                <Check size={11} />
              </button>
              <button onClick={() => setEditingId(null)} className="focus:outline-none" style={{ color: "var(--text-muted)" }}>
                <X size={11} />
              </button>
            </div>
          ) : (
            <>
              <Link
                href={`/tasks/${p.id}`}
                className="flex items-center gap-2 flex-1 text-xs py-1 min-w-0"
                style={{ paddingLeft: 40, color: isActive(p.id) ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                <span>{p.emoji}</span>
                <span className="flex-1 truncate">{p.name}</span>
                {/* Znacznik przynależności do grup (kierunek projekt → grupy) */}
                {memberOf.length > 0 && hovered !== p.id && (
                  <span
                    className="flex items-center gap-0.5 flex-shrink-0"
                    title={`W grupach: ${memberOf.map((g) => g.name).join(", ")}`}
                  >
                    {memberOf.slice(0, 3).map((g) => (
                      <span
                        key={g.id}
                        className="rounded-full"
                        style={{ width: 5, height: 5, backgroundColor: g.color ?? "var(--text-muted)" }}
                      />
                    ))}
                  </span>
                )}
                {(p._count?.tasks ?? 0) > 0 && (
                  <span style={{ fontSize: 10 }}>{p._count!.tasks}</span>
                )}
              </Link>
              {hovered === p.id && (
                <div className="flex items-center gap-1 mr-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => { e.preventDefault(); setEditingId(p.id); setEditName(p.name); }}
                    className="focus:outline-none hover:opacity-70"
                    style={{ color: "var(--text-muted)" }}
                    title="Zmień nazwę"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    className="focus:outline-none hover:opacity-70"
                    style={{ color: "var(--accent-red)" }}
                    title="Usuń projekt"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        );
      })}

      {isAdding ? (
        <div className="flex items-center gap-1 mx-2 py-1 pr-2" style={{ paddingLeft: 40 }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setIsAdding(false); setNewName(""); } }}
            placeholder="Nazwa projektu…"
            className="flex-1 bg-transparent text-xs focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {isPending ? (
            <Loader2 size={11} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          ) : (
            <>
              <button onClick={handleAdd} className="focus:outline-none" style={{ color: "var(--accent-green)" }}>
                <Check size={11} />
              </button>
              <button onClick={() => { setIsAdding(false); setNewName(""); }} className="focus:outline-none" style={{ color: "var(--text-muted)" }}>
                <X size={11} />
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "var(--text-muted)"; }}
          className="flex items-center gap-2 mx-2 rounded text-xs w-[calc(100%-16px)]"
          style={{ paddingLeft: 40, paddingTop: 5, paddingBottom: 5, color: "var(--text-muted)" }}
        >
          <Plus size={11} />
          Nowy projekt
        </button>
      )}

      <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      <Link
        href="/tasks/tags"
        onMouseEnter={() => setHovered("tags")}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs"
        style={itemStyle("tags")}
      >
        <Tag size={12} />
        Tagi
      </Link>
    </div>
  );
}
