"use client";

import { useRef, useState, useEffect, useTransition, forwardRef, useImperativeHandle, useId } from "react";
import { Plus, Loader2 } from "lucide-react";
import type { Product } from "@/types";
import { UNITS } from "@/types";
import { addItemStructured } from "@/actions/items";
import { getProductSuggestions } from "@/actions/products";
import { categorize } from "@/lib/categorize";

interface QuickAddBarProps {
  listId: string;
  categoryNames: string[];
}

export interface QuickAddBarHandle {
  focus: () => void;
}

export const QuickAddBar = forwardRef<QuickAddBarHandle, QuickAddBarProps>(
  function QuickAddBar({ listId, categoryNames }, ref) {
    const [name, setName] = useState("");
    const [qty, setQty] = useState("");
    const [unit, setUnit] = useState("");
    const [category, setCategory] = useState("");
    const [categoryUserSet, setCategoryUserSet] = useState(false);
    const [suggestions, setSuggestions] = useState<Product[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(-1);
    const [isPending, startTransition] = useTransition();
    const nameRef = useRef<HTMLInputElement>(null);
    const qtyRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useImperativeHandle(ref, () => ({
      focus: () => nameRef.current?.focus(),
    }));

    useEffect(() => {
      if (categoryUserSet) return;
      if (!name.trim()) { setCategory(""); return; }
      const suggested = categorize(name.trim());
      setCategory(suggested === "Other" ? "" : suggested);
    }, [name, categoryUserSet]);

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
      setCategory(product.category);
      setCategoryUserSet(true);
      setSuggestions([]);
      setSuggestionIndex(-1);
      qtyRef.current?.focus();
    }

    function submit() {
      if (!name.trim() || isPending) return;
      const parsedQty = qty.trim() ? parseFloat(qty.trim()) : null;
      const parsedUnit = unit.trim() || null;
      const parsedCategory = category.trim() || undefined;
      startTransition(() => {
        addItemStructured(listId, name.trim(), parsedQty, parsedUnit, parsedCategory);
      });
      setName("");
      setQty("");
      setUnit("");
      setCategory("");
      setCategoryUserSet(false);
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
          submit();
        }
      } else if (e.key === "Tab" && suggestions.length > 0) {
        e.preventDefault();
        const idx = suggestionIndex >= 0 ? suggestionIndex : 0;
        if (suggestions[idx]) selectSuggestion(suggestions[idx]);
      } else if (e.key === "Escape") {
        if (suggestions.length > 0) {
          setSuggestions([]);
        } else {
          setName(""); setQty(""); setUnit(""); setCategory(""); setCategoryUserSet(false);
          nameRef.current?.blur();
        }
      }
    }

    function handleFieldKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      if (e.key === "Escape") { nameRef.current?.focus(); }
    }

    const borderColor = "var(--border)";

    return (
      <div
        className="relative border-b"
        style={{ borderColor, backgroundColor: "var(--bg-surface)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center">

          {/* Row 1 (mobile) / Left section (desktop): qty + unit + category */}
          <div
            className="flex items-center gap-2 px-4 py-2 md:border-r flex-shrink-0"
            style={{ borderColor }}
          >
            <input
              ref={qtyRef}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={handleFieldKeyDown}
              disabled={isPending}
              placeholder="Ilość"
              type="number"
              min="0"
              step="any"
              className="bg-transparent mono text-sm text-right focus:outline-none disabled:opacity-40"
              style={{ width: 52, color: "var(--text-secondary)", caretColor: "var(--accent-blue)" }}
            />

            <UnitInput value={unit} onChange={setUnit} onKeyDown={handleFieldKeyDown} disabled={isPending} />

            <CategoryInput
              value={category}
              onChange={(v) => { setCategory(v); setCategoryUserSet(!!v); }}
              onKeyDown={handleFieldKeyDown}
              options={categoryNames}
              disabled={isPending}
            />
          </div>

          {/* Row 2 (mobile) / Right section (desktop): name + submit */}
          <div className="flex items-center gap-2 px-4 pb-2 md:py-2 md:px-3 md:flex-1">
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              disabled={isPending}
              placeholder="Nazwa produktu…"
              className="flex-1 bg-transparent mono text-sm focus:outline-none disabled:opacity-40"
              style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
              autoComplete="off"
              spellCheck={false}
            />

            <button
              onClick={submit}
              disabled={!name.trim() || isPending}
              className="flex items-center justify-center rounded px-2 py-1 text-xs font-medium focus:outline-none disabled:opacity-40 flex-shrink-0"
              style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              title="Dodaj (Enter)"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
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
    );
  }
);

interface UnitInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

function UnitInput({ value, onChange, onKeyDown, disabled }: UnitInputProps) {
  const listId = useId();
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        list={listId}
        placeholder="jedn."
        autoComplete="off"
        className="bg-transparent mono text-sm focus:outline-none disabled:opacity-40"
        style={{ width: 72, color: value ? "var(--text-secondary)" : "var(--text-muted)", caretColor: "var(--accent-blue)" }}
      />
      <datalist id={listId}>
        {UNITS.map((u) => (
          <option key={u.value} value={u.value} />
        ))}
      </datalist>
    </>
  );
}

interface CategoryInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  options: string[];
  disabled?: boolean;
}

function CategoryInput({ value, onChange, onKeyDown, options, disabled }: CategoryInputProps) {
  const listId = useId();
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        list={listId}
        placeholder="Kategoria"
        autoComplete="off"
        className="bg-transparent mono text-xs focus:outline-none flex-1 md:flex-none disabled:opacity-40"
        style={{
          minWidth: 80,
          maxWidth: 140,
          color: value ? "var(--text-secondary)" : "var(--text-muted)",
          caretColor: "var(--accent-blue)",
        }}
      />
      <datalist id={listId}>
        {options.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
