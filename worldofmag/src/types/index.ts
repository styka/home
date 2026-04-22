import type { Item as PrismaItem, ShoppingList, ItemHistory, Thought, ThoughtAttachment } from "@prisma/client";

export type { ShoppingList, ItemHistory, Thought, ThoughtAttachment };

export type ThoughtWithAttachments = Thought & {
  attachments: ThoughtAttachment[];
};

export type ItemStatus = "NEEDED" | "IN_CART" | "DONE" | "MISSING";

export type Item = Omit<PrismaItem, "status"> & { status: ItemStatus };

export type ShoppingListWithItems = ShoppingList & {
  items: Item[];
};

export type FilterTab = "ALL" | "NEEDED" | "IN_CART" | "DONE" | "MISSING";

export const FILTER_TABS: FilterTab[] = ["ALL", "NEEDED", "IN_CART", "DONE", "MISSING"];

export const FILTER_LABELS: Record<FilterTab, string> = {
  ALL: "All",
  NEEDED: "Needed",
  IN_CART: "In Cart",
  DONE: "Done",
  MISSING: "Missing",
};

export const STATUS_CYCLE: ItemStatus[] = ["NEEDED", "IN_CART", "DONE"];

export interface ParsedItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface ShortcutHandlers {
  onQuickAdd: () => void;
  onNavigateDown: () => void;
  onNavigateUp: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSearch: () => void;
  onFilterTab: (index: number) => void;
  onCommandPalette: () => void;
  onEscape: () => void;
}
