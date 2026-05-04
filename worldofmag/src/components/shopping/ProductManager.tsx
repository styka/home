"use client";

import { useState, useTransition, useId } from "react";
import { Pencil, Trash2, Plus, Check, X, Copy, Loader2 } from "lucide-react";
import type { Product } from "@/types";
import { UNITS } from "@/types";
import { createProduct, updateProduct, deleteProduct, copyGlobalProduct } from "@/actions/products";
import { cn } from "@/lib/cn";

interface ProductManagerProps {
  products: Product[];
  userId: string;
  categoryNames: string[];
}

interface EditState {
  id: string;
  name: string;
  defaultUnit: string;
  category: string;
}

export function ProductManager({ products, userId, categoryNames }: ProductManagerProps) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCategory, setNewCategory] = useState("Other");
  const [isPending, startTransition] = useTransition();
  const unitDatalistId = useId();

  const personal = products.filter((p) => p.userId === userId);
  const global = products.filter((p) => !p.userId && !p.teamId);

  const baseUnitValues = UNITS.map((u) => u.value);
  const customUnits = Array.from(new Set(
    products.map((p) => p.defaultUnit).filter((u): u is string => !!u && !baseUnitValues.includes(u))
  ));
  const allUnitSuggestions = [...baseUnitValues, ...customUnits];

  const filtered = (list: Product[]) =>
    list.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  function startEdit(p: Product) {
    setEditing({ id: p.id, name: p.name, defaultUnit: p.defaultUnit ?? "", category: p.category });
  }

  function saveEdit() {
    if (!editing) return;
    startTransition(async () => {
      await updateProduct(editing.id, {
        name: editing.name,
        defaultUnit: editing.defaultUnit || null,
        category: editing.category,
      });
    });
    setEditing(null);
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteProduct(id); });
  }

  function handleCopy(id: string) {
    startTransition(async () => { await copyGlobalProduct(id); });
  }

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createProduct({ name: newName.trim(), defaultUnit: newUnit || null, category: newCategory });
    });
    setNewName("");
    setNewUnit("");
    setNewCategory("Other");
    setAdding(false);
  }

  const inputStyle = {
    backgroundColor: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-primary)",
    padding: "4px 8px",
    fontSize: 13,
    outline: "none",
  };

  return (
    <div>
      {/* Search + Add */}
      <div className="flex items-center gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj produktu…"
          className="flex-1 mono text-sm focus:outline-none"
          style={{ ...inputStyle, padding: "6px 12px" }}
        />
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium focus:outline-none"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
        >
          <Plus size={14} />
          Nowy produkt
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div
          className="flex flex-wrap items-center gap-2 p-3 rounded-lg mb-4 border"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--accent-blue)" }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Nazwa produktu"
            className="mono text-sm focus:outline-none flex-1"
            style={inputStyle}
            autoFocus
          />
          <UnitInput value={newUnit} onChange={setNewUnit} datalistId={unitDatalistId} />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="text-sm focus:outline-none"
            style={{ ...inputStyle, width: 160 }}
          >
            {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={handleCreate} disabled={!newName.trim() || isPending} className="p-1.5 rounded focus:outline-none disabled:opacity-40" style={{ color: "var(--accent-blue)" }}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>
          <button onClick={() => setAdding(false)} className="p-1.5 rounded focus:outline-none" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>
      )}

      <datalist id={unitDatalistId}>
        {allUnitSuggestions.map((u) => <option key={u} value={u} />)}
      </datalist>

      {/* Personal products */}
      <Section
        title="Moje produkty"
        products={filtered(personal)}
        editing={editing}
        onEdit={startEdit}
        onSave={saveEdit}
        onCancel={() => setEditing(null)}
        onDelete={handleDelete}
        onChange={(patch) => setEditing((e) => e ? { ...e, ...patch } : e)}
        editable
        unitDatalistId={unitDatalistId}
        categoryNames={categoryNames}
      />

      {/* Global products */}
      <Section
        title="Katalog globalny"
        subtitle="Produkty dostępne dla wszystkich. Kliknij kopiuj by dodać do swoich."
        products={filtered(global)}
        editing={null}
        onEdit={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
        onDelete={() => {}}
        onChange={() => {}}
        editable={false}
        unitDatalistId={unitDatalistId}
        categoryNames={categoryNames}
        onCopy={handleCopy}
        alreadyCopied={(id) => personal.some((p) => {
          const g = global.find((g) => g.id === id);
          return g ? p.name === g.name : false;
        })}
      />
    </div>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  products: Product[];
  editing: EditState | null;
  editable: boolean;
  unitDatalistId: string;
  categoryNames: string[];
  onEdit: (p: Product) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onChange: (patch: Partial<EditState>) => void;
  onCopy?: (id: string) => void;
  alreadyCopied?: (id: string) => boolean;
}

function Section({ title, subtitle, products, editing, editable, unitDatalistId, categoryNames, onEdit, onSave, onCancel, onDelete, onChange, onCopy, alreadyCopied }: SectionProps) {
  return (
    <div className="mb-8">
      <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      )}

      {products.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Brak produktów.</p>
      ) : (
        <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {products.map((p, i) => {
            const isEditing = editing?.id === p.id;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-2"
                style={{
                  borderBottom: i < products.length - 1 ? "1px solid var(--border)" : undefined,
                  backgroundColor: isEditing ? "var(--bg-elevated)" : undefined,
                }}
              >
                {isEditing && editing ? (
                  <>
                    <input
                      value={editing.name}
                      onChange={(e) => onChange({ name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
                      className="flex-1 mono text-sm focus:outline-none"
                      style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", color: "var(--text-primary)" }}
                      autoFocus
                    />
                    <UnitInput value={editing.defaultUnit} onChange={(v) => onChange({ defaultUnit: v })} datalistId={unitDatalistId} />
                    <select
                      value={editing.category}
                      onChange={(e) => onChange({ category: e.target.value })}
                      className="text-xs focus:outline-none"
                      style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", color: "var(--text-secondary)", width: 140 }}
                    >
                      {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={onSave} className="p-1 focus:outline-none" style={{ color: "var(--accent-blue)" }}><Check size={14} /></button>
                    <button onClick={onCancel} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="mono text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)", minWidth: 36 }}>{p.defaultUnit ?? "—"}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)", minWidth: 100 }}>{p.category}</span>
                    {editable ? (
                      <div className="flex items-center gap-1 ml-2">
                        <button onClick={() => onEdit(p)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => onDelete(p.id)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : onCopy ? (
                      <button
                        onClick={() => onCopy(p.id)}
                        disabled={alreadyCopied?.(p.id)}
                        className="ml-2 p-1 focus:outline-none disabled:opacity-30"
                        style={{ color: "var(--text-muted)" }}
                        title={alreadyCopied?.(p.id) ? "Już w Twoim katalogu" : "Kopiuj do moich"}
                        onMouseEnter={(e) => { if (!alreadyCopied?.(p.id)) e.currentTarget.style.color = "var(--accent-blue)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                      >
                        <Copy size={13} />
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UnitInput({ value, onChange, datalistId }: { value: string; onChange: (v: string) => void; datalistId: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      list={datalistId}
      placeholder="jedn."
      autoComplete="off"
      className="mono text-xs focus:outline-none"
      style={{
        backgroundColor: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "2px 6px",
        color: value ? "var(--text-secondary)" : "var(--text-muted)",
        width: 80,
      }}
    />
  );
}
