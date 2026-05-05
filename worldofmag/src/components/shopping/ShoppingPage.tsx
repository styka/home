"use client";

import { useState, useCallback, useMemo, useRef, useTransition } from "react";
import { Sparkles, PenLine } from "lucide-react";
import { useCommandPalette } from "@/components/command-palette/CommandPaletteProvider";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { ListDropdown } from "./ListDropdown";
import { LLMInputSection } from "./LLMInputSection";
import { QuickAddBar, type QuickAddBarHandle } from "./QuickAddBar";
import { FilterTabs } from "./FilterTabs";
import { ItemList } from "./ItemList";
import { SearchBar } from "./SearchBar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { updateItemStatus, deleteItem } from "@/actions/items";
import type { ShoppingListWithItems, ShoppingList, FilterTab, Item, ItemStatus } from "@/types";
import { FILTER_TABS, STATUS_CYCLE } from "@/types";

type AddMode = "ai" | "manual";

interface ShoppingPageProps {
  list: ShoppingListWithItems;
  allLists: ShoppingList[];
  categoryEmojiMap?: Record<string, string>;
  categoryNames?: string[];
}

export function ShoppingPage({ list, allLists, categoryEmojiMap, categoryNames }: ShoppingPageProps) {
  const { toggle: togglePalette } = useCommandPalette();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("ai");
  const [, startTransition] = useTransition();
  const quickAddRef = useRef<QuickAddBarHandle>(null);

  const filteredItems = useMemo(() => {
    let items = list.items as Item[];
    if (activeFilter !== "ALL") {
      items = items.filter((i) => i.status === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.notes?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [list.items, activeFilter, searchQuery]);

  const counts = useMemo(() => {
    const result = {} as Record<FilterTab, number>;
    for (const tab of FILTER_TABS) {
      result[tab] = tab === "ALL"
        ? list.items.length
        : list.items.filter((i) => i.status === tab).length;
    }
    return result;
  }, [list.items]);

  const { rowRefs, navigateDown, navigateUp } = useItemNavigation(
    filteredItems,
    focusedItemId,
    setFocusedItemId
  );

  const handlers = useMemo(
    () => ({
      onQuickAdd: () => {
        setAddMode("manual");
        setTimeout(() => quickAddRef.current?.focus(), 10);
      },
      onNavigateDown: navigateDown,
      onNavigateUp: navigateUp,
      onToggleStatus: () => {
        if (!focusedItemId) return;
        const item = filteredItems.find((i) => i.id === focusedItemId);
        if (!item) return;
        const idx = STATUS_CYCLE.indexOf(item.status as "NEEDED" | "IN_CART" | "DONE");
        const next: ItemStatus =
          idx === -1 || idx === STATUS_CYCLE.length - 1
            ? STATUS_CYCLE[0]
            : STATUS_CYCLE[idx + 1];
        startTransition(() => { updateItemStatus(focusedItemId, next); });
      },
      onDelete: () => {
        if (!focusedItemId) return;
        const idx = filteredItems.findIndex((i) => i.id === focusedItemId);
        const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
        setFocusedItemId(nextItem?.id ?? null);
        startTransition(() => { deleteItem(focusedItemId); });
      },
      onEdit: () => {
        if (!focusedItemId) return;
        setEditingItemId(focusedItemId);
      },
      onSearch: () => setIsSearchOpen(true),
      onFilterTab: (index: number) => setActiveFilter(FILTER_TABS[index] ?? "ALL"),
      onCommandPalette: togglePalette,
      onEscape: () => {
        if (isSearchOpen) { setSearchQuery(""); setIsSearchOpen(false); return; }
        if (editingItemId) { setEditingItemId(null); return; }
        setFocusedItemId(null);
      },
    }),
    [focusedItemId, filteredItems, navigateDown, navigateUp, togglePalette, isSearchOpen, editingItemId, startTransition]
  );

  useKeyboardShortcuts(handlers);

  const statsText = [
    counts.NEEDED > 0 && `${counts.NEEDED} needed`,
    counts.IN_CART > 0 && `${counts.IN_CART} in cart`,
    counts.DONE > 0 && `${counts.DONE} done`,
    counts.MISSING > 0 && `${counts.MISSING} missing`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <ListDropdown allLists={allLists} currentListId={list.id} />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {statsText}
        </span>
      </div>

      {/* Add mode toggle */}
      <div
        className="flex border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <button
          onClick={() => setAddMode("ai")}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium focus:outline-none"
          style={{
            color: addMode === "ai" ? "var(--accent-blue)" : "var(--text-muted)",
            borderBottom: addMode === "ai" ? "2px solid var(--accent-blue)" : "2px solid transparent",
            marginBottom: -1,
          }}
        >
          <Sparkles size={11} />
          AI
        </button>
        <button
          onClick={() => setAddMode("manual")}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium focus:outline-none"
          style={{
            color: addMode === "manual" ? "var(--accent-green)" : "var(--text-muted)",
            borderBottom: addMode === "manual" ? "2px solid var(--accent-green)" : "2px solid transparent",
            marginBottom: -1,
          }}
        >
          <PenLine size={11} />
          Ręcznie
        </button>
      </div>

      {/* Active add section */}
      {addMode === "ai" ? (
        <LLMInputSection listId={list.id} categoryNames={categoryNames ?? []} />
      ) : (
        <QuickAddBar ref={quickAddRef} listId={list.id} categoryNames={categoryNames ?? []} />
      )}

      {isSearchOpen && (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onClose={() => { setSearchQuery(""); setIsSearchOpen(false); }}
        />
      )}

      <FilterTabs
        active={activeFilter}
        counts={counts}
        onChange={setActiveFilter}
      />

      <ItemList
        items={filteredItems}
        focusedItemId={focusedItemId}
        editingItemId={editingItemId}
        onItemFocus={setFocusedItemId}
        onItemStartEdit={setEditingItemId}
        onItemStopEdit={() => setEditingItemId(null)}
        rowRefs={rowRefs}
        categoryEmojiMap={categoryEmojiMap}
      />

      <CommandPalette
        listId={list.id}
        allLists={allLists}
        onFocusQuickAdd={() => {
          setAddMode("manual");
          setTimeout(() => quickAddRef.current?.focus(), 10);
        }}
      />
    </div>
  );
}
