"use client";

import { useState, useCallback, useMemo, useTransition, useEffect } from "react";
import { useCommandPalette } from "@/components/command-palette/CommandPaletteProvider";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { ListDropdown } from "./ListDropdown";
import { FilterTabs } from "./FilterTabs";
import { ItemList } from "./ItemList";
import { SearchBar } from "./SearchBar";
import { SortControl } from "./SortControl";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { updateItemStatus, deleteItem } from "@/actions/items";
import { computeOptimalCategoryOrder } from "@/lib/storeRoute";
import type { ShoppingListWithItems, ShoppingList, FilterTab, Item, ItemStatus, SortMode, StoreWithGraph } from "@/types";
import { FILTER_TABS, STATUS_CYCLE } from "@/types";

const SORT_STORAGE_KEY = "wom_shopping_sort";

interface ShoppingPageProps {
  list: ShoppingListWithItems;
  allLists: ShoppingList[];
  categoryEmojiMap?: Record<string, string>;
  stores: StoreWithGraph[];
}

function loadSortMode(): SortMode {
  if (typeof window === "undefined") return { type: "category" };
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) return { type: "category" };
    const parsed = JSON.parse(raw) as SortMode;
    if (parsed.type === "category" || parsed.type === "product" || parsed.type === "store") {
      return parsed;
    }
  } catch {
    // ignore
  }
  return { type: "category" };
}

export function ShoppingPage({ list, allLists, categoryEmojiMap, stores }: ShoppingPageProps) {
  const { toggle: togglePalette } = useCommandPalette();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>({ type: "category" });
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSortMode(loadSortMode());
  }, []);

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(mode));
    } catch {
      // ignore
    }
  }

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

  const categoryOrder = useMemo(() => {
    if (sortMode.type !== "store") return undefined;
    const store = stores.find(s => s.id === sortMode.storeId);
    if (!store) return undefined;
    const presentCategories = [...new Set(filteredItems.map(i => i.category))];
    return computeOptimalCategoryOrder(store.nodes, store.edges, presentCategories);
  }, [sortMode, stores, filteredItems]);

  const { rowRefs, navigateDown, navigateUp } = useItemNavigation(
    filteredItems,
    focusedItemId,
    setFocusedItemId
  );

  const handlers = useMemo(
    () => ({
      onQuickAdd: () => {},
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
    [focusedItemId, filteredItems, navigateDown, navigateUp, togglePalette, isSearchOpen, editingItemId]
  );

  useKeyboardShortcuts(handlers);

  const statsText = [
    counts.NEEDED > 0 && `${counts.NEEDED} needed`,
    counts.IN_CART > 0 && `${counts.IN_CART} in cart`,
    counts.DONE > 0 && `${counts.DONE} done`,
    counts.MISSING > 0 && `${counts.MISSING} missing`,
  ].filter(Boolean).join(" · ");

  const sortBy = sortMode.type === "product" ? "product" : "category";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <ListDropdown allLists={allLists} currentListId={list.id} />
        <div className="flex-1" />
        <SortControl sortMode={sortMode} stores={stores} onChange={handleSortChange} />
        <a
          href="/shopping/stores"
          className="text-xs px-2 py-1 rounded"
          style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}
          title="Mapy sklepów"
        >
          🏪
        </a>
        <span className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>
          {statsText}
        </span>
      </div>

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
        categoryOrder={categoryOrder}
        sortBy={sortBy}
      />

      <CommandPalette
        listId={list.id}
        allLists={allLists}
        onFocusQuickAdd={() => {}}
      />

    </div>
  );
}
