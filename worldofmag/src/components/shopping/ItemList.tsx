import type { Item } from "@/types";
import { CategoryGroup } from "./CategoryGroup";

interface ItemListProps {
  items: Item[];
  focusedItemId: string | null;
  editingItemId: string | null;
  onItemFocus: (id: string) => void;
  onItemStartEdit: (id: string) => void;
  onItemStopEdit: () => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  categoryEmojiMap?: Record<string, string>;
}

export function ItemList({
  items,
  focusedItemId,
  editingItemId,
  onItemFocus,
  onItemStartEdit,
  onItemStopEdit,
  rowRefs,
  categoryEmojiMap,
}: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center" style={{ color: "var(--text-muted)" }}>
          <p className="text-sm">No items here.</p>
          <p className="text-xs mt-1">Press <kbd>a</kbd> to add one.</p>
        </div>
      </div>
    );
  }

  // Group by category, preserving insertion order within each group
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const cat = item.category ?? "Other";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {Array.from(groups.entries()).map(([category, groupItems]) => (
        <CategoryGroup
          key={category}
          category={category}
          items={groupItems}
          focusedItemId={focusedItemId}
          editingItemId={editingItemId}
          onItemFocus={onItemFocus}
          onItemStartEdit={onItemStartEdit}
          onItemStopEdit={onItemStopEdit}
          rowRefs={rowRefs}
          emojiOverride={categoryEmojiMap?.[category]}
        />
      ))}
    </div>
  );
}
