"use client";

import { NoteRow } from "./NoteRow";
import type { Note, Tag, NoteGroup } from "@/types";

interface NoteListProps {
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

export function NoteList({
  notes, allTags, allGroups, focusedNoteId, editingNoteId,
  onNoteFocus, onNoteStartEdit, onNoteStopEdit, onTagsChanged, rowRefs,
}: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Brak notatek. Naciśnij <kbd className="font-mono px-1 rounded" style={{ backgroundColor: "var(--bg-elevated)" }}>a</kbd> aby dodać.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {notes.map((note) => (
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
