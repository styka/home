"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NoteRow } from "./NoteRow";
import type { Note, Tag, NoteGroup } from "@/types";

interface NoteGroupSectionProps {
  groupName: string;
  groupColor?: string | null;
  notes: Note[];
  allTags: Tag[];
  allGroups: NoteGroup[];
  focusedNoteId: string | null;
  editingNoteId: string | null;
  onNoteFocus: (id: string) => void;
  onNoteStartEdit: (id: string) => void;
  onNoteStopEdit: () => void;
  onTagsChanged: () => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

export function NoteGroupSection({
  groupName, groupColor, notes, allTags, allGroups,
  focusedNoteId, editingNoteId, onNoteFocus, onNoteStartEdit, onNoteStopEdit, onTagsChanged, rowRefs,
}: NoteGroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

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
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: groupColor }}
          />
        )}
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {groupName}
        </span>
        <span
          className="text-xs ml-1 px-1.5 rounded"
          style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
        >
          {notes.length}
        </span>
      </button>

      {!collapsed && notes.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          allTags={allTags}
          allGroups={allGroups}
          isFocused={focusedNoteId === note.id}
          isEditing={editingNoteId === note.id}
          onFocus={() => onNoteFocus(note.id)}
          onStartEdit={() => onNoteStartEdit(note.id)}
          onStopEdit={onNoteStopEdit}
          onTagsChanged={onTagsChanged}
          rowRef={(el) => {
            if (el) rowRefs.current.set(note.id, el);
            else rowRefs.current.delete(note.id);
          }}
        />
      ))}
    </div>
  );
}
