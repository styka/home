"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, ShoppingCart, Pencil, Trash2, Check, X } from "lucide-react";
import type { ShoppingList } from "@/types";
import { createList, deleteList, renameList } from "@/actions/lists";

interface ListDropdownProps {
  allLists: ShoppingList[];
  currentListId: string;
}

export function ListDropdown({ allLists, currentListId }: ListDropdownProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const currentList = allLists.find((l) => l.id === currentListId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setEditingId(null);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const list = await createList(newName.trim());
      router.push(`/shopping/${list.id}`);
    });
    setNewName("");
    setCreating(false);
    setOpen(false);
  }

  function handleDelete(id: string) {
    if (!confirm("Usunąć tę listę i wszystkie jej pozycje?")) return;
    startTransition(async () => {
      await deleteList(id);
      const remaining = allLists.filter((l) => l.id !== id);
      router.push(remaining.length > 0 ? `/shopping/${remaining[0].id}` : "/shopping");
    });
    setOpen(false);
  }

  function saveRename() {
    if (!editingId || !editName.trim()) { setEditingId(null); return; }
    startTransition(() => { renameList(editingId, editName.trim()); });
    setEditingId(null);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 focus:outline-none"
        style={{ color: "var(--text-primary)" }}
      >
        <span className="text-sm font-semibold">{currentList?.name ?? "Zakupy"}</span>
        <ChevronDown
          size={13}
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 min-w-[220px] rounded-lg shadow-lg py-1"
          style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          {allLists.map((list) => {
            const isActive = list.id === currentListId;
            if (editingId === list.id) {
              return (
                <div key={list.id} className="flex items-center gap-1 px-3 py-1.5">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 bg-transparent text-sm focus:outline-none border-b"
                    style={{ color: "var(--text-primary)", borderColor: "var(--accent-blue)" }}
                    autoFocus
                  />
                  <button onClick={saveRename} className="p-0.5" style={{ color: "var(--accent-green)" }}>
                    <Check size={12} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-0.5" style={{ color: "var(--text-muted)" }}>
                    <X size={12} />
                  </button>
                </div>
              );
            }
            return (
              <div
                key={list.id}
                className="group flex items-center gap-2 px-3 py-1.5"
                style={{ backgroundColor: isActive ? "var(--bg-hover)" : undefined }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = ""; }}
              >
                <ShoppingCart
                  size={12}
                  className="flex-shrink-0"
                  style={{ color: isActive ? "var(--accent-blue)" : "var(--text-muted)" }}
                />
                <Link
                  href={`/shopping/${list.id}`}
                  onClick={() => setOpen(false)}
                  className="flex-1 text-sm truncate focus:outline-none"
                  style={{
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: isActive ? 500 : undefined,
                  }}
                >
                  {list.ownerTeam ? `${list.name} (${list.ownerTeam.name})` : list.name}
                </Link>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(list.id); setEditName(list.name); }}
                    className="p-0.5 focus:outline-none"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                    title="Zmień nazwę"
                  >
                    <Pencil size={11} />
                  </button>
                  {allLists.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(list.id); }}
                      className="p-0.5 focus:outline-none"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                      title="Usuń listę"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--border)" }}>
            {creating ? (
              <div className="flex items-center gap-1 px-3 py-1.5">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setCreating(false); setNewName(""); }
                  }}
                  placeholder="Nazwa nowej listy…"
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="p-0.5 disabled:opacity-40"
                  style={{ color: "var(--accent-green)" }}
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(""); }}
                  className="p-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm focus:outline-none"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.backgroundColor = "";
                }}
              >
                <Plus size={13} />
                <span>Nowa lista</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
