"use client";

import { useState, useTransition } from "react";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";
import { createTaskTag, updateTaskTag, deleteTaskTag } from "@/actions/taskTags";
import type { TaskTagDef } from "@/types";

const PRESET_COLORS = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981",
  "#8b5cf6", "#ec4899", "#06b6d4", "#6b7280",
];

interface TaskTagsManagerProps {
  initialTags: TaskTagDef[];
}

export function TaskTagsManager({ initialTags }: TaskTagsManagerProps) {
  const [tags, setTags] = useState<TaskTagDef[]>(initialTags);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const tag = await createTaskTag(newName.trim(), newColor);
      setTags((prev) => {
        const existing = prev.findIndex((t) => t.id === tag.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = tag;
          return next;
        }
        return [...prev, tag].sort((a, b) => a.name.localeCompare(b.name));
      });
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
      setIsAdding(false);
    });
  }

  function handleEdit(id: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      const tag = await updateTaskTag(id, { name: editName.trim(), color: editColor });
      setTags((prev) => prev.map((t) => t.id === id ? tag : t));
      setEditingId(null);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Usunąć tag? Zostanie usunięty ze wszystkich zadań.")) return;
    startTransition(async () => {
      await deleteTaskTag(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
    });
  }

  function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    return (
      <div className="flex items-center gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="w-5 h-5 rounded-full focus:outline-none flex-shrink-0"
            style={{
              backgroundColor: c,
              boxShadow: value === c ? `0 0 0 2px var(--bg-surface), 0 0 0 3px ${c}` : undefined,
            }}
            title={c}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          🏷️ Tagi zadań
        </h1>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded focus:outline-none"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
        >
          <Plus size={12} />
          Nowy tag
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Add form */}
        {isAdding && (
          <div
            className="mb-4 p-4 rounded-lg border"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
          >
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Nowy tag</p>
            <div className="flex items-center gap-2 mb-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setIsAdding(false); }}
                placeholder="Nazwa tagu…"
                className="flex-1 bg-transparent text-sm focus:outline-none border rounded px-3 py-1.5"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div className="mb-3">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Kolor</p>
              <ColorPicker value={newColor} onChange={setNewColor} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || isPending}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded focus:outline-none disabled:opacity-40"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              >
                <Check size={12} /> Dodaj
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewName(""); }}
                className="text-xs focus:outline-none"
                style={{ color: "var(--text-muted)" }}
              >
                Anuluj
              </button>
            </div>
          </div>
        )}

        {/* Tags list */}
        {tags.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: "var(--text-muted)" }}>
            <div className="text-4xl mb-3">🏷️</div>
            <p className="text-sm">Brak tagów. Stwórz pierwszy tag.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              >
                {editingId === tag.id ? (
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: editColor }}
                    />
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleEdit(tag.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                      style={{ color: "var(--text-primary)" }}
                    />
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <button
                      onClick={() => handleEdit(tag.id)}
                      className="focus:outline-none hover:opacity-70"
                      style={{ color: "var(--accent-green)" }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="focus:outline-none hover:opacity-70"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span
                      className="flex-1 text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {tag.name}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${tag.color}22`,
                        color: tag.color,
                        border: `1px solid ${tag.color}44`,
                      }}
                    >
                      podgląd
                    </span>
                    <button
                      onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); }}
                      className="focus:outline-none hover:opacity-70"
                      style={{ color: "var(--text-muted)" }}
                      title="Edytuj"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      className="focus:outline-none hover:opacity-70"
                      style={{ color: "var(--accent-red)" }}
                      title="Usuń"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
