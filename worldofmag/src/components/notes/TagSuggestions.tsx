"use client";

import { useState } from "react";
import { Sparkles, Loader2, Plus, Check } from "lucide-react";
import { TagChip, getTagStyle } from "./TagChip";
import { createTag } from "@/actions/tags";
import { addTagToNote } from "@/actions/notes";
import type { Tag } from "@/types";

interface TagSuggestionsProps {
  noteId: string;
  noteContent: string;
  allTags: Tag[];
  currentTagIds: string[];
  onTagsChanged: () => void;
}

export function TagSuggestions({ noteId, noteContent, allTags, currentTagIds, onTagsChanged }: TagSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState<Tag[]>([]);
  const [newSuggested, setNewSuggested] = useState<string[]>([]);
  const [approvedNew, setApprovedNew] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  async function suggest() {
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch("/api/llm/notes/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `${noteContent}`,
          existingTags: allTags.map((t) => t.name),
        }),
      });
      const data = await res.json() as { suggested: string[]; new: string[] };
      setSuggested(allTags.filter((t) => data.suggested.includes(t.name)));
      setNewSuggested(data.new ?? []);
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  async function applyExisting(tag: Tag) {
    if (currentTagIds.includes(tag.id) || adding.has(tag.id)) return;
    setAdding((s) => new Set(s).add(tag.id));
    await addTagToNote(noteId, tag.id);
    onTagsChanged();
    setAdding((s) => { const n = new Set(s); n.delete(tag.id); return n; });
  }

  async function approveNew(name: string) {
    if (approvedNew.has(name)) return;
    setApprovedNew((s) => new Set(s).add(name));
    const tag = await createTag({ name });
    await addTagToNote(noteId, tag.id);
    onTagsChanged();
  }

  if (!done && !loading) {
    return (
      <button
        onClick={suggest}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
        style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-hover)" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
      >
        <Sparkles size={11} />
        Sugeruj tagi
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {loading && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={11} className="animate-spin" />
          Analizuję treść...
        </div>
      )}
      {done && suggested.length === 0 && newSuggested.length === 0 && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Brak sugestii</span>
      )}
      {done && (suggested.length > 0 || newSuggested.length > 0) && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs mr-1" style={{ color: "var(--text-muted)" }}>AI:</span>
          {suggested.map((tag) => {
            const already = currentTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => applyExisting(tag)}
                disabled={already || adding.has(tag.id)}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[11px] font-medium"
                style={{
                  backgroundColor: getTagStyle(tag.color).bg,
                  color: getTagStyle(tag.color).text,
                  opacity: already ? 0.5 : 1,
                  cursor: already ? "default" : "pointer",
                }}
              >
                {already ? <Check size={9} /> : <Plus size={9} />}
                #{tag.name}
              </button>
            );
          })}
          {newSuggested.map((name) => {
            const done = approvedNew.has(name);
            return (
              <button
                key={name}
                onClick={() => approveNew(name)}
                disabled={done}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[11px] font-medium border border-dashed"
                style={{
                  backgroundColor: "rgba(245,158,11,0.1)",
                  color: "var(--accent-amber)",
                  borderColor: "var(--accent-amber)",
                  opacity: done ? 0.5 : 1,
                  cursor: done ? "default" : "pointer",
                }}
              >
                {done ? <Check size={9} /> : <Plus size={9} />}
                #{name}
                <span className="text-[9px] opacity-60">nowy</span>
              </button>
            );
          })}
          <button
            onClick={suggest}
            className="text-[10px] px-1.5 rounded"
            style={{ color: "var(--text-muted)" }}
            title="Odśwież sugestie"
          >
            ↺
          </button>
        </div>
      )}
    </div>
  );
}
