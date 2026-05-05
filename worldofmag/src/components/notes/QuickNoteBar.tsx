"use client";

import { useRef, useState, useEffect, forwardRef, useImperativeHandle, useTransition } from "react";
import { ChevronDown, ChevronUp, Sparkles, Mic, MicOff, Loader2 } from "lucide-react";
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
    const [suggestedTags, setSuggestedTags] = useState<{ existing: Tag[]; newNames: string[]; suggestedGroup?: string | null } | null>(null);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [titleAiSuggested, setTitleAiSuggested] = useState(false);
    const [titleLoading, setTitleLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [, startTransition] = useTransition();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);
    const tagDebounceRef = useRef<ReturnType<typeof setTimeout>>();
    const titleDebounceRef = useRef<ReturnType<typeof setTimeout>>();

    useImperativeHandle(ref, () => ({ focus: () => titleRef.current?.focus() }));

    // Auto-suggest tags when title or content changes (debounce 1500ms)
    useEffect(() => {
      if (!expanded) return;
      clearTimeout(tagDebounceRef.current);
      tagDebounceRef.current = setTimeout(() => {
        if (title.trim() || content.trim()) suggestTagsAuto();
      }, 1500);
      return () => clearTimeout(tagDebounceRef.current);
    }, [title, content, expanded]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-generate title from content (debounce 1500ms, only when title empty)
    useEffect(() => {
      if (!expanded || title) return;
      clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = setTimeout(() => {
        if (content.trim().length > 20) suggestTitle();
      }, 1500);
      return () => clearTimeout(titleDebounceRef.current);
    }, [content, expanded, title]); // eslint-disable-line react-hooks/exhaustive-deps

    function reset() {
      setTitle("");
      setContent("");
      setGroupId("");
      setSelectedTagIds([]);
      setTagInput("");
      setSuggestedTags(null);
      setExpanded(false);
      setTitleAiSuggested(false);
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

    async function suggestTagsAuto() {
      setSuggestLoading(true);
      try {
        const res = await fetch("/api/llm/notes/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `${title}\n${content}`,
            existingTags: allTags.map((t) => t.name),
            existingGroups: groups.map((g) => g.name),
          }),
        });
        if (!res.ok) return;
        const data = await res.json() as { suggested?: string[]; new?: string[]; suggestedGroup?: string | null };
        setSuggestedTags({
          existing: allTags.filter((t) => (data.suggested ?? []).includes(t.name)),
          newNames: data.new ?? [],
          suggestedGroup: data.suggestedGroup ?? null,
        });
      } finally {
        setSuggestLoading(false);
      }
    }

    async function suggestTitle() {
      setTitleLoading(true);
      try {
        const res = await fetch("/api/llm/notes/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) return;
        const data = await res.json() as { title?: string };
        if (data.title && !title) {
          setTitle(data.title);
          setTitleAiSuggested(true);
        }
      } finally {
        setTitleLoading(false);
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

    function applySuggestedGroup() {
      if (!suggestedTags?.suggestedGroup) return;
      const g = groups.find((g) => g.name === suggestedTags.suggestedGroup);
      if (g) { setGroupId(g.id); setSuggestedTags((s) => s ? { ...s, suggestedGroup: null } : s); }
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
        setContent((prev) => prev ? prev + " " + transcript : transcript);
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

    const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));
    const filteredTagOptions = allTags.filter(
      (t) => !selectedTagIds.includes(t.id) && t.name.toLowerCase().includes(tagInput.toLowerCase())
    );
    const availableTagChips = allTags.filter((t) => !selectedTagIds.includes(t.id)).slice(0, 12);

    return (
      <div
        className="border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        {/* Title row */}
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleAiSuggested(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); if (!expanded) setExpanded(true); else handleSubmit(); }
                if (e.key === "Escape") { reset(); titleRef.current?.blur(); }
              }}
              onFocus={() => setExpanded(true)}
              placeholder="Nowa notatka... (Enter aby rozwinąć)"
              className="flex-1 bg-transparent text-sm focus:outline-none min-w-0"
              style={{ color: "var(--text-primary)" }}
            />
            {titleLoading && <Loader2 size={11} className="animate-spin flex-shrink-0" style={{ color: "var(--text-muted)" }} />}
            {titleAiSuggested && !titleLoading && (
              <span className="text-[10px] px-1 rounded flex-shrink-0"
                style={{ backgroundColor: "rgba(139,92,246,0.2)", color: "#8b5cf6" }}>
                ✨ AI
              </span>
            )}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded flex-shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expanded form */}
        {expanded && (
          <div className="px-4 pb-3 space-y-2">
            {/* Content */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Treść notatki..."
              rows={3}
              className="w-full bg-transparent text-sm focus:outline-none resize-none"
              style={{ color: "var(--text-primary)" }}
            />

            {/* Voice input button — inline, not absolute */}
            <div className="flex items-center gap-2">
              <button
                onClick={isRecording ? stopVoiceInput : startVoiceInput}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: isRecording ? "rgba(239,68,68,0.15)" : "var(--bg-hover)", color: isRecording ? "#ef4444" : "var(--text-muted)" }}
                title={isRecording ? "Zatrzymaj" : "Dyktuj treść (pl)"}
              >
                {isRecording ? <MicOff size={11} className="animate-pulse" /> : <Mic size={11} />}
                {isRecording ? "Stop" : "Dyktuj"}
              </button>
            </div>

            {/* Group picker + suggested group */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="bg-transparent text-xs focus:outline-none rounded px-2 py-1 border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
              >
                <option value="">Bez grupy</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}
                    style={{ backgroundColor: "#1c1c1c", color: "var(--text-primary)" }}>
                    {g.name}
                  </option>
                ))}
              </select>
              {suggestedTags?.suggestedGroup && !groupId && (
                <button
                  onClick={applySuggestedGroup}
                  className="text-xs px-1.5 py-0.5 rounded border border-dashed"
                  style={{ color: "var(--accent-blue)", borderColor: "var(--accent-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}
                >
                  ✨ {suggestedTags.suggestedGroup}
                </button>
              )}
            </div>

            {/* Tag picker row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedTags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  onRemove={() => setSelectedTagIds((ids) => ids.filter((id) => id !== tag.id))}
                />
              ))}

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

              {suggestLoading && <Loader2 size={10} className="animate-spin" style={{ color: "var(--text-muted)" }} />}
              <button
                onClick={suggestTagsAuto}
                disabled={suggestLoading}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-hover)" }}
              >
                <Sparkles size={10} />
                AI tagi
              </button>
            </div>

            {/* Inline available tags */}
            {!tagInput && availableTagChips.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {availableTagChips.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => addExistingTag(tag)}
                    className="text-[10px] px-1.5 py-0 rounded-full opacity-40 hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}

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
