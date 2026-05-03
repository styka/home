import type { Item as PrismaItem, ShoppingList as PrismaShoppingList, ItemHistory } from "@prisma/client";

export type { ItemHistory };

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

// ─── User management ──────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "USER"
export type TeamMemberRole = "OWNER" | "ADMIN" | "MEMBER"
export type InvitationStatus = "PENDING" | "ACCEPTED" | "REJECTED"
export type SharePermission = "VIEW" | "EDIT" | "MANAGE"
export type ResourceType = "ShoppingList" | "Action"

// "user:me" = własna przestrzeń, "team:<id>" = przestrzeń teamu, "all" = wszystko
export type WorkspaceId = "user:me" | `team:${string}` | "all"

// ─── Quick Actions ────────────────────────────────────────────────────────

export type ActionStatus = "ACTIVE" | "IN_PROGRESS" | "DONE" | "ARCHIVED"
export type ActionComponentType = "LINK_BUTTON" | "WEATHER_GENERATOR"
export type RecurPattern = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
export type NextDueDateBasis = "PLANNED" | "COMPLETION"

