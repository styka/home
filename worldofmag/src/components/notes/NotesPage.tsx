"use client";

import { useState, useCallback, useMemo, useRef, useTransition } from "react";
import { MessageCircle, X, Search } from "lucide-react";
import { NoteList } from "./NoteList";
import { QuickNoteBar, type QuickNoteBarHandle } from "./QuickNoteBar";
import { NotesQA } from "./NotesQA";
import { TagChip } from "./TagChip";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import type { Note, Tag, NoteGroup, NoteFilter } from "@/types";
import { NOTE_FILTER_LABELS } from "@/types";

const NOTE_FILTERS: NoteFilter[] = ["ALL", "PINNED", "NO_GROUP", "SEARCH"];

interface NotesPageProps {
  notes: Note[];
  groups: NoteGroup[];
  tags: Tag[];
}

export function NotesPage({ notes, groups, tags }: NotesPageProps) {
  const [activeFilter, setActiveFilter] = useState<NoteFilter>("ALL");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isQAOpen, setIsQAOpen] = useState(false);
  const [, startTransition] = useTransition();
  const quickNoteRef = useRef<QuickNoteBarHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isSearchOpen = activeFilter === "SEARCH";

  const filteredNotes = useMemo(() => {
    let result = notes;

    if (activeFilter === "PINNED") result = result.filter((n) => n.pinned);
    if (activeFilter === "NO_GROUP") result = result.filter((n) => !n.groupId);

    if (selectedGroupId) result = result.filter((n) => n.groupId === selectedGroupId);

    if (selectedTagIds.length > 0) {
      result = result.filter((n) =>
        selectedTagIds.every((tid) => n.tags.some((nt) => nt.tag.id === tid))
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((nt) => nt.tag.name.includes(q))
      );
    }

    return result;
  }, [notes, activeFilter, selectedGroupId, selectedTagIds, searchQuery]);

  const { rowRefs, navigateDown, navigateUp } = useItemNavigation(
    filteredNotes,
    focusedNoteId,
    setFocusedNoteId
  );

  function scrollToNote(noteId: string) {
    const el = rowRefs.current.get(noteId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedNoteId(noteId);
  }

  const handlers = useMemo(
    () => ({
      onQuickAdd: () => quickNoteRef.current?.focus(),
      onNavigateDown: navigateDown,
      onNavigateUp: navigateUp,
      onToggleStatus: () => {},
      onDelete: () => {
        if (!focusedNoteId) return;
        const idx = filteredNotes.findIndex((n) => n.id === focusedNoteId);
        const next = filteredNotes[idx + 1] ?? filteredNotes[idx - 1];
        setFocusedNoteId(next?.id ?? null);
        startTransition(() => {
          import("@/actions/notes").then(({ deleteNote }) => deleteNote(focusedNoteId));
        });
      },
      onEdit: () => {
        if (!focusedNoteId) return;
        setEditingNoteId(focusedNoteId);
      },
      onSearch: () => {
        setActiveFilter("SEARCH");
        setTimeout(() => searchInputRef.current?.focus(), 10);
      },
      onFilterTab: (index: number) => setActiveFilter(NOTE_FILTERS[index] ?? "ALL"),
      onCommandPalette: () => {},
      onEscape: () => {
        if (isSearchOpen) { setSearchQuery(""); setActiveFilter("ALL"); return; }
        if (editingNoteId) { setEditingNoteId(null); return; }
        setFocusedNoteId(null);
      },
    }),
    [focusedNoteId, filteredNotes, navigateDown, navigateUp, isSearchOpen, editingNoteId, startTransition]
  );

  useKeyboardShortcuts(handlers);

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((ids) =>
      ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Notatki
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {filteredNotes.length} / {notes.length}
          </span>
          <button
            onClick={() => setIsQAOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
            style={{
              backgroundColor: isQAOpen ? "var(--accent-blue)" : "var(--bg-hover)",
              color: isQAOpen ? "#fff" : "var(--text-muted)",
            }}
            title="Pytaj notatki (AI)"
          >
            <MessageCircle size={13} />
            <span className="hidden sm:inline">Pytaj AI</span>
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-1 px-4 border-b overflow-x-auto flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", minHeight: 40 }}
      >
        {NOTE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setActiveFilter(f);
              if (f === "SEARCH") setTimeout(() => searchInputRef.current?.focus(), 10);
            }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs rounded-t-sm font-medium"
            style={{
              color: activeFilter === f ? "var(--accent-blue)" : "var(--text-muted)",
              borderBottom: activeFilter === f ? "2px solid var(--accent-blue)" : "2px solid transparent",
            }}
          >
            {f === "SEARCH" && <Search size={10} />}
            {NOTE_FILTER_LABELS[f]}
          </button>
        ))}

        <div className="w-px h-4 mx-1 flex-shrink-0" style={{ backgroundColor: "var(--border)" }} />

        {/* Group filter */}
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="bg-transparent text-xs focus:outline-none flex-shrink-0"
          style={{ color: selectedGroupId ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          <option value="">Wszystkie grupy</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}
              style={{ backgroundColor: "#1c1c1c", color: "var(--text-primary)" }}>
              {g.name}
            </option>
          ))}
        </select>

        {/* Active tag filters */}
        {selectedTagIds.length > 0 && (
          <>
            <div className="w-px h-4 mx-1 flex-shrink-0" style={{ backgroundColor: "var(--border)" }} />
            {selectedTagIds.map((tid) => {
              const tag = tags.find((t) => t.id === tid);
              if (!tag) return null;
              return (
                <TagChip
                  key={tid}
                  tag={tag}
                  size="xs"
                  onRemove={() => toggleTagFilter(tid)}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Search bar (shown when SEARCH filter active) */}
      {isSearchOpen && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setSearchQuery(""); setActiveFilter("ALL"); }
            }}
            placeholder="Szukaj w notatkach..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ color: "var(--text-muted)" }}>
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Tags filter row */}
      {tags.length > 0 && (
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 border-b overflow-x-auto flex-shrink-0"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              size="xs"
              active={selectedTagIds.includes(tag.id) ? true : selectedTagIds.length === 0 ? undefined : false}
              onClick={() => toggleTagFilter(tag.id)}
            />
          ))}
        </div>
      )}

      {/* Main scrollable area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <QuickNoteBar ref={quickNoteRef} groups={groups} allTags={tags} />

        <NoteList
          notes={filteredNotes}
          allTags={tags}
          allGroups={groups}
          focusedNoteId={focusedNoteId}
          editingNoteId={editingNoteId}
          onNoteFocus={setFocusedNoteId}
          onNoteStartEdit={setEditingNoteId}
          onNoteStopEdit={() => setEditingNoteId(null)}
          onTagsChanged={() => {}}
          rowRefs={rowRefs}
          searchQuery={searchQuery}
        />

        {/* Q&A panel */}
        {isQAOpen && (
          <NotesQA
            allNotes={notes}
            filteredNotes={filteredNotes}
            onScrollToNote={scrollToNote}
          />
        )}
      </div>
    </div>
  );
}
