"use client";

import { useState, useMemo, useCallback, useRef, useTransition, useEffect } from "react";
import { FileText, MessageCircle, X, Search, ChevronLeft, LayoutGrid, List, ArchiveRestore } from "lucide-react";
import Link from "next/link";
import { NoteList } from "./NoteList";
import { QuickNoteBar, type QuickNoteBarHandle } from "./QuickNoteBar";
import { NotesQA } from "./NotesQA";
import { TagChip } from "./TagChip";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useViewState } from "@/hooks/useViewState";
import { idList, oneOf, text, type RawParams } from "@/lib/viewState/viewState";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { ModuleView } from "@/components/ui/view";
import type { Note, Tag as TagType, NoteGroup, NoteFilter } from "@/types";
import { NOTE_FILTER_LABELS } from "@/types";

const NOTE_FILTERS: NoteFilter[] = ["ALL", "PINNED", "NO_GROUP", "SEARCH"];

interface NotesPageProps {
  notes: Note[];
  groups: NoteGroup[];
  tags: TagType[];
  backHref?: string;
  /**
   * 043: parametry adresu z serwera. Zastąpiły `useSearchParams` — hook wymusza granicę
   * `Suspense`, a wartość startową i tak trzeba mieć w PIERWSZYM renderze, żeby serwer i klient
   * wyrenderowały to samo (rozjazd hydratacji, `doświadczenia.md` 2026-08-02).
   */
  viewParams?: RawParams;
}

export function NotesPage({ notes, groups, tags, backHref, viewParams = {} }: NotesPageProps) {
  const param = (key: string): string | undefined => {
    const raw = viewParams[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const initialPinnedOnly = param("pinned") === "1";
  const focusFromQuery = param("focus") ?? null;
  const openNewFromQuery = param("new") === "1";

  // 043: filtr, folder, tagi i tryb widoku żyją w ADRESIE (AC-7).
  // Domyślną filtra jest „PINNED", gdy w adresie stoi `pinned=1` — a że ten parametr zostaje
  // w adresie, po odświeżeniu wyjdzie ta sama wartość. Zmiana na inną zakładkę dopisze `filter=…`,
  // który przy odczycie wygrywa.
  const viewSpec = useMemo(() => ({
    filter: oneOf(NOTE_FILTERS, initialPinnedOnly ? "PINNED" : "ALL"),
    group: text(""),
    tags: idList(),
    view: oneOf(["list", "grid"] as const, "list"),
  }), [initialPinnedOnly]);
  const [view, setView] = useViewState(viewSpec, viewParams);

  // Settery owinięte w `useCallback` — trafiają do zależności `useMemo` z obsługą skrótów.
  const activeFilter = view.filter;
  const setActiveFilter = useCallback((value: NoteFilter) => setView({ filter: value }), [setView]);
  const selectedGroupId = view.group;
  const setSelectedGroupId = useCallback((value: string) => setView({ group: value }), [setView]);
  const selectedTagIds = view.tags;
  const setSelectedTagIds = useCallback(
    (next: string[] | ((prev: string[]) => string[])) =>
      setView((prev) => ({ tags: typeof next === "function" ? next(prev.tags) : next })),
    [setView],
  );
  const viewMode = view.view;

  const [searchQuery, setSearchQuery] = useState("");
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(focusFromQuery);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isQAOpen, setIsQAOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Tryb widoku odtwarzany z pamięci przeglądarki TYLKO gdy adres go nie niesie — adres ma
  // pierwszeństwo, żeby zapisany ulubiony widok otwierał się dokładnie tak, jak go zapisano.
  useEffect(() => {
    if (viewParams.view !== undefined) return;
    try {
      const saved = localStorage.getItem("wom_notes_view");
      if (saved === "grid") setView({ view: "grid" }, { replace: true });
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleViewMode() {
    const next = viewMode === "list" ? "grid" : "list";
    setView({ view: next });
    try { localStorage.setItem("wom_notes_view", next); } catch { /* ignore */ }
  }
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
      // N2: ważony full-text — dopasowanie w tytule/tagu liczy się wyżej niż w treści.
      const scored = result
        .map((n) => {
          const title = n.title.toLowerCase();
          const inTag = n.tags.some((nt) => nt.tag.name.toLowerCase().includes(q));
          let score = 0;
          if (title === q) score = 100;
          else if (title.startsWith(q)) score = 80;
          else if (title.includes(q)) score = 60;
          else if (inTag) score = 40;
          else if (n.content.toLowerCase().includes(q)) score = 20;
          return { n, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      result = scored.map((x) => x.n);
    }

    return result;
  }, [notes, activeFilter, selectedGroupId, selectedTagIds, searchQuery]);

  const { rowRefs, navigateDown, navigateUp } = useItemNavigation(
    filteredNotes,
    focusedNoteId,
    setFocusedNoteId
  );

  // Handle deep-link from home page: open QuickNoteBar for new note, scroll to focused note
  useEffect(() => {
    if (openNewFromQuery) {
      setTimeout(() => quickNoteRef.current?.focus(), 50);
    }
    if (focusFromQuery) {
      setTimeout(() => {
        const el = rowRefs.current.get(focusFromQuery);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewFromQuery, focusFromQuery]);

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
        if (!confirm("Usunąć notatkę? Tej operacji nie można cofnąć.")) return;
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
    [focusedNoteId, filteredNotes, navigateDown, navigateUp, isSearchOpen, editingNoteId, startTransition, setActiveFilter]
  );

  useKeyboardShortcuts(handlers);

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((ids) =>
      ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]
    );
  }

  return (
    <ModuleView
      layout="fill"
      density="compact"
      state="ready"
      icon={<FileText size={16} />}
      iconColor="var(--accent-purple)"
      title="Notatki"
      href="/notes"
      breadcrumb={
        backHref ? (
          <Link href={backHref} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
            <ChevronLeft size={14} />
            Notatki
          </Link>
        ) : undefined
      }
      filters={
        <>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {filteredNotes.length} / {notes.length}
          </span>
          <button
            onClick={toggleViewMode}
            className="flex items-center justify-center p-1.5 rounded"
            style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-muted)" }}
            title={viewMode === "list" ? "Widok siatki" : "Widok listy"}
          >
            {viewMode === "list" ? <LayoutGrid size={13} /> : <List size={13} />}
          </button>
          {/* Kosz = link do /trash (ODZYSKIWANIE), NIE usuwanie — osobna ikona (ArchiveRestore),
              by nie mylić się z ikoną kosza „usuń" (Trash2). */}
          <Link
            href="/trash"
            className="flex items-center justify-center p-1.5 rounded"
            style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-muted)" }}
            title="Kosz — przywróć usunięte"
            aria-label="Kosz — przywróć usunięte notatki"
          >
            <ArchiveRestore size={13} />
          </Link>
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
        </>
      }
    >

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
          <option value="">Wszystkie foldery</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}
              style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}>
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
          allNotes={notes}
          allTags={tags}
          allGroups={groups}
          focusedNoteId={focusedNoteId}
          editingNoteId={editingNoteId}
          onNoteFocus={setFocusedNoteId}
          onNoteStartEdit={setEditingNoteId}
          onNoteStopEdit={() => setEditingNoteId(null)}
          onNavigateToNote={(id) => { setEditingNoteId(null); scrollToNote(id); }}
          onTagsChanged={() => {}}
          rowRefs={rowRefs}
          searchQuery={searchQuery}
          viewMode={viewMode}
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
    </ModuleView>
  );
}
