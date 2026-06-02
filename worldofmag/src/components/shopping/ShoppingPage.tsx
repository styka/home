"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, CheckCircle2 } from "lucide-react";
import { useCommandPalette } from "@/components/command-palette/CommandPaletteProvider";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { FilterTabs } from "./FilterTabs";
import { ItemList } from "./ItemList";
import { SearchBar } from "./SearchBar";
import { SortControl } from "./SortControl";
import { QuickAddBar } from "./QuickAddBar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { updateItemStatus, deleteItem, clearDoneItems } from "@/actions/items";
import { archiveList } from "@/actions/lists";
import { computeOptimalCategoryOrder } from "@/lib/storeRoute";
import type { ShoppingListWithItems, ShoppingList, FilterTab, Item, ItemStatus, SortMode, StoreWithGraph } from "@/types";
import { FILTER_TABS, STATUS_CYCLE } from "@/types";

const SORT_STORAGE_KEY = "wom_shopping_sort";

interface ShoppingPageProps {
  list: ShoppingListWithItems;
  allLists: ShoppingList[];
  categoryEmojiMap?: Record<string, string>;
  categoryNames?: string[];
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

export function ShoppingPage({ list, allLists, categoryEmojiMap, categoryNames = [], stores }: ShoppingPageProps) {
  const router = useRouter();
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
    const presentCategories = Array.from(new Set(filteredItems.map(i => i.category)));
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
        {/* Mobile: native <select> as list switcher */}
        <div className="md:hidden flex-1 min-w-0">
          <select
            value={list.id}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__catalog__") router.push("/shopping");
              else router.push(`/shopping/${v}`);
            }}
            className="bg-transparent text-sm font-semibold focus:outline-none w-full truncate"
            style={{ color: "var(--text-primary)" }}
            aria-label="Wybierz listę zakupów"
          >
            {allLists.map((l) => (
              <option key={l.id} value={l.id}>
                🛒 {l.name}{l.ownerTeam ? ` · ${l.ownerTeam.name}` : ""}
              </option>
            ))}
            <option value="__catalog__">+ Zarządzaj listami…</option>
          </select>
        </div>

        {/* Desktop: list title — klik = strona główna działu Zakupy */}
        <h1
          className="hidden md:flex items-center gap-2 text-sm font-semibold truncate min-w-0"
          style={{ color: "var(--text-primary)" }}
        >
          <Link href="/shopping" className="truncate" style={{ color: "inherit", textDecoration: "none" }} title="Zakupy — strona główna działu">
            {list.name}
          </Link>
          {list.ownerTeam && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                color: "var(--accent-purple)",
                backgroundColor: "rgba(168,85,247,0.12)",
                border: "1px solid rgba(168,85,247,0.2)",
              }}
            >
              {list.ownerTeam.name}
            </span>
          )}
        </h1>

        <div className="flex-1" />
        {counts.DONE > 0 && (
          <button
            onClick={() => startTransition(() => clearDoneItems(list.id))}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
            style={{ color: "var(--accent-red)", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            title="Wyczyść zakończone elementy"
          >
            <Trash2 size={11} />
            <span className="hidden sm:inline">Wyczyść ({counts.DONE})</span>
            <span className="sm:hidden">{counts.DONE}</span>
          </button>
        )}
        {counts.NEEDED === 0 && counts.IN_CART === 0 && (counts.DONE + counts.MISSING) > 0 && (
          <button
            onClick={() => startTransition(async () => { await archiveList(list.id); router.push("/shopping"); })}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
            style={{ color: "var(--accent-green)", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", fontWeight: 600 }}
            title="Zakończ zakupy — zarchiwizuj listę"
          >
            <CheckCircle2 size={11} />
            <span>Zakończ zakupy</span>
          </button>
        )}
        <SortControl sortMode={sortMode} stores={stores} onChange={handleSortChange} />
        <span className="text-xs hidden md:block" style={{ color: "var(--text-muted)" }}>
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

      <QuickAddBar listId={list.id} categoryNames={categoryNames} />

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
        otherLists={allLists.filter((l) => l.id !== list.id).map((l) => ({ id: l.id, name: l.name }))}
      />

      <CommandPalette
        listId={list.id}
        allLists={allLists}
        onFocusQuickAdd={() => {}}
      />

    </div>
  );
}
