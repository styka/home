"use client";

import { NoteGroupSection } from "./NoteGroupSection";
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
  searchQuery?: string;
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

  // Pinned notes in their own section, then group by NoteGroup
  const pinned = notes.filter((n) => n.pinned);
  const unpinned = notes.filter((n) => !n.pinned);

  // Group unpinned by group name
  const groupMap = new Map<string, { color: string | null | undefined; notes: Note[] }>();
  for (const note of unpinned) {
    const key = note.group?.name ?? "Bez grupy";
    if (!groupMap.has(key)) {
      groupMap.set(key, { color: note.group?.color, notes: [] });
    }
    groupMap.get(key)!.notes.push(note);
  }

  // Put "Bez grupy" last
  const groupEntries = Array.from(groupMap.entries()).sort(([a], [b]) => {
    if (a === "Bez grupy") return 1;
    if (b === "Bez grupy") return -1;
    return a.localeCompare(b, "pl");
  });

  const sharedProps = {
    allTags, allGroups, focusedNoteId, editingNoteId,
    onNoteFocus, onNoteStartEdit, onNoteStopEdit, onTagsChanged, rowRefs,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {pinned.length > 0 && (
        <NoteGroupSection
          groupName="Przypięte"
          notes={pinned}
          {...sharedProps}
        />
      )}
      {groupEntries.map(([groupName, { color, notes: groupNotes }]) => (
        <NoteGroupSection
          key={groupName}
          groupName={groupName}
          groupColor={color}
          notes={groupNotes}
          {...sharedProps}
        />
      ))}
    </div>
  );
}
