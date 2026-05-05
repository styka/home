"use client";

import { useRef, useState, forwardRef, useImperativeHandle, useTransition } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { createNote } from "@/actions/notes";
import { createTag } from "@/actions/tags";
import { TagChip } from "./TagChip";
import type { Tag, NoteGroup } from "@/types";

export interface QuickNoteBarHandle {
  focus: () => void;
}

interface QuickNoteBarProps {
  groups: NoteGroup[];
  allTags: Tag[];
}

export const QuickNoteBar = forwardRef<QuickNoteBarHandle, QuickNoteBarProps>(
  function QuickNoteBar({ groups, allTags }, ref) {
    const titleRef = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [groupId, setGroupId] = useState<string>("");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [suggestedTags, setSuggestedTags] = useState<{ existing: Tag[]; newNames: string[] } | null>(null);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [, startTransition] = useTransition();

    useImperativeHandle(ref, () => ({ focus: () => titleRef.current?.focus() }));

    function reset() {
      setTitle("");
      setContent("");
      setGroupId("");
      setSelectedTagIds([]);
      setTagInput("");
      setSuggestedTags(null);
      setExpanded(false);
    }

    async function handleSubmit() {
      if (!title.trim()) return;
      startTransition(async () => {
        await createNote({
          title: title.trim(),
          content: content.trim(),
          groupId: groupId || null,
          tagIds: selectedTagIds,
        });
        reset();
        titleRef.current?.focus();
      });
    }

    async function suggestTags() {
      if (!title && !content) return;
      setSuggestLoading(true);
      try {
        const res = await fetch("/api/llm/notes/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `${title}\n${content}`,
            existingTags: allTags.map((t) => t.name),
          }),
        });
        const data = await res.json() as { suggested: string[]; new: string[] };
        setSuggestedTags({
          existing: allTags.filter((t) => data.suggested.includes(t.name)),
          newNames: data.new ?? [],
        });
      } finally {
        setSuggestLoading(false);
      }
    }

    async function approveNewTag(name: string) {
      const tag = await createTag({ name });
      setSelectedTagIds((ids) => [...ids, tag.id]);
      setSuggestedTags((s) => s ? { ...s, newNames: s.newNames.filter((n) => n !== name) } : s);
    }

    function addExistingTag(tag: Tag) {
      if (!selectedTagIds.includes(tag.id)) {
        setSelectedTagIds((ids) => [...ids, tag.id]);
      }
    }

    const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));

    const filteredTagOptions = allTags.filter(
      (t) => !selectedTagIds.includes(t.id) &&
        t.name.toLowerCase().includes(tagInput.toLowerCase())
    );

    return (
      <div
        className="border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        {/* Title row */}
        <div className="flex items-center gap-2 px-4 py-2">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); if (!expanded) setExpanded(true); else handleSubmit(); }
              if (e.key === "Escape") { reset(); titleRef.current?.blur(); }
            }}
            onFocus={() => setExpanded(true)}
            placeholder="Nowa notatka... (Enter aby rozwinąć)"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded"
            style={{ color: "var(--text-muted)" }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expanded form */}
        {expanded && (
          <div className="px-4 pb-3 space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Treść notatki..."
              rows={3}
              className="w-full bg-transparent text-sm focus:outline-none resize-none"
              style={{ color: "var(--text-primary)" }}
            />

            {/* Group + tags row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Group picker */}
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="bg-transparent text-xs focus:outline-none rounded px-2 py-1 border"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  backgroundColor: "var(--bg-elevated)",
                }}
              >
                <option value="">Bez grupy</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}
                    style={{ backgroundColor: "#1c1c1c", color: "var(--text-primary)" }}>
                    {g.name}
                  </option>
                ))}
              </select>

              {/* Selected tags */}
              {selectedTags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  onRemove={() => setSelectedTagIds((ids) => ids.filter((id) => id !== tag.id))}
                />
              ))}

              {/* Tag input */}
              <div className="relative">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="+ tag"
                  className="bg-transparent text-xs focus:outline-none w-16"
                  style={{ color: "var(--text-muted)" }}
                />
                {tagInput && filteredTagOptions.length > 0 && (
                  <div
                    className="absolute top-full left-0 z-10 rounded border shadow-lg py-1"
                    style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", minWidth: 120 }}
                  >
                    {filteredTagOptions.slice(0, 6).map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => { addExistingTag(tag); setTagInput(""); }}
                        className="block w-full text-left px-3 py-1 text-xs hover:bg-[var(--bg-hover)]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        #{tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* AI suggest */}
              <button
                onClick={suggestTags}
                disabled={suggestLoading}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-hover)" }}
              >
                <Sparkles size={10} />
                {suggestLoading ? "..." : "AI tagi"}
              </button>
            </div>

            {/* AI tag suggestions */}
            {suggestedTags && (
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Sugestie:</span>
                {suggestedTags.existing.map((tag) => {
                  const already = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => addExistingTag(tag)}
                      disabled={already}
                      className="text-[11px] px-1.5 rounded-full font-medium"
                      style={{
                        backgroundColor: "rgba(59,130,246,0.15)",
                        color: "#3b82f6",
                        opacity: already ? 0.4 : 1,
                      }}
                    >
                      #{tag.name}
                    </button>
                  );
                })}
                {suggestedTags.newNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => approveNewTag(name)}
                    className="text-[11px] px-1.5 rounded-full font-medium border border-dashed"
                    style={{
                      backgroundColor: "rgba(245,158,11,0.1)",
                      color: "var(--accent-amber)",
                      borderColor: "var(--accent-amber)",
                    }}
                  >
                    +#{name}
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={!title.trim()}
                className="text-xs px-3 py-1 rounded font-medium"
                style={{
                  backgroundColor: title.trim() ? "var(--accent-blue)" : "var(--bg-hover)",
                  color: title.trim() ? "#fff" : "var(--text-muted)",
                }}
              >
                Dodaj notatkę
              </button>
              <button
                onClick={reset}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-hover)" }}
              >
                Anuluj
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);
