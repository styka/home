import { useCallback, useRef } from "react";
import type { Item } from "@/types";

export function useItemNavigation(
  flatItems: Item[],
  focusedItemId: string | null,
  setFocusedItemId: (id: string | null) => void
) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const scrollToItem = useCallback((id: string) => {
    const el = rowRefs.current.get(id);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const navigateDown = useCallback(() => {
    if (flatItems.length === 0) return;
    const idx = flatItems.findIndex((i) => i.id === focusedItemId);
    const nextIdx = idx === -1 ? 0 : Math.min(idx + 1, flatItems.length - 1);
    const nextId = flatItems[nextIdx].id;
    setFocusedItemId(nextId);
    scrollToItem(nextId);
  }, [flatItems, focusedItemId, setFocusedItemId, scrollToItem]);

  const navigateUp = useCallback(() => {
    if (flatItems.length === 0) return;
    const idx = flatItems.findIndex((i) => i.id === focusedItemId);
    const prevIdx = idx <= 0 ? 0 : idx - 1;
    const prevId = flatItems[prevIdx].id;
    setFocusedItemId(prevId);
    scrollToItem(prevId);
  }, [flatItems, focusedItemId, setFocusedItemId, scrollToItem]);

  return { rowRefs, navigateDown, navigateUp };
}
