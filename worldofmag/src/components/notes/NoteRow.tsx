"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { Trash2, Pin, PinOff, Loader2, Mic, MicOff } from "lucide-react";
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
  searchQuery?: string;
}

const REWRITE_MODES = [
  { value: "correct", label: "Popraw błędy" },
  { value: "rewrite", label: "Przeredaguj" },
  { value: "to_markdown", label: "→ Markdown" },
] as const;

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

export function NoteRow({
  note, allTags, allGroups, isFocused, isEditing, onFocus, onStartEdit, onStopEdit, onTagsChanged, rowRef, searchQuery = "",
}: NoteRowProps) {
  const [, startTransition] = useTransition();
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);
  const [editGroupId, setEditGroupId] = useState(note.groupId ?? "");
  const [editTagIds, setEditTagIds] = useState(note.tags.map((nt) => nt.tag.id));
  const [editTagInput, setEditTagInput] = useState("");
  const [rewriteMode, setRewriteMode] = useState<"correct" | "rewrite" | "to_markdown">("correct");
  const [rewriting, setRewriting] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceEditing, setIsVoiceEditing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Auto-suggest debounce
  const [autoSuggesting, setAutoSuggesting] = useState(false);
  const [suggestedGroupName, setSuggestedGroupName] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditTitle(note.title);
      setEditContent(note.content);
      setEditGroupId(note.groupId ?? "");
      setEditTagIds(note.tags.map((nt) => nt.tag.id));
      setPreviousContent(null);
      setSuggestedGroupName(null);
      setTimeout(() => titleRef.current?.focus(), 10);
    }
  }, [isEditing, note]);

  // Debounced auto-tagging when title/content changes in edit mode
  useEffect(() => {
    if (!isEditing) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!editTitle.trim() && !editContent.trim()) return;
      autoSuggestGroup();
    }, 1500);
    return () => clearTimeout(debounceRef.current);
  }, [editTitle, editContent, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function autoSuggestGroup() {
    if (!process.env.NEXT_PUBLIC_GROQ_ENABLED && allGroups.length === 0) return;
    setAutoSuggesting(true);
    try {
      const res = await fetch("/api/llm/notes/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `${editTitle}\n${editContent}`,
          existingTags: allTags.map((t) => t.name),
          existingGroups: allGroups.map((g) => g.name),
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as { suggestedGroup?: string | null };
      if (data.suggestedGroup && !editGroupId) {
        const matchedGroup = allGroups.find((g) => g.name === data.suggestedGroup);
        if (matchedGroup) {
          setSuggestedGroupName(data.suggestedGroup);
        }
      }
    } finally {
      setAutoSuggesting(false);
    }
  }

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
    setPreviousContent(editContent);
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

  function startVoiceInput() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "pl-PL";
    rec.continuous = false;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setEditContent((prev) => prev ? prev + " " + transcript : transcript);
    };
    rec.onend = () => setIsRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }

  function stopVoiceInput() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  async function startVoiceEdit() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setIsVoiceEditing(true);
    const rec = new SR();
    rec.lang = "pl-PL";
    rec.continuous = false;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = async (e: any) => {
      const instruction = e.results[0][0].transcript;
      setIsVoiceEditing(false);
      setPreviousContent(editContent);
      setRewriting(true);
      try {
        const res = await fetch("/api/llm/notes/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent || editTitle, mode: "voice_edit", instruction }),
        });
        const data = await res.json() as { result?: string };
        if (data.result) setEditContent(data.result);
      } finally {
        setRewriting(false);
      }
    };
    rec.onend = () => setIsVoiceEditing(false);
    rec.start();
  }

  const editTagObjects = allTags.filter((t) => editTagIds.includes(t.id));
  const filteredTagOptions = allTags.filter(
    (t) => !editTagIds.includes(t.id) && t.name.toLowerCase().includes(editTagInput.toLowerCase())
  );
  const availableTagChips = allTags.filter((t) => !editTagIds.includes(t.id)).slice(0, 12);

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

        {/* Content + voice input */}
        <div className="relative">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={5}
            className="w-full bg-transparent text-xs focus:outline-none resize-none font-mono pr-8"
            style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
            placeholder="Treść notatki..."
          />
          <button
            onClick={isRecording ? stopVoiceInput : startVoiceInput}
            className="absolute top-1 right-1 p-1 rounded"
            style={{ color: isRecording ? "#ef4444" : "var(--text-muted)" }}
            title={isRecording ? "Zatrzymaj nagrywanie" : "Dyktuj treść (pl)"}
          >
            {isRecording ? (
              <MicOff size={12} className="animate-pulse" />
            ) : (
              <Mic size={12} />
            )}
          </button>
        </div>

        {/* AI rewrite + voice edit */}
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
          <button
            onClick={startVoiceEdit}
            disabled={rewriting || isVoiceEditing}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "var(--bg-hover)", color: isVoiceEditing ? "#ef4444" : "var(--text-muted)" }}
            title="Powiedz co zmienić"
          >
            <Mic size={10} className={isVoiceEditing ? "animate-pulse" : ""} />
            {isVoiceEditing ? "Słucham..." : "Powiedz co zmienić"}
          </button>
          {previousContent !== null && (
            <button
              onClick={() => { setEditContent(previousContent); setPreviousContent(null); }}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: "var(--accent-amber)", backgroundColor: "rgba(245,158,11,0.1)" }}
            >
              ↩ Przywróć
            </button>
          )}
        </div>

        {/* Group picker */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={editGroupId}
            onChange={(e) => { setEditGroupId(e.target.value); setSuggestedGroupName(null); }}
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
          {autoSuggesting && (
            <Loader2 size={10} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          )}
          {suggestedGroupName && !editGroupId && (
            <button
              onClick={() => {
                const g = allGroups.find((g) => g.name === suggestedGroupName);
                if (g) { setEditGroupId(g.id); setSuggestedGroupName(null); }
              }}
              className="text-xs px-1.5 py-0.5 rounded border border-dashed"
              style={{ color: "var(--accent-blue)", borderColor: "var(--accent-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}
            >
              ✨ {suggestedGroupName}
            </button>
          )}
        </div>

        {/* Tag picker */}
        <div className="flex flex-wrap items-center gap-1.5">
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

        {/* Inline available tags */}
        {!editTagInput && availableTagChips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {availableTagChips.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setEditTagIds((ids) => [...ids, tag.id])}
                className="text-[10px] px-1.5 py-0 rounded-full opacity-40 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        )}

        {/* AI tag suggestions */}
        <TagSuggestions
          noteId={note.id}
          noteContent={`${editTitle}\n${editContent}`}
          allTags={allTags}
          currentTagIds={editTagIds}
          onTagsChanged={onTagsChanged}
        />

        {/* Save / Cancel */}
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
      className={cn("flex items-start gap-3 px-4 py-3 md:py-2.5 border-b cursor-default select-none")}
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
          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {highlightMatch(note.title, searchQuery)}
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
            {highlightMatch(contentPreview, searchQuery)}
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

      {/* Right column: actions (if focused) + meta */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {isFocused && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); handlePin(); }}
              className="p-1 rounded focus:outline-none"
              style={{ color: note.pinned ? "var(--accent-amber)" : "var(--text-muted)" }}
              title={note.pinned ? "Odepnij" : "Przypnij"}
            >
              {note.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
              className="p-1 rounded focus:outline-none"
              style={{ color: "var(--text-muted)" }}
              title="Edytuj (e)"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M9.5 2L12 4.5L5 11.5H2.5V9L9.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              className="p-1 rounded focus:outline-none"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
              title="Usuń (d)"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
        {note.group && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {note.group.name}
          </span>
        )}
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {new Date(note.updatedAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "short" })}
        </span>
      </div>
    </div>
  );
}
