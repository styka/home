"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { UnitWithUsage } from "@/actions/units";
import { createUnit, renameUnit, deleteUnit } from "@/actions/units";

interface UnitManagerProps {
  units: UnitWithUsage[];
}

export function UnitManager({ units }: UnitManagerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [, startTransition] = useTransition();

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => { await createUnit(newName.trim()); });
    setNewName("");
    setAdding(false);
  }

  function startEdit(unit: UnitWithUsage) {
    if (!unit.id) return;
    setEditingId(unit.id);
    setEditName(unit.name);
  }

  function handleRename() {
    if (!editingId || !editName.trim()) { setEditingId(null); return; }
    startTransition(async () => { await renameUnit(editingId, editName.trim()); });
    setEditingId(null);
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteUnit(id); });
  }

  const base = units.filter((u) => u.isBase);
  const custom = units.filter((u) => !u.isBase);

  const rowStyle = (i: number, total: number) => ({
    borderBottom: i < total - 1 ? "1px solid var(--border)" : undefined,
  });

  return (
    <div>
      {/* Custom units */}
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-muted)", margin: 0 }}>
          Własne jednostki
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium focus:outline-none"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
        >
          <Plus size={12} />
          Nowa jednostka
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 p-2 rounded-lg mb-3 border" style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--accent-blue)" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setAdding(false); }}
            placeholder="np. woreczek"
            className="flex-1 mono text-sm focus:outline-none"
            style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 8px", color: "var(--text-primary)" }}
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
        {custom.length === 0 && !adding ? (
          <p className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Brak własnych jednostek. Kliknij „Nowa jednostka" by dodać.
          </p>
        ) : (
          custom.map((u, i) => (
            <div key={u.id ?? u.name} className="flex items-center gap-3 px-4 py-2" style={rowStyle(i, custom.length)}>
              {editingId === u.id && u.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 mono text-sm focus:outline-none"
                    style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", color: "var(--text-primary)" }}
                    autoFocus
                  />
                  <button onClick={handleRename} className="p-1 focus:outline-none" style={{ color: "var(--accent-blue)" }}><Check size={13} /></button>
                  <button onClick={() => setEditingId(null)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}><X size={13} /></button>
                </>
              ) : (
                <>
                  <span className="mono text-sm flex-1" style={{ color: "var(--text-primary)" }}>{u.name}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {u.usageCount > 0 ? `${u.usageCount} ${u.usageCount === 1 ? "produkt" : "produkty"}` : "nieużywana"}
                  </span>
                  {u.isOwn && u.id && (
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => startEdit(u)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(u.id!)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Base units (read-only) */}
      <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 8 }}>
        Jednostki podstawowe
      </h2>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Wbudowane jednostki dostępne dla wszystkich — tylko do odczytu.
      </p>
      <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {base.map((u, i) => (
          <div key={u.name} className="flex items-center gap-3 px-4 py-2" style={rowStyle(i, base.length)}>
            <span className="mono text-sm flex-1" style={{ color: "var(--text-primary)" }}>{u.name}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {u.usageCount > 0 ? `${u.usageCount} ${u.usageCount === 1 ? "produkt" : "produkty"}` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
