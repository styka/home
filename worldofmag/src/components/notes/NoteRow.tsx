"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { Trash2, Pin, PinOff, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { TagChip } from "./TagChip";
import { TagSuggestions } from "./TagSuggestions";
import { updateNote, deleteNote, toggleNotePin, setNoteTags } from "@/actions/notes";
import { createTag } from "@/actions/tags";
import type { Note, Tag, NoteGroup } from "@/types";

interface NoteRowProps {
  note: Note;
  allTags: Tag[];
  allGroups: NoteGroup[];
  isFocused: boolean;
  isEditing: boolean;
  onFocus: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onTagsChanged: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
}

const REWRITE_MODES = [
  { value: "correct", label: "Popraw błędy" },
  { value: "rewrite", label: "Przeredaguj" },
  { value: "to_markdown", label: "→ Markdown" },
] as const;

export function NoteRow({
  note, allTags, allGroups, isFocused, isEditing, onFocus, onStartEdit, onStopEdit, onTagsChanged, rowRef,
}: NoteRowProps) {
  const [, startTransition] = useTransition();
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);
  const [editGroupId, setEditGroupId] = useState(note.groupId ?? "");
  const [editTagIds, setEditTagIds] = useState(note.tags.map((nt) => nt.tag.id));
  const [editTagInput, setEditTagInput] = useState("");
  const [rewriteMode, setRewriteMode] = useState<"correct" | "rewrite" | "to_markdown">("correct");
  const [rewriting, setRewriting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditTitle(note.title);
      setEditContent(note.content);
      setEditGroupId(note.groupId ?? "");
      setEditTagIds(note.tags.map((nt) => nt.tag.id));
      setTimeout(() => titleRef.current?.focus(), 10);
    }
  }, [isEditing, note]);

  function handleSave() {
    if (!editTitle.trim()) { onStopEdit(); return; }
    startTransition(async () => {
      await updateNote(note.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        groupId: editGroupId || null,
      });
      await setNoteTags(note.id, editTagIds);
    });
    onStopEdit();
  }

  function handleDelete() {
    startTransition(() => { deleteNote(note.id); });
  }

  function handlePin() {
    startTransition(() => { toggleNotePin(note.id); });
  }

  async function handleRewrite() {
    if (!editContent.trim() && !editTitle.trim()) return;
    setRewriting(true);
    try {
      const res = await fetch("/api/llm/notes/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent || editTitle, mode: rewriteMode }),
      });
      const data = await res.json() as { result?: string };
      if (data.result) setEditContent(data.result);
    } finally {
      setRewriting(false);
    }
  }

  const editTagObjects = allTags.filter((t) => editTagIds.includes(t.id));
  const filteredTagOptions = allTags.filter(
    (t) => !editTagIds.includes(t.id) && t.name.toLowerCase().includes(editTagInput.toLowerCase())
  );

  const contentPreview = note.content.replace(/#+\s/g, "").replace(/[*_`]/g, "").slice(0, 120);

  if (isEditing) {
    return (
      <div
        ref={rowRef}
        className="flex flex-col gap-2 px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
      >
        <input
          ref={titleRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onStopEdit(); }}
          className="flex-1 bg-transparent text-sm font-semibold focus:outline-none"
          style={{ color: "var(--text-primary)" }}
          placeholder="Tytuł..."
        />
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={5}
          className="w-full bg-transparent text-xs focus:outline-none resize-none font-mono"
          style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
          placeholder="Treść notatki..."
        />

        {/* AI rewrite */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={rewriteMode}
            onChange={(e) => setRewriteMode(e.target.value as typeof rewriteMode)}
            className="bg-transparent text-xs border rounded px-1.5 py-0.5 focus:outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
          >
            {REWRITE_MODES.map((m) => (
              <option key={m.value} value={m.value}
                style={{ backgroundColor: "#1c1c1c", color: "var(--text-primary)" }}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleRewrite}
            disabled={rewriting}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-muted)" }}
          >
            {rewriting ? <Loader2 size={10} className="animate-spin" /> : "✨"}
            {rewriting ? "..." : "AI"}
          </button>
        </div>

        {/* Group + tags */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={editGroupId}
            onChange={(e) => setEditGroupId(e.target.value)}
            className="bg-transparent text-xs border rounded px-1.5 py-0.5 focus:outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
          >
            <option value="">Bez grupy</option>
            {allGroups.map((g) => (
              <option key={g.id} value={g.id}
                style={{ backgroundColor: "#1c1c1c", color: "var(--text-primary)" }}>
                {g.name}
              </option>
            ))}
          </select>

          {editTagObjects.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              onRemove={() => setEditTagIds((ids) => ids.filter((id) => id !== tag.id))}
            />
          ))}

          <div className="relative">
            <input
              value={editTagInput}
              onChange={(e) => setEditTagInput(e.target.value)}
              placeholder="+ tag"
              className="bg-transparent text-xs focus:outline-none w-16"
              style={{ color: "var(--text-muted)" }}
            />
            {editTagInput && filteredTagOptions.length > 0 && (
              <div
                className="absolute top-full left-0 z-10 rounded border shadow-lg py-1"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", minWidth: 120 }}
              >
                {filteredTagOptions.slice(0, 6).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => { setEditTagIds((ids) => [...ids, tag.id]); setEditTagInput(""); }}
                    className="block w-full text-left px-3 py-1 text-xs hover:bg-[var(--bg-hover)]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI tag suggestions */}
        <TagSuggestions
          noteId={note.id}
          noteContent={`${editTitle}\n${editContent}`}
          allTags={allTags}
          currentTagIds={editTagIds}
          onTagsChanged={() => {
            onTagsChanged();
          }}
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1 rounded font-medium"
            style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
          >
            Zapisz
          </button>
          <button
            onClick={onStopEdit}
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
          >
            Anuluj
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      onClick={onFocus}
      onDoubleClick={onStartEdit}
      className={cn("flex items-start gap-3 px-4 py-3 md:py-2.5 border-b cursor-default select-none group")}
      style={{
        borderColor: "var(--border)",
        backgroundColor: isFocused ? "var(--bg-elevated)" : undefined,
      }}
      onMouseEnter={(e) => { if (!isFocused) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
      onMouseLeave={(e) => { if (!isFocused) e.currentTarget.style.backgroundColor = ""; }}
    >
      {/* Pin indicator */}
      {note.pinned && (
        <span style={{ color: "var(--accent-amber)", flexShrink: 0 }} title="Przypięta">
          <Pin size={12} />
        </span>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm font-medium truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {note.title}
          </span>
          {note.isMarkdown && (
            <span className="text-[10px] px-1 rounded flex-shrink-0"
              style={{ backgroundColor: "rgba(139,92,246,0.2)", color: "#8b5cf6" }}>
              MD
            </span>
          )}
        </div>
        {contentPreview && (
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
            {contentPreview}
          </p>
        )}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {note.tags.map((nt) => (
              <TagChip key={nt.tag.id} tag={nt.tag} />
            ))}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {note.group && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {note.group.name}
          </span>
        )}
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {new Date(note.updatedAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "short" })}
        </span>
      </div>

      {/* Actions — visible on focus */}
      {isFocused && (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handlePin(); }}
            className="p-1 rounded focus:outline-none"
            style={{ color: note.pinned ? "var(--accent-amber)" : "var(--text-muted)" }}
            title={note.pinned ? "Odepnij" : "Przypnij"}
          >
            {note.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            className="p-1 rounded focus:outline-none"
            style={{ color: "var(--text-muted)" }}
            title="Edytuj (e)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9.5 2L12 4.5L5 11.5H2.5V9L9.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className="p-1 rounded focus:outline-none"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            title="Usuń (d)"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
