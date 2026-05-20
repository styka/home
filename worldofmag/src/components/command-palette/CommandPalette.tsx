"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { ShoppingCart, Plus, Trash2, CheckCheck, X, Package, ArrowRight } from "lucide-react";
import { useCommandPalette } from "./CommandPaletteProvider";
import type { ShoppingList } from "@/types";
import { clearDoneItems, markAllInCart } from "@/actions/items";
import { createList } from "@/actions/lists";

interface CommandPaletteProps {
  listId: string;
  allLists: ShoppingList[];
  onFocusQuickAdd: () => void;
}

export function CommandPalette({ listId, allLists, onFocusQuickAdd }: CommandPaletteProps) {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const newListInputRef = useRef<HTMLInputElement>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    if (open) {
      setCreatingList(false);
      setNewListName("");
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (creatingList) setTimeout(() => newListInputRef.current?.focus(), 10);
  }, [creatingList]);

  function run(fn: () => void) {
    setOpen(false);
    setTimeout(fn, 50);
  }

  async function handleCreateList() {
    if (!newListName.trim()) return;
    setOpen(false);
    const name = newListName.trim();
    setNewListName("");
    setCreatingList(false);
    const list = await createList(name);
    router.push(`/shopping/${list.id}`);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-lg border shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <div
            className="flex items-center gap-2 px-4 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <span style={{ color: "var(--text-muted)" }}>⌘</span>
            <Command.Input
              ref={inputRef}
              placeholder="Wpisz komendę lub znajdź listę…"
              className="flex-1 py-3 bg-transparent text-sm focus:outline-none"
              style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
            />
            <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)" }}>
              <X size={14} />
            </button>
          </div>
          <Command.List className="overflow-y-auto" style={{ maxHeight: "360px" }}>
            <Command.Empty className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Nie znaleziono komendy.
            </Command.Empty>

            <Command.Group
              heading="Zakupy"
              className="py-1"
              style={{ color: "var(--text-muted)" } as React.CSSProperties}
            >
              <PaletteItem
                icon={<Plus size={14} />}
                label="Dodaj element"
                shortcut="a"
                onSelect={() => run(onFocusQuickAdd)}
              />
              <PaletteItem
                icon={<CheckCheck size={14} />}
                label="Oznacz wszystkie potrzebne → w koszyku"
                onSelect={() => run(() => startTransition(() => markAllInCart(listId)))}
              />
              <PaletteItem
                icon={<Trash2 size={14} />}
                label="Wyczyść zakończone"
                onSelect={() => run(() => startTransition(() => clearDoneItems(listId)))}
              />
              <PaletteItem
                icon={<Package size={14} />}
                label="Katalog produktów"
                onSelect={() => run(() => router.push("/shopping/products"))}
              />
              <PaletteItem
                icon={<Plus size={14} />}
                label="Nowa lista zakupów"
                onSelect={() => setCreatingList(true)}
              />
            </Command.Group>

            {allLists.length > 0 && (
              <Command.Group
                heading="Przejdź do listy"
                className="py-1"
                style={{ color: "var(--text-muted)" } as React.CSSProperties}
              >
                {allLists.map((list) => (
                  <PaletteItem
                    key={list.id}
                    icon={<ShoppingCart size={14} />}
                    label={list.name}
                    onSelect={() => run(() => router.push(`/shopping/${list.id}`))}
                    active={list.id === listId}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>

        {/* Inline new list input */}
        {creatingList && (
          <div
            className="flex items-center gap-2 px-4 py-3 border-t"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
          >
            <ShoppingCart size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              ref={newListInputRef}
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateList();
                if (e.key === "Escape") { setCreatingList(false); setNewListName(""); }
              }}
              placeholder="Nazwa nowej listy zakupów…"
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
            />
            <button
              onClick={() => void handleCreateList()}
              disabled={!newListName.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                backgroundColor: newListName.trim() ? "var(--accent-blue)" : "var(--bg-elevated)",
                color: newListName.trim() ? "#fff" : "var(--text-muted)",
                cursor: newListName.trim() ? "pointer" : "not-allowed",
                flexShrink: 0,
              }}
            >
              <ArrowRight size={12} />
              Utwórz
            </button>
            <button
              onClick={() => { setCreatingList(false); setNewListName(""); }}
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PaletteItem({
  icon, label, shortcut, onSelect, active,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onSelect: () => void;
  active?: boolean;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer focus:outline-none"
      style={
        {
          color: active ? "var(--accent-blue)" : "var(--text-primary)",
          "--cmdk-item-selected-bg": "var(--bg-hover)",
        } as React.CSSProperties
      }
    >
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </Command.Item>
  );
}
