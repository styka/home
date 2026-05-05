"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus, Tag as TagIcon } from "lucide-react";
import { createTag, updateTag, deleteTag } from "@/actions/tags";
import { TagChip, TAG_COLOR_OPTIONS } from "./TagChip";
import type { Tag } from "@/types";

interface TagsManagerProps {
  tags: Tag[];
}

export function TagsManager({ tags }: TagsManagerProps) {
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(TAG_COLOR_OPTIONS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createTag({ name: newName.trim(), color: newColor });
      setNewName("");
      setCreating(false);
    });
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  function handleSave(id: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      await updateTag(id, { name: editName.trim(), color: editColor ?? undefined });
      setEditingId(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTag(id);
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Tagi
        </h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
        >
          <Plus size={13} />
          Nowy tag
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {creating && (
          <div
            className="flex flex-col gap-2 px-4 py-3 border-b"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Nazwa tagu..."
              className="bg-transparent text-sm focus:outline-none"
              style={{ color: "var(--text-primary)" }}
            />
            <div className="flex gap-1.5 flex-wrap">
              {TAG_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className="w-5 h-5 rounded-full border-2"
                  style={{
                    backgroundColor: c,
                    borderColor: newColor === c ? "#fff" : "transparent",
                  }}
                />
              ))}
            </div>
            {newName && (
              <TagChip tag={{ id: "", name: newName, color: newColor, createdAt: new Date() }} size="sm" />
            )}
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={!newName.trim()}
                className="text-xs px-3 py-1 rounded"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}>
                Utwórz
              </button>
              <button onClick={() => setCreating(false)}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                Anuluj
              </button>
            </div>
          </div>
        )}

        {tags.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <TagIcon size={32} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Brak tagów. Dodaj pierwszy lub pozwól AI je zaproponować.
            </p>
          </div>
        )}

        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center gap-3 px-4 py-3 border-b group"
            style={{ borderColor: "var(--border)" }}
          >
            {editingId === tag.id ? (
              <>
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(tag.id); if (e.key === "Escape") setEditingId(null); }}
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <div className="flex gap-1">
                  {TAG_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className="w-4 h-4 rounded-full border"
                      style={{
                        backgroundColor: c,
                        borderColor: editColor === c ? "#fff" : "transparent",
                      }}
                    />
                  ))}
                </div>
                <button onClick={() => handleSave(tag.id)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}>
                  OK
                </button>
                <button onClick={() => setEditingId(null)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                  ✕
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <TagChip tag={tag} size="sm" />
                </div>
                <button
                  onClick={() => startEdit(tag)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M9.5 2L12 4.5L5 11.5H2.5V9L9.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="p-1 rounded"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                  title="Usuń tag"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
