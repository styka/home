"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus, FolderOpen } from "lucide-react";
import { createNoteGroup, updateNoteGroup, deleteNoteGroup } from "@/actions/noteGroups";
import type { NoteGroup } from "@/types";

const GROUP_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

interface GroupsManagerProps {
  groups: NoteGroup[];
}

export function GroupsManager({ groups }: GroupsManagerProps) {
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(GROUP_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createNoteGroup({ name: newName.trim(), color: newColor });
      setNewName("");
      setCreating(false);
    });
  }

  function startEdit(group: NoteGroup) {
    setEditingId(group.id);
    setEditName(group.name);
    setEditColor(group.color);
  }

  function handleSave(id: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      await updateNoteGroup(id, { name: editName.trim(), color: editColor });
      setEditingId(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteNoteGroup(id);
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Grupy notatek
        </h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
        >
          <Plus size={13} />
          Nowa grupa
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
              placeholder="Nazwa grupy..."
              className="bg-transparent text-sm focus:outline-none"
              style={{ color: "var(--text-primary)" }}
            />
            <div className="flex gap-1.5 flex-wrap">
              {GROUP_COLORS.map((c) => (
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

        {groups.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <FolderOpen size={32} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Brak grup. Utwórz pierwszą.
            </p>
          </div>
        )}

        {groups.map((group) => (
          <div
            key={group.id}
            className="flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            {editingId === group.id ? (
              <>
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: editColor ?? "#808080" }}
                />
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(group.id); if (e.key === "Escape") setEditingId(null); }}
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <div className="flex gap-1">
                  {GROUP_COLORS.map((c) => (
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
                <button onClick={() => handleSave(group.id)}
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
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.color ?? "var(--text-muted)" }}
                />
                <span
                  className="flex-1 text-sm cursor-pointer"
                  style={{ color: "var(--text-primary)" }}
                  onDoubleClick={() => startEdit(group)}
                >
                  {group.name}
                </span>
                <button
                  onClick={() => startEdit(group)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100"
                  style={{ color: "var(--text-muted)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M9.5 2L12 4.5L5 11.5H2.5V9L9.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(group.id)}
                  className="p-1 rounded"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
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
