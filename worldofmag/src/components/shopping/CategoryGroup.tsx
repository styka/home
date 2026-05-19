"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Item } from "@/types";
import { ItemRow } from "./ItemRow";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { useCategoryIcons } from "@/hooks/useCategoryIcons";

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
  emojiOverride?: string;
}

function SvgIcon({ content, size = 14 }: { content: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: content }}
      aria-hidden
    />
  );
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
  emojiOverride,
}: CategoryGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { icons, setIcon, resetIcon } = useCategoryIcons();
  const localIcon = icons[category];

  const isSvg = (s: string) => s.trimStart().startsWith("<");
  const fallbackEmoji = emojiOverride ?? CATEGORY_ICONS[category] ?? "📦";

  const doneCount = items.filter((i) => i.status === "DONE").length;

  return (
    <>
      <div
        className="flex items-center w-full"
        style={{ backgroundColor: "var(--bg-surface)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--bg-elevated)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--bg-surface)"; }}
      >
        {/* Collapse button — takes up most of the row */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex-1 flex items-center gap-2 px-4 py-1.5 text-left focus:outline-none min-w-0"
        >
          {collapsed ? (
            <ChevronRight size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          ) : (
            <ChevronDown size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          )}
          <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {category}
          </span>
          <span
            className="text-xs px-1 rounded shrink-0"
            style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
          >
            {doneCount}/{items.length}
          </span>
        </button>

        {/* Icon button — tappable to open picker */}
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center justify-center shrink-0 rounded-lg mr-2 transition-colors"
          style={{
            width: 32,
            height: 32,
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
          title="Zmień ikonę kategorii"
          aria-label="Zmień ikonę kategorii"
        >
          {localIcon && isSvg(localIcon) ? (
            <SvgIcon content={localIcon} size={15} />
          ) : (
            <span className="text-sm leading-none select-none">
              {localIcon && !isSvg(localIcon) ? localIcon : fallbackEmoji}
            </span>
          )}
        </button>
      </div>

      {!collapsed &&
        items.map((item) => (
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

      <CategoryIconPicker
        category={category}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(svg) => setIcon(category, svg)}
        onReset={() => resetIcon(category)}
      />
    </>
  );
}
