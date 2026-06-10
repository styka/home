"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Pin } from "lucide-react";
import { NoteRow } from "./NoteRow";
import { TagChip } from "./TagChip";
import type { Note, Tag, NoteGroup } from "@/types";

interface NoteGroupSectionProps {
  groupName: string;
  groupColor?: string | null;
  notes: Note[];
  allNotes?: Note[];
  allTags: Tag[];
  allGroups: NoteGroup[];
  focusedNoteId: string | null;
  editingNoteId: string | null;
  onNoteFocus: (id: string) => void;
  onNoteStartEdit: (id: string) => void;
  onNoteStopEdit: () => void;
  onNavigateToNote?: (id: string) => void;
  onTagsChanged: () => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  searchQuery?: string;
  viewMode?: "list" | "grid";
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: "rgba(251,191,36,0.35)", color: "inherit", borderRadius: 2 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function NoteGroupSection({
  groupName, groupColor, notes, allNotes, allTags, allGroups,
  focusedNoteId, editingNoteId, onNoteFocus, onNoteStartEdit, onNoteStopEdit, onNavigateToNote, onTagsChanged,
  rowRefs, searchQuery = "", viewMode = "list",
}: NoteGroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sharedNoteProps = (note: Note) => ({
    note,
    allNotes: allNotes ?? notes,
    allTags,
    allGroups,
    isFocused: focusedNoteId === note.id,
    isEditing: editingNoteId === note.id,
    onFocus: () => onNoteFocus(note.id),
    onStartEdit: () => onNoteStartEdit(note.id),
    onStopEdit: onNoteStopEdit,
    onNavigateToNote,
    onTagsChanged,
    rowRef: (el: HTMLDivElement | null) => {
      if (el) rowRefs.current.set(note.id, el);
      else rowRefs.current.delete(note.id);
    },
    searchQuery,
  });

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-left focus:outline-none"
        style={{ backgroundColor: "var(--bg-surface)" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-elevated)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; }}
      >
        {collapsed ? (
          <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />
        )}
        {groupColor && (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: groupColor }} />
        )}
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{groupName}</span>
        <span className="text-xs ml-1 px-1.5 rounded" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}>
          {notes.length}
        </span>
      </button>

      {!collapsed && viewMode === "list" && notes.map((note) => (
        <NoteRow key={note.id} {...sharedNoteProps(note)} />
      ))}

      {!collapsed && viewMode === "grid" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 10,
            padding: "8px 16px 12px",
          }}
        >
          {notes.map((note) => {
            const isFocused = focusedNoteId === note.id;
            const isEditing = editingNoteId === note.id;
            const contentPreview = note.content.replace(/#+\s/g, "").replace(/[*_`]/g, "").slice(0, 100);

            if (isEditing) {
              return (
                <div key={note.id} style={{ gridColumn: "1 / -1" }}>
                  <NoteRow {...sharedNoteProps(note)} />
                </div>
              );
            }

            return (
              <div
                key={note.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(note.id, el);
                  else rowRefs.current.delete(note.id);
                }}
                onClick={() => onNoteFocus(note.id)}
                onDoubleClick={() => onNoteStartEdit(note.id)}
                style={{
                  backgroundColor: isFocused ? "var(--bg-elevated)" : "var(--bg-surface)",
                  border: `1px solid ${isFocused ? "var(--accent-blue)" : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  cursor: "default",
                  userSelect: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: 80,
                  transition: "background 0.1s, border-color 0.1s",
                }}
                onMouseEnter={(e) => { if (!isFocused) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { if (!isFocused) e.currentTarget.style.backgroundColor = "var(--bg-surface)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {note.pinned && <Pin size={10} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {highlightMatch(note.title, searchQuery)}
                  </span>
                  {note.isMarkdown && (
                    <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, backgroundColor: "rgba(139,92,246,0.2)", color: "#8b5cf6", flexShrink: 0 }}>MD</span>
                  )}
                </div>
                {contentPreview && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
                    {highlightMatch(contentPreview, searchQuery)}
                  </p>
                )}
                {note.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                    {note.tags.slice(0, 3).map((nt) => (
                      <TagChip key={nt.tag.id} tag={nt.tag} size="xs" />
                    ))}
                    {note.tags.length > 3 && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{note.tags.length - 3}</span>
                    )}
                  </div>
                )}
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: "auto" }}>
                  {new Date(note.updatedAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "short" })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
