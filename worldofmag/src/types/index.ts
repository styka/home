import type { Item as PrismaItem, ShoppingList as PrismaShoppingList, ItemHistory, Product as PrismaProduct, Note as PrismaNote, NoteGroup, Tag } from "@prisma/client";

export type { ItemHistory };

export type Product = PrismaProduct;

export const UNITS: Array<{ value: string; label: string }> = [
  { value: "szt",     label: "szt" },
  { value: "kg",      label: "kg" },
  { value: "dkg",     label: "dkg" },
  { value: "g",       label: "g" },
  { value: "l",       label: "l" },
  { value: "ml",      label: "ml" },
  { value: "op",      label: "op" },
  { value: "paczka",  label: "paczka" },
  { value: "butelka", label: "butelka" },
  { value: "puszka",  label: "puszka" },
  { value: "torebka", label: "torebka" },
  { value: "słoik",   label: "słoik" },
];

export type ShoppingList = PrismaShoppingList & {
  ownerTeam?: { id: string; name: string } | null;
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

// ─── Notes ────────────────────────────────────────────────────────────────

export type { NoteGroup, Tag };

export type Note = PrismaNote & {
  group: NoteGroup | null;
  tags: Array<{ tag: Tag }>;
};

export type NoteFilter = "ALL" | "PINNED" | "NO_GROUP" | "SEARCH";

export const NOTE_FILTER_LABELS: Record<NoteFilter, string> = {
  ALL: "Wszystkie",
  PINNED: "Przypięte",
  NO_GROUP: "Bez grupy",
  SEARCH: "Szukaj",
};

// ─── Shared ───────────────────────────────────────────────────────────────

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
