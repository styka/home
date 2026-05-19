"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, Image } from "lucide-react";
import type { CategoryWithUsage } from "@/actions/categories";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";
import { CategoryIconPicker } from "@/components/shopping/CategoryIconPicker";
import { EMOJI_DATA } from "@/lib/emojiData";

interface CategoryManagerProps {
  categories: CategoryWithUsage[];
  activeIconMap?: Record<string, string>;
}

const isSvg = (s: string) => s.trimStart().startsWith("<");

function SvgIconSmall({ content }: { content: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--text-secondary)" }}
      dangerouslySetInnerHTML={{ __html: content }}
      aria-hidden
    />
  );
}

export function CategoryManager({ categories, activeIconMap = {} }: CategoryManagerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📦");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("📦");
  const [isPending, startTransition] = useTransition();
  const [iconPickerCategory, setIconPickerCategory] = useState<string | null>(null);
  // Optimistic local icon overrides from within CategoryManager
  const [localIconMap, setLocalIconMap] = useState<Record<string, string>>(activeIconMap);

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => { await createCategory(newName.trim(), newEmoji); });
    setNewName(""); setNewEmoji("📦"); setAdding(false);
  }

  function startEdit(c: CategoryWithUsage) {
    if (!c.id) return;
    setEditingId(c.id); setEditName(c.name); setEditEmoji(c.emoji);
  }

  function handleUpdate() {
    if (!editingId || !editName.trim()) { setEditingId(null); return; }
    startTransition(async () => { await updateCategory(editingId, editName.trim(), editEmoji); });
    setEditingId(null);
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteCategory(id); });
  }

  const base = categories.filter((c) => c.isBase);
  const custom = categories.filter((c) => !c.isBase);

  const rowStyle = (i: number, total: number) => ({
    borderBottom: i < total - 1 ? "1px solid var(--border)" : undefined,
  });

  const inputStyle = {
    backgroundColor: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "2px 6px",
    color: "var(--text-primary)",
  };

  return (
    <div>
      {/* Custom */}
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-muted)", margin: 0 }}>
          Własne kategorie
        </h2>
        <button
          onClick={() => setAdding(true)}
          disabled={isPending}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium focus:outline-none disabled:opacity-40"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Nowa kategoria
        </button>
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg mb-3 border" style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--accent-blue)" }}>
          <EmojiPicker value={newEmoji} onChange={setNewEmoji} />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Nazwa kategorii"
            className="mono text-sm focus:outline-none flex-1"
            style={{ ...inputStyle, minWidth: 160 }}
            autoFocus
          />
          <button onClick={handleCreate} disabled={!newName.trim() || isPending} className="p-1.5 focus:outline-none disabled:opacity-40" style={{ color: "var(--accent-blue)" }}>
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          </button>
          <button onClick={() => setAdding(false)} className="p-1.5 focus:outline-none" style={{ color: "var(--text-muted)" }}>
            <X size={15} />
          </button>
        </div>
      )}

      <div className="mb-8" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {custom.length === 0 ? (
          <p className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Brak własnych kategorii. Kliknij „Nowa kategoria" by dodać.
          </p>
        ) : custom.map((c, i) => (
          <div
            key={c.id ?? c.name}
            className="flex items-center gap-3 px-4 py-2"
            style={{ ...rowStyle(i, custom.length), opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s" }}
          >
            {editingId === c.id && c.id ? (
              <>
                <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(); if (e.key === "Escape") setEditingId(null); }}
                  className="flex-1 mono text-sm focus:outline-none"
                  style={{ ...inputStyle, minWidth: 120 }}
                  autoFocus
                />
                <button onClick={handleUpdate} disabled={isPending} className="p-1 focus:outline-none disabled:opacity-40" style={{ color: "var(--accent-blue)" }}>
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <button onClick={() => setEditingId(null)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}><X size={13} /></button>
              </>
            ) : (
              <>
                <div className="w-6 flex items-center justify-center">
                  {localIconMap[c.name] && isSvg(localIconMap[c.name]) ? (
                    <SvgIconSmall content={localIconMap[c.name]} />
                  ) : (
                    <span className="text-base">{localIconMap[c.name] ?? c.emoji}</span>
                  )}
                </div>
                <span className="mono text-sm flex-1" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {c.usageCount > 0 ? `${c.usageCount} ${c.usageCount === 1 ? "produkt" : "produkty"}` : "nieużywana"}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setIconPickerCategory(c.name)}
                    className="p-1 focus:outline-none"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                    title="Zarządzaj ikonami SVG"
                  >
                    <Image size={12} />
                  </button>
                  {c.isOwn && c.id && (
                    <>
                      <button onClick={() => startEdit(c)} disabled={isPending} className="p-1 focus:outline-none disabled:opacity-40" style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(c.id!)} disabled={isPending} className="p-1 focus:outline-none disabled:opacity-40" style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Base (read-only) */}
      <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 8 }}>
        Kategorie podstawowe
      </h2>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Wbudowane kategorie z automatycznym rozpoznawaniem słów kluczowych — tylko do odczytu.
      </p>
      <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {base.map((c, i) => (
          <div key={c.name} className="flex items-center gap-3 px-4 py-2" style={rowStyle(i, base.length)}>
            <div className="w-6 flex items-center justify-center">
              {localIconMap[c.name] && isSvg(localIconMap[c.name]) ? (
                <SvgIconSmall content={localIconMap[c.name]} />
              ) : (
                <span className="text-base">{c.emoji}</span>
              )}
            </div>
            <span className="mono text-sm flex-1" style={{ color: "var(--text-primary)" }}>{c.name}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {c.usageCount > 0 ? `${c.usageCount} ${c.usageCount === 1 ? "produkt" : "produkty"}` : "—"}
            </span>
            <button
              onClick={() => setIconPickerCategory(c.name)}
              className="p-1 focus:outline-none"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
              title="Zarządzaj ikonami SVG"
            >
              <Image size={12} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        Zmiana nazwy własnej kategorii aktualizuje produkty w Twoim katalogu, ale nie produkty już dodane do list zakupów.
      </p>

      {iconPickerCategory && (
        <CategoryIconPicker
          category={iconPickerCategory}
          open={true}
          onClose={() => setIconPickerCategory(null)}
          onSelect={(svg) => setLocalIconMap((prev) => ({ ...prev, [iconPickerCategory]: svg }))}
          onReset={() => setLocalIconMap((prev) => { const n = { ...prev }; delete n[iconPickerCategory]; return n; })}
        />
      )}
    </div>
  );
}

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? EMOJI_DATA.filter((e) =>
        e.keywords.some((k) => k.includes(search.toLowerCase()))
      )
    : EMOJI_DATA;

  useEffect(() => {
    if (!open) { setSearch(""); setCustom(""); return; }
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xl w-9 h-9 rounded flex items-center justify-center focus:outline-none"
        style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)" }}
        title="Wybierz emoji"
      >
        {value}
      </button>

      {open && (
        <div
          className="absolute z-30 rounded-lg shadow-xl"
          style={{
            top: "100%",
            left: 0,
            marginTop: 4,
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            width: 308,
          }}
        >
          {/* Search */}
          <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Szukaj emoji…"
              className="w-full text-sm focus:outline-none bg-transparent mono"
              style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
            />
          </div>

          {/* Grid */}
          <div
            style={{ maxHeight: 240, overflowY: "auto", padding: 6 }}
          >
            {filtered.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Brak wyników</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2 }}>
                {filtered.map((e) => (
                  <button
                    key={e.emoji}
                    type="button"
                    onClick={() => { onChange(e.emoji); setOpen(false); }}
                    className="text-lg w-8 h-8 rounded flex items-center justify-center focus:outline-none"
                    style={{
                      backgroundColor: value === e.emoji ? "var(--bg-hover)" : undefined,
                      transition: "background-color 0.1s",
                    }}
                    onMouseEnter={(el) => { el.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                    onMouseLeave={(el) => { el.currentTarget.style.backgroundColor = value === e.emoji ? "var(--bg-hover)" : ""; }}
                    title={e.keywords[0]}
                  >
                    {e.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom input */}
          <div className="p-2 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                maxLength={2}
                placeholder="Wpisz własne…"
                className="flex-1 text-sm text-center focus:outline-none mono rounded"
                style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", padding: "2px 6px", color: "var(--text-primary)" }}
              />
              <button
                type="button"
                disabled={!custom.trim()}
                onClick={() => { if (custom.trim()) { onChange(custom.trim()); setOpen(false); } }}
                className="px-2 py-1 rounded text-xs focus:outline-none disabled:opacity-40"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
