"use client";

import { NoteGroupSection } from "./NoteGroupSection";
import type { Note, Tag, NoteGroup } from "@/types";

// 042: etykieta notatek bez przypisanego folderu. Jest jednocześnie KLUCZEM grupowania
// i kluczem sortowania (ta sekcja ma zawsze lądować na końcu listy), więc musi być stałą —
// przy zmianie nazewnictwa „grupy" → „foldery" rozjechanie tych wystąpień po cichu zepsułoby
// kolejność sekcji, bez żadnego błędu kompilacji.
const UNGROUPED_LABEL = "Bez folderu";

interface NoteListProps {
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

export function NoteList({
  notes, allNotes, allTags, allGroups, focusedNoteId, editingNoteId,
  onNoteFocus, onNoteStartEdit, onNoteStopEdit, onNavigateToNote, onTagsChanged, rowRefs,
  searchQuery = "", viewMode = "list",
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

  const pinned = notes.filter((n) => n.pinned);
  const unpinned = notes.filter((n) => !n.pinned);

  const groupMap = new Map<string, { color: string | null | undefined; notes: Note[] }>();
  for (const note of unpinned) {
    const key = note.group?.name ?? UNGROUPED_LABEL;
    if (!groupMap.has(key)) {
      groupMap.set(key, { color: note.group?.color, notes: [] });
    }
    groupMap.get(key)!.notes.push(note);
  }

  const groupEntries = Array.from(groupMap.entries()).sort(([a], [b]) => {
    if (a === UNGROUPED_LABEL) return 1;
    if (b === UNGROUPED_LABEL) return -1;
    return a.localeCompare(b, "pl");
  });

  const sharedProps = {
    allNotes: allNotes ?? notes, allTags, allGroups, focusedNoteId, editingNoteId,
    onNoteFocus, onNoteStartEdit, onNoteStopEdit, onNavigateToNote, onTagsChanged, rowRefs,
    searchQuery, viewMode,
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
