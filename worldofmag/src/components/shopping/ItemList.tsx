import type { Item } from "@/types";
import { CategoryGroup } from "./CategoryGroup";
import { ItemRow } from "./ItemRow";

interface ItemListProps {
  items: Item[];
  focusedItemId: string | null;
  editingItemId: string | null;
  onItemFocus: (id: string) => void;
  onItemStartEdit: (id: string) => void;
  onItemStopEdit: () => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  categoryEmojiMap?: Record<string, string>;
  categoryOrder?: string[];
  sortBy?: "category" | "product";
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
  categoryOrder,
  sortBy = "category",
}: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center" style={{ color: "var(--text-muted)" }}>
          <p className="text-sm">Brak produktów.</p>
          <p className="text-xs mt-1">Naciśnij <kbd>a</kbd>, aby dodać.</p>
        </div>
      </div>
    );
  }

  if (sortBy === "product") {
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, "pl"));
    return (
      <div className="flex-1 overflow-y-auto">
        {sorted.map((item) => (
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

  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const cat = item.category ?? "Other";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  let sortedEntries = Array.from(groups.entries());
  if (categoryOrder && categoryOrder.length > 0) {
    const orderMap = new Map(categoryOrder.map((cat, i) => [cat, i]));
    sortedEntries = sortedEntries.sort(([a], [b]) => {
      const ai = orderMap.has(a) ? orderMap.get(a)! : Infinity;
      const bi = orderMap.has(b) ? orderMap.get(b)! : Infinity;
      if (ai === Infinity && bi === Infinity) return a.localeCompare(b, "pl");
      return ai - bi;
    });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {sortedEntries.map(([category, groupItems]) => (
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
