"use client";

import { useState, useCallback, useMemo, useRef, useTransition } from "react";
import { useCommandPalette } from "@/components/command-palette/CommandPaletteProvider";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { ListPicker } from "./ListPicker";
import { QuickAddBar, type QuickAddBarHandle } from "./QuickAddBar";
import { FilterTabs } from "./FilterTabs";
import { ItemList } from "./ItemList";
import { SearchBar } from "./SearchBar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { updateItemStatus, deleteItem } from "@/actions/items";
import type { ShoppingListWithItems, ShoppingList, FilterTab, Item, ItemStatus } from "@/types";
import { FILTER_TABS, STATUS_CYCLE } from "@/types";

interface ShoppingPageProps {
  list: ShoppingListWithItems;
  allLists: ShoppingList[];
}

export function ShoppingPage({ list, allLists }: ShoppingPageProps) {
  const { toggle: togglePalette } = useCommandPalette();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const quickAddRef = useRef<QuickAddBarHandle>(null);

  // Filtered items
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

  // Tab counts
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

  // Keyboard handlers
  const handlers = useMemo(
    () => ({
      onQuickAdd: () => quickAddRef.current?.focus(),
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
        // Move focus to next item before deleting
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {list.name}
        </h1>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {counts.NEEDED > 0 && `${counts.NEEDED} needed`}
          {counts.IN_CART > 0 && ` · ${counts.IN_CART} in cart`}
          {counts.DONE > 0 && ` · ${counts.DONE} done`}
          {counts.MISSING > 0 && ` · ${counts.MISSING} missing`}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List picker sidebar */}
        <ListPicker allLists={allLists} currentListId={list.id} />

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <QuickAddBar ref={quickAddRef} listId={list.id} />

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
          />
        </div>
      </div>

      <CommandPalette
        listId={list.id}
        allLists={allLists}
        onFocusQuickAdd={() => quickAddRef.current?.focus()}
      />
    </div>
  );
}
