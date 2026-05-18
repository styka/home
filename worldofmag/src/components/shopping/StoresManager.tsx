"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil, Map, HelpCircle } from "lucide-react";
import type { StoreWithGraph } from "@/types";
import { createStore, renameStore, deleteStore } from "@/actions/stores";

interface StoresManagerProps {
  stores: StoreWithGraph[];
}

export function StoresManager({ stores: initialStores }: StoresManagerProps) {
  const [stores, setStores] = useState<StoreWithGraph[]>(initialStores);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleCreate() {
    if (!newName.trim()) return;
    const store = await createStore(newName.trim());
    setStores(prev => [...prev, store]);
    setNewName("");
  }

  function startRename(store: StoreWithGraph) {
    setEditingId(store.id);
    setEditingName(store.name);
  }

  async function commitRename(id: string) {
    if (!editingName.trim()) { setEditingId(null); return; }
    await renameStore(id, editingName.trim());
    setStores(prev => prev.map(s => s.id === id ? { ...s, name: editingName.trim() } : s));
    setEditingId(null);
  }

  function handleDelete(id: string) {
    startTransition(() => { deleteStore(id); });
    setStores(prev => prev.filter(s => s.id !== id));
    setConfirmDeleteId(null);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/shopping"
          className="flex items-center gap-1 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={14} />
          Zakupy
        </Link>
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Mapy sklepów
        </h1>
        <Link
          href="/shopping/stores/guide"
          className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded"
          style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <HelpCircle size={12} />
          Jak używać?
        </Link>
      </div>

      {/* New store form */}
      <div
        className="flex gap-2 mb-6 p-3 rounded-lg"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
          placeholder="Nowy sklep…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-sm"
          style={{
            backgroundColor: newName.trim() ? "#16a34a" : "var(--bg-elevated)",
            color: newName.trim() ? "#fff" : "var(--text-muted)",
          }}
        >
          <Plus size={14} />
          Dodaj
        </button>
      </div>

      {/* Stores list */}
      {stores.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
          Brak sklepów. Dodaj pierwszy sklep powyżej.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {stores.map(store => (
            <div
              key={store.id}
              className="rounded-lg p-4"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  {editingId === store.id ? (
                    <input
                      type="text"
                      value={editingName}
                      autoFocus
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => commitRename(store.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter") commitRename(store.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="bg-transparent text-sm font-medium outline-none border-b w-full"
                      style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                    />
                  ) : (
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {store.name}
                    </p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {store.nodes.length} węzłów · {store.edges.length} krawędzi
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startRename(store)}
                    className="p-2 rounded"
                    style={{ color: "var(--text-muted)" }}
                    title="Zmień nazwę"
                  >
                    <Pencil size={14} />
                  </button>

                  {confirmDeleteId === store.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(store.id)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: "#dc2626", color: "#fff" }}
                      >
                        Usuń
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                      >
                        Anuluj
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(store.id)}
                      className="p-2 rounded"
                      style={{ color: "var(--text-muted)" }}
                      title="Usuń sklep"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  <Link
                    href={`/shopping/stores/${store.id}`}
                    className="flex items-center gap-1 px-2 py-1.5 rounded text-xs"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <Map size={13} />
                    <span>Edytuj mapę</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
