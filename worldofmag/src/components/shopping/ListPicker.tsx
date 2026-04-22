"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShoppingCart, Pencil, Check, X } from "lucide-react";
import type { ShoppingList } from "@/types";
import { createList, deleteList, renameList } from "@/actions/lists";
import { cn } from "@/lib/cn";

interface ListPickerProps {
  allLists: ShoppingList[];
  currentListId: string;
}

export function ListPicker({ allLists, currentListId }: ListPickerProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function handleCreate() {
    const name = prompt("New list name:");
    if (!name?.trim()) return;
    startTransition(async () => {
      const list = await createList(name.trim());
      router.push(`/shopping/${list.id}`);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this list and all its items?")) return;
    startTransition(async () => {
      await deleteList(id);
      const remaining = allLists.filter((l) => l.id !== id);
      if (remaining.length > 0) {
        router.push(`/shopping/${remaining[0].id}`);
      } else {
        router.push("/shopping");
      }
    });
  }

  function startRename(list: ShoppingList) {
    setEditingId(list.id);
    setEditName(list.name);
  }

  function saveRename() {
    if (!editingId || !editName.trim()) { setEditingId(null); return; }
    startTransition(() => { renameList(editingId, editName.trim()); });
    setEditingId(null);
  }

  return (
    <div
      className="flex flex-col border-r h-full"
      style={{
        width: "200px",
        flexShrink: 0,
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b text-xs font-medium"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <span>LISTS</span>
        <button
          onClick={handleCreate}
          className="p-1 rounded focus:outline-none"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          title="New list"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {allLists.map((list) => {
          const isActive = list.id === currentListId;
          if (editingId === list.id) {
            return (
              <div key={list.id} className="flex items-center gap-1 px-2 py-1">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 bg-transparent text-xs focus:outline-none border-b"
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
              className={cn("group flex items-center gap-2 px-3 py-1.5 rounded mx-1")}
              style={{
                backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = ""; }}
            >
              <ShoppingCart size={12} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Link href={`/shopping/${list.id}`} className="block text-xs truncate focus:outline-none">
                  {list.name}
                </Link>
                {list.ownerTeam && (
                  <span className="block text-xs truncate" style={{ color: "var(--text-muted)", fontSize: 10 }}>
                    {list.ownerTeam.name}
                  </span>
                )}
              </div>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={() => startRename(list)}
                  className="p-0.5 focus:outline-none"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  <Pencil size={11} />
                </button>
                {allLists.length > 1 && (
                  <button
                    onClick={() => handleDelete(list.id)}
                    className="p-0.5 focus:outline-none"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
