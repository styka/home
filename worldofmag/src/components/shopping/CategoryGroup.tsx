"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import {
  DndContext, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Item } from "@/types";
import { ItemRow } from "./ItemRow";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { IconDisplay } from "@/components/shopping/IconDisplay";
import { reorderItems } from "@/actions/items";


interface CategoryGroupProps {
  category: string;
  items: Item[];
  listId: string;
  focusedItemId: string | null;
  editingItemId: string | null;
  onItemFocus: (id: string) => void;
  onItemStartEdit: (id: string) => void;
  onItemStopEdit: () => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  emojiOverride?: string;
  otherLists?: { id: string; name: string }[];
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

const isSvg = (s: string) => s.trimStart().startsWith("<");
const isDataImage = (s: string) => s.startsWith("data:image/");

export function CategoryGroup({
  category,
  items,
  listId,
  focusedItemId,
  editingItemId,
  onItemFocus,
  onItemStartEdit,
  onItemStopEdit,
  rowRefs,
  emojiOverride,
  otherLists,
}: CategoryGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Optimistic local override: null means "use server-side emojiOverride or default"
  const [localIcon, setLocalIcon] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Z-221 (T-03): optymistyczna kolejność DnD trzymana jako lista ID. Render bierze
  // świeże obiekty z propsów (status/treść aktualne), a kolejność z `orderIds`, więc
  // przeciągnięcie nie miga przy revalidacji. Resync TYLKO przy zmianie składu (add/del),
  // zachowując ręczne ułożenie pozostałych pozycji.
  const [orderIds, setOrderIds] = useState<string[]>(() => items.map((i) => i.id));
  useEffect(() => {
    setOrderIds((prev) => {
      const present = new Set(items.map((i) => i.id));
      const kept = prev.filter((id) => present.has(id));
      const added = items.filter((i) => !prev.includes(i.id)).map((i) => i.id);
      const next = [...kept, ...added];
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
  }, [items]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const ordered = useMemo(
    () => orderIds.map((id) => byId.get(id)).filter((x): x is Item => !!x),
    [orderIds, byId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    setOrderIds((prev) => {
      const oldIndex = prev.indexOf(activeId);
      const newIndex = prev.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      startTransition(() => { void reorderItems(listId, category, next); });
      return next;
    });
  }

  const serverIcon = emojiOverride ?? null;
  const effectiveIcon = localIcon ?? serverIcon ?? "📦";
  const doneCount = items.filter((i) => i.status === "DONE").length;

  return (
    <>
      <div
        className="flex items-center w-full"
        style={{ backgroundColor: "var(--bg-surface)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--bg-elevated)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--bg-surface)"; }}
      >
        {/* Collapse button */}
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

        {/* Icon button — opens picker */}
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center justify-center shrink-0 rounded-lg mr-2 transition-colors"
          style={{ width: 32, height: 32, color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
          title="Zmień ikonę kategorii"
          aria-label="Zmień ikonę kategorii"
        >
          {isSvg(effectiveIcon) ? (
            <SvgIcon content={effectiveIcon} size={18} />
          ) : isDataImage(effectiveIcon) ? (
            <img src={effectiveIcon} alt="" width={18} height={18} style={{ objectFit: "contain", borderRadius: 2 }} />
          ) : (
            <span style={{ fontSize: 18, lineHeight: 1 }}>{effectiveIcon}</span>
          )}
        </button>
      </div>

      {!collapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
            {ordered.map((item) => (
              <SortableItemRow
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
                otherLists={otherLists}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      <CategoryIconPicker
        category={category}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(svg) => setLocalIcon(svg)}
        onReset={() => setLocalIcon(null)}
      />
    </>
  );
}

// Z-221 (T-03): wiersz przeciągalny — useSortable + uchwyt (GripVertical). Sam wiersz
// pozostaje w pełni interaktywny (klik/edycja/status); przeciąga się TYLKO za uchwyt,
// więc dotyk/klik na treści nie wszczyna draga. W trybie edycji DnD wyłączony.
function SortableItemRow({
  item, isFocused, isEditing, onFocus, onStartEdit, onStopEdit, rowRef, otherLists,
}: {
  item: Item;
  isFocused: boolean;
  isEditing: boolean;
  onFocus: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
  otherLists?: { id: string; name: string }[];
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: isEditing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: "relative",
    zIndex: isDragging ? 20 : undefined,
  };

  const handle = isEditing ? undefined : (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className="flex-shrink-0 flex items-center justify-center cursor-grab touch-none opacity-0 group-hover:opacity-100 focus:opacity-100"
      style={{ width: 18, height: 24, color: "var(--text-muted)", marginLeft: -6, marginRight: -2 }}
      aria-label="Przeciągnij, aby zmienić kolejność"
      title="Przeciągnij, aby zmienić kolejność"
    >
      <GripVertical size={14} />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <ItemRow
        item={item}
        isFocused={isFocused}
        isEditing={isEditing}
        onFocus={onFocus}
        onStartEdit={onStartEdit}
        onStopEdit={onStopEdit}
        rowRef={rowRef}
        otherLists={otherLists}
        dragHandle={handle}
      />
    </div>
  );
}
