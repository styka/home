"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { CategoryWithUsage } from "@/actions/categories";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";

interface CategoryManagerProps {
  categories: CategoryWithUsage[];
}

const EMOJI_PRESETS = ["📦","🛒","🥗","🌮","🍕","🧃","🛁","💊","🐾","🏠","🎁","⚡","🌱","🧹"];

export function CategoryManager({ categories }: CategoryManagerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📦");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("📦");
  const [, startTransition] = useTransition();

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
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium focus:outline-none"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
        >
          <Plus size={12} /> Nowa kategoria
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
          <button onClick={handleCreate} disabled={!newName.trim()} className="p-1.5 focus:outline-none disabled:opacity-40" style={{ color: "var(--accent-blue)" }}>
            <Check size={15} />
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
          <div key={c.id ?? c.name} className="flex items-center gap-3 px-4 py-2" style={rowStyle(i, custom.length)}>
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
                <button onClick={handleUpdate} className="p-1 focus:outline-none" style={{ color: "var(--accent-blue)" }}><Check size={13} /></button>
                <button onClick={() => setEditingId(null)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}><X size={13} /></button>
              </>
            ) : (
              <>
                <span className="text-base w-6 text-center">{c.emoji}</span>
                <span className="mono text-sm flex-1" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {c.usageCount > 0 ? `${c.usageCount} ${c.usageCount === 1 ? "produkt" : "produkty"}` : "nieużywana"}
                </span>
                {c.isOwn && c.id && (
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => startEdit(c)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDelete(c.id!)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
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
            <span className="text-base w-6 text-center">{c.emoji}</span>
            <span className="mono text-sm flex-1" style={{ color: "var(--text-primary)" }}>{c.name}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {c.usageCount > 0 ? `${c.usageCount} ${c.usageCount === 1 ? "produkt" : "produkty"}` : "—"}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        Zmiana nazwy własnej kategorii aktualizuje produkty w Twoim katalogu, ale nie produkty już dodane do list zakupów.
      </p>
    </div>
  );
}

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const EMOJI_PRESETS = ["📦","🛒","🥗","🌮","🍕","🧃","🛁","💊","🐾","🏠","🎁","⚡","🌱","🧹","🫐","🥛","🍷","🌽","🧁","🧽"];

  return (
    <div style={{ position: "relative" }}>
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
          className="absolute z-20 p-2 rounded-lg shadow-xl grid"
          style={{
            top: "100%", left: 0, marginTop: 4,
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 4,
          }}
        >
          {EMOJI_PRESETS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { onChange(e); setOpen(false); }}
              className="text-lg w-8 h-8 rounded flex items-center justify-center focus:outline-none"
              style={{ backgroundColor: value === e ? "var(--bg-hover)" : undefined }}
            >
              {e}
            </button>
          ))}
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={2}
            className="col-span-5 mt-1 text-center text-sm focus:outline-none rounded"
            style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", padding: "2px 4px", color: "var(--text-primary)" }}
            placeholder="lub wpisz…"
          />
        </div>
      )}
    </div>
  );
}
