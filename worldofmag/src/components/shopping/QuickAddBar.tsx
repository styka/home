"use client";

import { useRef, useState, useEffect, useTransition, forwardRef, useImperativeHandle } from "react";
import { Plus, Loader2, Mic } from "lucide-react";
import type { Product } from "@/types";
import { UNITS } from "@/types";
import { addItemStructured } from "@/actions/items";
import { getProductSuggestions } from "@/actions/products";
import { VoiceLLMModal } from "./VoiceLLMModal";

interface QuickAddBarProps {
  listId: string;
}

export interface QuickAddBarHandle {
  focus: () => void;
}

export const QuickAddBar = forwardRef<QuickAddBarHandle, QuickAddBarProps>(
  function QuickAddBar({ listId }, ref) {
    const [name, setName] = useState("");
    const [qty, setQty] = useState("");
    const [unit, setUnit] = useState("");
    const [suggestions, setSuggestions] = useState<Product[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(-1);
    const [isPending, startTransition] = useTransition();
    const [showVoice, setShowVoice] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);
    const qtyRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useImperativeHandle(ref, () => ({
      focus: () => nameRef.current?.focus(),
    }));

    useEffect(() => {
      clearTimeout(debounceRef.current);
      if (!name.trim()) { setSuggestions([]); return; }
      debounceRef.current = setTimeout(async () => {
        const results = await getProductSuggestions(name.trim());
        setSuggestions(results);
        setSuggestionIndex(-1);
      }, 150);
      return () => clearTimeout(debounceRef.current);
    }, [name]);

    function selectSuggestion(product: Product) {
      setName(product.name);
      if (product.defaultUnit) setUnit(product.defaultUnit);
      setSuggestions([]);
      setSuggestionIndex(-1);
      qtyRef.current?.focus();
    }

    function submit() {
      if (!name.trim()) return;
      const parsedQty = qty.trim() ? parseFloat(qty.trim()) : null;
      const parsedUnit = unit.trim() || null;
      startTransition(() => {
        addItemStructured(listId, name.trim(), parsedQty, parsedUnit);
      });
      setName("");
      setQty("");
      setUnit("");
      setSuggestions([]);
      setSuggestionIndex(-1);
      setTimeout(() => nameRef.current?.focus(), 50);
    }

    function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (suggestions.length > 0) setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (suggestionIndex >= 0 && suggestions[suggestionIndex]) {
          selectSuggestion(suggestions[suggestionIndex]);
        } else {
          setSuggestions([]);
          qtyRef.current?.focus();
        }
      } else if (e.key === "Tab" && suggestions.length > 0) {
        e.preventDefault();
        const idx = suggestionIndex >= 0 ? suggestionIndex : 0;
        if (suggestions[idx]) selectSuggestion(suggestions[idx]);
      } else if (e.key === "Escape") {
        if (suggestions.length > 0) {
          setSuggestions([]);
        } else {
          setName(""); setQty(""); setUnit("");
          nameRef.current?.blur();
        }
      }
    }

    function handleQtyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      if (e.key === "Escape") { nameRef.current?.focus(); }
    }

    function handleUnitKeyDown(e: React.KeyboardEvent<HTMLSelectElement | HTMLInputElement>) {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      if (e.key === "Escape") { nameRef.current?.focus(); }
    }

    return (
      <>
        <div
          className="relative border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          <div className="flex flex-col md:flex-row md:items-center gap-0">
            {/* Name input */}
            <div className="flex items-center gap-2 px-4 py-2 flex-1">
              {isPending ? (
                <Loader2 size={15} className="animate-spin flex-shrink-0" style={{ color: "var(--accent-blue)" }} />
              ) : (
                <Plus size={15} className="flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              )}
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                placeholder="Nazwa produktu…"
                className="flex-1 bg-transparent mono text-sm focus:outline-none"
                style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Qty + unit + buttons */}
            <div
              className="flex items-center gap-2 px-4 pb-2 md:py-2 md:px-3 md:border-l"
              style={{ borderColor: "var(--border)" }}
            >
              <input
                ref={qtyRef}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={handleQtyKeyDown}
                placeholder="Ilość"
                type="number"
                min="0"
                step="any"
                className="bg-transparent mono text-sm text-right focus:outline-none"
                style={{ width: 52, color: "var(--text-secondary)", caretColor: "var(--accent-blue)" }}
              />

              <UnitSelect value={unit} onChange={setUnit} onKeyDown={handleUnitKeyDown} />

              <button
                onClick={submit}
                disabled={!name.trim() || isPending}
                className="flex items-center justify-center rounded px-2 py-1 text-xs font-medium focus:outline-none disabled:opacity-40"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
                title="Dodaj (Enter)"
              >
                <Plus size={14} />
              </button>

              <button
                onClick={() => setShowVoice(true)}
                className="flex items-center justify-center rounded p-1.5 focus:outline-none"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
                title="Dodaj głosem / przez LLM"
                type="button"
              >
                <Mic size={15} />
              </button>
            </div>
          </div>

          {/* Autocomplete dropdown */}
          {suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 z-50 shadow-lg"
              style={{
                top: "100%",
                backgroundColor: "var(--bg-elevated)",
                border: `1px solid var(--border)`,
                borderTop: "none",
              }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => selectSuggestion(s)}
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
                    {s.defaultUnit ? ` · ${s.defaultUnit}` : ""}
                    {!s.userId && !s.teamId && (
                      <span className="ml-1 opacity-40">global</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <VoiceLLMModal open={showVoice} onClose={() => setShowVoice(false)} listId={listId} />
      </>
    );
  }
);

interface UnitSelectProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLSelectElement | HTMLInputElement>) => void;
}

function UnitSelect({ value, onChange, onKeyDown }: UnitSelectProps) {
  const isCustom = value !== "" && !UNITS.find((u) => u.value === value);

  if (isCustom) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="jednostka"
        className="bg-transparent mono text-sm focus:outline-none"
        style={{ width: 72, color: "var(--text-secondary)", caretColor: "var(--accent-blue)" }}
        autoFocus
      />
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__custom__") {
          onChange("_");
        } else {
          onChange(e.target.value);
        }
      }}
      onKeyDown={onKeyDown}
      className="bg-transparent mono text-sm focus:outline-none cursor-pointer"
      style={{
        color: value ? "var(--text-secondary)" : "var(--text-muted)",
        width: 72,
        border: "none",
        outline: "none",
        appearance: "none",
        WebkitAppearance: "none",
      }}
    >
      <option value="">Jedn.</option>
      {UNITS.map((u) => (
        <option key={u.value} value={u.value} style={{ backgroundColor: "var(--bg-elevated)" }}>
          {u.label}
        </option>
      ))}
      <option value="__custom__" style={{ backgroundColor: "var(--bg-elevated)" }}>Inna…</option>
    </select>
  );
}
