"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import type { SystemCategory } from "@/actions/adminCategories";
import { createSystemCategory, updateSystemCategory, deleteSystemCategory } from "@/actions/adminCategories";
import { EMOJI_DATA } from "@/lib/emojiData";

interface SystemCategoryManagerProps {
  categories: SystemCategory[];
}

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? EMOJI_DATA.filter((e) => e.keywords.some((k) => k.includes(search.toLowerCase())))
    : EMOJI_DATA;

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
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
          style={{ top: "100%", left: 0, marginTop: 4, backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", width: 280 }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Szukaj emoji…"
              className="w-full text-sm focus:outline-none bg-transparent"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", padding: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {filtered.map((e) => (
                <button
                  key={e.emoji}
                  type="button"
                  onClick={() => { onChange(e.emoji); setOpen(false); }}
                  className="text-lg w-8 h-8 rounded flex items-center justify-center focus:outline-none"
                  onMouseEnter={(el) => { el.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={(el) => { el.currentTarget.style.backgroundColor = ""; }}
                  title={e.keywords[0]}
                >
                  {e.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SystemCategoryManager({ categories: initial }: SystemCategoryManagerProps) {
  const [categories, setCategories] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📦");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("📦");
  const [isPending, startTransition] = useTransition();

  const inputStyle = {
    backgroundColor: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "2px 6px",
    color: "var(--text-primary)",
  };

  const rowStyle = (i: number, total: number) => ({
    borderBottom: i < total - 1 ? "1px solid var(--border)" : undefined,
  });

  function handleCreate() {
    if (!newName.trim()) return;
    const name = newName.trim();
    const emoji = newEmoji;
    startTransition(async () => {
      await createSystemCategory(name, emoji);
      setCategories((prev) => [...prev, { id: crypto.randomUUID(), name, emoji, createdAt: new Date() }].sort((a, b) => a.name.localeCompare(b.name, "pl")));
    });
    setNewName(""); setNewEmoji("📦"); setAdding(false);
  }

  function startEdit(c: SystemCategory) {
    setEditingId(c.id); setEditName(c.name); setEditEmoji(c.emoji);
  }

  function handleUpdate() {
    if (!editingId || !editName.trim()) { setEditingId(null); return; }
    const id = editingId;
    const name = editName.trim();
    const emoji = editEmoji;
    startTransition(async () => {
      await updateSystemCategory(id, name, emoji);
      setCategories((prev) => prev.map((c) => c.id === id ? { ...c, name, emoji } : c).sort((a, b) => a.name.localeCompare(b.name, "pl")));
    });
    setEditingId(null);
  }

  function handleDelete(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    startTransition(async () => {
      await deleteSystemCategory(id);
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-muted)", margin: 0 }}>
          Kategorie systemowe
        </h2>
        <button
          onClick={() => setAdding(true)}
          disabled={isPending || adding}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium focus:outline-none disabled:opacity-40"
          style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Nowa kategoria
        </button>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Kategorie systemowe widoczne dla wszystkich użytkowników. Zmiana nazwy aktualizuje wszystkie produkty w katalogu.
      </p>

      {/* Add form */}
      {adding && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg mb-3 border" style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--accent-purple)" }}>
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
          <button onClick={handleCreate} disabled={!newName.trim() || isPending} className="p-1.5 focus:outline-none disabled:opacity-40" style={{ color: "var(--accent-purple)" }}>
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          </button>
          <button onClick={() => setAdding(false)} className="p-1.5 focus:outline-none" style={{ color: "var(--text-muted)" }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* List */}
      <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {categories.length === 0 ? (
          <p className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Brak kategorii systemowych.
          </p>
        ) : categories.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-3 px-4 py-2"
            style={{ ...rowStyle(i, categories.length), opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s" }}
          >
            {editingId === c.id ? (
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
                <button onClick={handleUpdate} disabled={isPending} className="p-1 focus:outline-none disabled:opacity-40" style={{ color: "var(--accent-purple)" }}>
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <button onClick={() => setEditingId(null)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}><X size={13} /></button>
              </>
            ) : (
              <>
                <span className="text-base w-6 text-center">{c.emoji}</span>
                <span className="mono text-sm flex-1" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => startEdit(c)}
                    disabled={isPending}
                    className="p-1 focus:outline-none disabled:opacity-40"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={isPending}
                    className="p-1 focus:outline-none disabled:opacity-40"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
