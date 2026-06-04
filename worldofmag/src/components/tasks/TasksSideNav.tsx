"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarClock, CalendarDays, AlertCircle, Inbox, Tag, Plus,
  Loader2, Pencil, Check, X, LayoutList, Trash2, CheckSquare, Square, Layers,
} from "lucide-react";
import { getTaskProjects, createTaskProject, updateTaskProject, deleteTaskProject } from "@/actions/taskProjects";
import type { TaskProject } from "@/types";

const VIRTUAL_VIEWS = [
  { id: "today", label: "Dziś", Icon: CalendarClock },
  { id: "upcoming", label: "Nadchodzące", Icon: CalendarDays },
  { id: "overdue", label: "Zaległe", Icon: AlertCircle },
  { id: "all", label: "Wszystkie", Icon: LayoutList },
] as const;

export function TasksSideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Tryb „Wiele projektów”: zaznaczanie kilku projektów do wspólnego widoku.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function showMultiView() {
    if (selectedIds.length === 0) return;
    router.push(`/tasks/multi?projects=${selectedIds.join(",")}`);
    setSelectMode(false);
    setSelectedIds([]);
  }

  function reload() {
    getTaskProjects().then(setProjects).catch(() => {});
  }

  useEffect(() => { reload(); }, []);

  const inbox = projects.find((p) => p.isInbox);
  const regularProjects = projects.filter((p) => !p.isInbox);

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
        selectMode ? (
          <button
            onClick={() => toggleSelected(inbox.id)}
            className="flex items-center gap-2 mx-2 rounded text-xs w-[calc(100%-16px)]"
            style={{ ...itemStyle(inbox.id), color: "var(--text-secondary)" }}
          >
            {selectedIds.includes(inbox.id)
              ? <CheckSquare size={12} style={{ color: "var(--accent-blue)" }} />
              : <Square size={12} />}
            <Inbox size={12} />
            <span className="flex-1 text-left">Skrzynka</span>
            {(inbox._count?.tasks ?? 0) > 0 && (
              <span style={{ fontSize: 10 }}>{inbox._count!.tasks}</span>
            )}
          </button>
        ) : (
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
        )
      )}

      {regularProjects.map((p) => (
        selectMode ? (
          <button
            key={p.id}
            onClick={() => toggleSelected(p.id)}
            className="flex items-center gap-2 mx-2 rounded text-xs w-[calc(100%-16px)] py-1"
            style={{ paddingLeft: 40, paddingRight: 8, color: "var(--text-secondary)" }}
          >
            {selectedIds.includes(p.id)
              ? <CheckSquare size={12} style={{ color: "var(--accent-blue)" }} />
              : <Square size={12} />}
            <span>{p.emoji}</span>
            <span className="flex-1 truncate text-left">{p.name}</span>
            {(p._count?.tasks ?? 0) > 0 && (
              <span style={{ fontSize: 10 }}>{p._count!.tasks}</span>
            )}
          </button>
        ) : (
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
        )
      ))}

      {/* Tryb „Wiele projektów” — zaznacz kilka projektów i pokaż je w jednym widoku */}
      {regularProjects.length > 0 && (
        selectMode ? (
          <div className="mx-2 mt-1 flex items-center gap-1">
            <button
              onClick={showMultiView}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-1.5 flex-1 rounded text-xs py-1.5 justify-center focus:outline-none disabled:opacity-40"
              style={{ paddingLeft: 8, backgroundColor: "var(--accent-blue)", color: "#fff" }}
            >
              <Layers size={12} />
              Pokaż wybrane ({selectedIds.length})
            </button>
            <button
              onClick={() => { setSelectMode(false); setSelectedIds([]); }}
              className="focus:outline-none rounded p-1.5"
              style={{ color: "var(--text-muted)" }}
              title="Anuluj"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSelectMode(true)}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "var(--text-muted)"; }}
            className="flex items-center gap-2 mx-2 rounded text-xs w-[calc(100%-16px)]"
            style={{ paddingLeft: 40, paddingTop: 5, paddingBottom: 5, color: "var(--text-muted)" }}
          >
            <Layers size={11} />
            Wiele projektów
          </button>
        )
      )}

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
