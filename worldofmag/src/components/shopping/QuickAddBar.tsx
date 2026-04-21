"use client";

import { useRef, useState, useEffect, useTransition, forwardRef, useImperativeHandle } from "react";
import { Plus, Loader2 } from "lucide-react";
import type { ItemHistory } from "@/types";
import { addItem, getSuggestionsForPrefix } from "@/actions/items";

interface QuickAddBarProps {
  listId: string;
}

export interface QuickAddBarHandle {
  focus: () => void;
}

export const QuickAddBar = forwardRef<QuickAddBarHandle, QuickAddBarProps>(
  function QuickAddBar({ listId }, ref) {
    const [value, setValue] = useState("");
    const [suggestions, setSuggestions] = useState<ItemHistory[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(-1);
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    useEffect(() => {
      clearTimeout(debounceRef.current);
      if (!value.trim()) { setSuggestions([]); return; }
      debounceRef.current = setTimeout(async () => {
        const results = await getSuggestionsForPrefix(value.trim());
        setSuggestions(results);
        setSuggestionIndex(-1);
      }, 150);
      return () => clearTimeout(debounceRef.current);
    }, [value]);

    function submit(rawText: string) {
      if (!rawText.trim()) return;
      setValue("");
      setSuggestions([]);
      setSuggestionIndex(-1);
      startTransition(() => { addItem(listId, rawText.trim()); });
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (suggestionIndex >= 0 && suggestions[suggestionIndex]) {
          submit(suggestions[suggestionIndex].name);
        } else {
          submit(value);
        }
      } else if (e.key === "Escape") {
        if (suggestions.length > 0) {
          setSuggestions([]);
        } else {
          setValue("");
          inputRef.current?.blur();
        }
      } else if (e.key === "Tab" && suggestions.length > 0) {
        e.preventDefault();
        const idx = suggestionIndex >= 0 ? suggestionIndex : 0;
        setValue(suggestions[idx]?.name ?? value);
        setSuggestions([]);
      }
    }

    return (
      <div
        className="relative border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {isPending ? (
            <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: "var(--accent-blue)" }} />
          ) : (
            <Plus size={16} className="flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          )}
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add item… e.g. '2 butelki mleka' or 'jajka x12'"
            className="flex-1 bg-transparent mono text-sm focus:outline-none"
            style={{
              color: "var(--text-primary)",
              caretColor: "var(--accent-blue)",
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {value && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              <kbd>Enter</kbd> to add
            </span>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 z-50 border-t shadow-lg"
            style={{
              top: "100%",
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border)",
              borderBottom: `1px solid var(--border)`,
              borderLeft: `1px solid var(--border)`,
              borderRight: `1px solid var(--border)`,
            }}
          >
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => submit(s.name)}
                className="flex items-center gap-3 w-full px-4 py-2 text-left focus:outline-none"
                style={{
                  backgroundColor: i === suggestionIndex ? "var(--bg-hover)" : undefined,
                  color: "var(--text-primary)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = i === suggestionIndex ? "var(--bg-hover)" : "";
                }}
              >
                <span className="mono text-sm">{s.name}</span>
                <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                  {s.category}
                  {s.unit && ` · ${s.unit}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
