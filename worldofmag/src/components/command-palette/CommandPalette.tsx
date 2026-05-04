"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { ShoppingCart, Plus, Trash2, CheckCheck, X, Package } from "lucide-react";
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

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  function run(fn: () => void) {
    setOpen(false);
    setTimeout(fn, 50);
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
              placeholder="Type a command or search lists…"
              className="flex-1 py-3 bg-transparent text-sm focus:outline-none"
              style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
            />
            <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)" }}>
              <X size={14} />
            </button>
          </div>
          <Command.List className="overflow-y-auto" style={{ maxHeight: "360px" }}>
            <Command.Empty className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No commands found.
            </Command.Empty>

            <Command.Group
              heading="Shopping"
              className="py-1"
              style={{ color: "var(--text-muted)" } as React.CSSProperties}
            >
              <PaletteItem
                icon={<Plus size={14} />}
                label="Add item"
                shortcut="a"
                onSelect={() => run(onFocusQuickAdd)}
              />
              <PaletteItem
                icon={<CheckCheck size={14} />}
                label="Mark all needed → in cart"
                onSelect={() => run(() => startTransition(() => markAllInCart(listId)))}
              />
              <PaletteItem
                icon={<Trash2 size={14} />}
                label="Clear done items"
                onSelect={() => run(() => startTransition(() => clearDoneItems(listId)))}
              />
              <PaletteItem
                icon={<Package size={14} />}
                label="Katalog produktów"
                onSelect={() => run(() => router.push("/shopping/products"))}
              />
              <PaletteItem
                icon={<Plus size={14} />}
                label="New shopping list"
                onSelect={() => run(async () => {
                  const name = prompt("List name:");
                  if (name?.trim()) {
                    const list = await createList(name.trim());
                    router.push(`/shopping/${list.id}`);
                  }
                })}
              />
            </Command.Group>

            {allLists.length > 0 && (
              <Command.Group
                heading="Go to list"
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
      </div>
    </div>
  );
}

function PaletteItem({
  icon,
  label,
  shortcut,
  onSelect,
  active,
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
