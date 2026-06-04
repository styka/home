"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarClock, CalendarDays, AlertCircle, Inbox, Tag, Plus,
  Loader2, Pencil, Check, X, LayoutList, Trash2, CheckSquare, Square, Layers,
} from "lucide-react";
import { getTaskProjects, createTaskProject, updateTaskProject, deleteTaskProject } from "@/actions/taskProjects";
import { getTaskViews, createTaskView, updateTaskView, deleteTaskView } from "@/actions/taskViews";
import type { TaskProject, TaskView } from "@/types";

const VIRTUAL_VIEWS = [
  { id: "today", label: "Dziś", Icon: CalendarClock },
  { id: "upcoming", label: "Nadchodzące", Icon: CalendarDays },
  { id: "overdue", label: "Zaległe", Icon: AlertCircle },
  { id: "all", label: "Wszystkie", Icon: LayoutList },
] as const;

type ViewEditorState = {
  mode: "create" | "edit";
  id?: string;
  name: string;
  emoji: string;
  selected: string[];
};

export function TasksSideNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [views, setViews] = useState<TaskView[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Inline edytor zapisanego widoku wielu projektów (tworzenie lub edycja).
  const [viewEditor, setViewEditor] = useState<ViewEditorState | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  // Id widoku, dla którego edytor został już auto-otwarty z URL (?edit=1) — by nie odpalał
  // się ponownie po zapisie (reload zmienia `views`, a edit=1 zostaje w URL).
  const [autoEditedId, setAutoEditedId] = useState<string | null>(null);

  const reload = useCallback(() => {
    getTaskProjects().then(setProjects).catch(() => {});
    getTaskViews().then(setViews).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const inbox = projects.find((p) => p.isInbox);
  const regularProjects = projects.filter((p) => !p.isInbox);
  // Projekty wybieralne w edytorze widoku: Skrzynka + zwykłe projekty.
  const selectableProjects = [...(inbox ? [inbox] : []), ...regularProjects];

  const activeViewId = pathname === "/tasks/multi" ? searchParams.get("view") : null;

  // Wejście z „ołówka" na pasku zakresu: /tasks/multi?view=<id>&edit=1 → otwórz edytor (raz na id).
  useEffect(() => {
    if (searchParams.get("edit") !== "1") { setAutoEditedId(null); return; }
    const id = searchParams.get("view");
    if (!id || views.length === 0 || id === autoEditedId) return;
    const v = views.find((x) => x.id === id);
    if (v) {
      setViewEditor({ mode: "edit", id: v.id, name: v.name, emoji: v.emoji, selected: [...v.projectIds] });
      setAutoEditedId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, views]);

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

  // ——— Widoki wielu projektów ———

  function openCreateView() {
    setViewError(null);
    setViewEditor({ mode: "create", name: "", emoji: "🗂", selected: [] });
  }

  function openEditView(v: TaskView, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setViewError(null);
    setViewEditor({ mode: "edit", id: v.id, name: v.name, emoji: v.emoji, selected: [...v.projectIds] });
  }

  function toggleViewProject(id: string) {
    setViewEditor((prev) =>
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

  function saveView() {
    if (!viewEditor) return;
    if (viewEditor.selected.length === 0) { setViewError("Wybierz co najmniej jeden projekt"); return; }
    const name = (viewEditor.name.trim() || suggestedName(viewEditor.selected)).slice(0, 80);
    const payload = { name, emoji: viewEditor.emoji.trim() || "🗂", projectIds: viewEditor.selected };
    const editor = viewEditor;
    startTransition(async () => {
      try {
        if (editor.mode === "edit" && editor.id) {
          await updateTaskView(editor.id, payload);
        } else {
          await createTaskView(payload);
        }
        setViewEditor(null);
        setViewError(null);
        reload();
      } catch (err) {
        setViewError(err instanceof Error ? err.message : "Nie udało się zapisać widoku");
      }
    });
  }

  function handleDeleteView(v: TaskView, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Usunąć widok „${v.name}"?\n\nProjekty i zadania pozostaną nienaruszone — usuwasz tylko ten zapisany widok.`)) return;
    startTransition(async () => {
      try { await deleteTaskView(v.id); } catch { /* ignore */ }
      reload();
    });
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

      {regularProjects.map((p) => (
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
                className="flex items-center gap-2 flex-1 text-xs py-1"
                style={{ paddingLeft: 40, color: isActive(p.id) ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                <span>{p.emoji}</span>
                <span className="flex-1 truncate">{p.name}</span>
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
      ))}

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

      {/* ——— Widoki wielu projektów ——— */}
      <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      <div className="flex items-center justify-between mx-2 pr-1" style={{ paddingLeft: 16 }}>
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)", fontSize: 10 }}>
          <Layers size={11} /> Widoki
        </span>
        <button
          onClick={openCreateView}
          className="focus:outline-none hover:opacity-70 p-0.5"
          style={{ color: "var(--text-muted)" }}
          title="Nowy widok wielu projektów"
        >
          <Plus size={12} />
        </button>
      </div>

      {views.map((v) => {
        const active = activeViewId === v.id;
        return (
          <div
            key={v.id}
            onMouseEnter={() => setHovered(`view:${v.id}`)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center mx-2 rounded"
            style={{ backgroundColor: active ? "var(--bg-elevated)" : hovered === `view:${v.id}` ? "var(--bg-hover)" : undefined }}
          >
            <Link
              href={`/tasks/multi?view=${v.id}`}
              className="flex items-center gap-2 flex-1 text-xs py-1 min-w-0"
              style={{ paddingLeft: 40, color: active ? "var(--text-primary)" : "var(--text-muted)" }}
              title={v.projectIds.length + " projekty w widoku"}
            >
              <span>{v.emoji}</span>
              <span className="flex-1 truncate">{v.name}</span>
              {(v.activeCount ?? 0) > 0 && <span style={{ fontSize: 10 }}>{v.activeCount}</span>}
            </Link>
            {hovered === `view:${v.id}` && (
              <div className="flex items-center gap-1 mr-1.5 flex-shrink-0">
                <button onClick={(e) => openEditView(v, e)} className="focus:outline-none hover:opacity-70" style={{ color: "var(--text-muted)" }} title="Edytuj widok">
                  <Pencil size={10} />
                </button>
                <button onClick={(e) => handleDeleteView(v, e)} className="focus:outline-none hover:opacity-70" style={{ color: "var(--accent-red)" }} title="Usuń widok">
                  <Trash2 size={10} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {viewEditor && (
        <div className="mx-2 mt-1 mb-2 p-2 rounded" style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1 mb-2">
            <input
              value={viewEditor.emoji}
              onChange={(e) => setViewEditor((p) => p ? { ...p, emoji: e.target.value.slice(0, 2) } : p)}
              className="w-7 text-center bg-transparent text-sm focus:outline-none rounded"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              aria-label="Ikona widoku"
            />
            <input
              autoFocus
              value={viewEditor.name}
              onChange={(e) => setViewEditor((p) => p ? { ...p, name: e.target.value } : p)}
              onKeyDown={(e) => { if (e.key === "Enter") saveView(); if (e.key === "Escape") setViewEditor(null); }}
              placeholder={viewEditor.selected.length ? suggestedName(viewEditor.selected) : "Nazwa widoku…"}
              className="flex-1 bg-transparent text-xs focus:outline-none rounded px-1.5 py-1"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Projekty w widoku:</div>
          <div className="max-h-44 overflow-y-auto -mx-0.5">
            {selectableProjects.length === 0 && (
              <div className="text-xs px-1 py-1" style={{ color: "var(--text-muted)" }}>Brak projektów</div>
            )}
            {selectableProjects.map((p) => {
              const checked = viewEditor.selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleViewProject(p.id)}
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

          {viewError && <div className="text-xs mt-1.5" style={{ color: "var(--accent-red)" }}>{viewError}</div>}

          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={saveView}
              disabled={isPending}
              className="flex items-center gap-1 rounded text-xs px-2 py-1 focus:outline-none disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {viewEditor.mode === "edit" ? "Zapisz" : "Utwórz widok"}
            </button>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {viewEditor.selected.length} wybrane
            </span>
            <button
              onClick={() => { setViewEditor(null); setViewError(null); }}
              className="ml-auto focus:outline-none rounded p-1"
              style={{ color: "var(--text-muted)" }}
              title="Anuluj"
            >
              <X size={12} />
            </button>
          </div>
        </div>
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
