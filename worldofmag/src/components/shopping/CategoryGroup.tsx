"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Item } from "@/types";
import { ItemRow } from "./ItemRow";

const CATEGORY_ICONS: Record<string, string> = {
  "Produce": "🥕",
  "Dairy & Eggs": "🧀",
  "Meat & Fish": "🥩",
  "Bakery": "🍞",
  "Dry Goods & Pasta": "🌾",
  "Drinks": "🍺",
  "Frozen": "🧊",
  "Snacks & Sweets": "🍫",
  "Condiments & Oils": "🫙",
  "Spices & Herbs": "🌿",
  "Cleaning & Hygiene": "🧴",
  "Canned & Preserved": "🥫",
  "Other": "📦",
};

interface CategoryGroupProps {
  category: string;
  items: Item[];
  focusedItemId: string | null;
  editingItemId: string | null;
  onItemFocus: (id: string) => void;
  onItemStartEdit: (id: string) => void;
  onItemStopEdit: () => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

export function CategoryGroup({
  category,
  items,
  focusedItemId,
  editingItemId,
  onItemFocus,
  onItemStartEdit,
  onItemStopEdit,
  rowRefs,
}: CategoryGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const icon = CATEGORY_ICONS[category] ?? "📦";
  const doneCount = items.filter((i) => i.status === "DONE").length;

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-left focus:outline-none"
        style={{ backgroundColor: "var(--bg-surface)" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-elevated)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; }}
      >
        {collapsed ? (
          <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />
        )}
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {icon} {category}
        </span>
        <span
          className="text-xs ml-1 px-1 rounded"
          style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
        >
          {doneCount}/{items.length}
        </span>
      </button>

      {!collapsed && items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          isFocused={focusedItemId === item.id}
          isEditing={editingItemId === item.id}
          onFocus={() => onItemFocus(item.id)}
          onStartEdit={() => onItemStartEdit(item.id)}
          onStopEdit={onItemStopEdit}
          rowRef={(el) => {
            if (el) rowRefs.current.set(item.id, el);
            else rowRefs.current.delete(item.id);
          }}
        />
      ))}
    </div>
  );
}
