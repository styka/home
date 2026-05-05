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

// ─── Tasks ────────────────────────────────────────────────────────────────

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "DEFERRED";
export type TaskPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface RecurringRule {
  type: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  daysOfWeek?: number[];   // 0=Sun…6=Sat, used for WEEKLY
  dayOfMonth?: number;     // 1-31, used for MONTHLY
  endDate?: string | null;
}

export type TaskTagDef = {
  id: string;
  name: string;
  color: string;
};

export type TaskProject = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  emoji: string;
  isInbox: boolean;
  ownerId: string | null;
  ownerTeamId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { tasks: number };
  members?: { userId: string; role: string }[];
};

export type TaskCommentType = {
  id: string;
  taskId: string;
  userId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string | null; image: string | null } | null;
};

export type TaskShareType = {
  id: string;
  taskId: string;
  userId: string | null;
  teamId: string | null;
  role: string;
  user?: { id: string; name: string | null; email: string | null; image: string | null } | null;
  team?: { id: string; name: string } | null;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  startDate: Date | null;
  completedAt: Date | null;
  estimatedMins: number | null;
  recurring: string | null;
  category: string;
  order: number;
  projectId: string | null;
  parentTaskId: string | null;
  createdById: string | null;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  project?: TaskProject | null;
  subtasks?: Task[];
  tags?: { tag: TaskTagDef }[];
  comments?: TaskCommentType[];
  shares?: TaskShareType[];
  assignee?: { id: string; name: string | null; email: string | null; image: string | null } | null;
  _count?: { subtasks: number; comments: number };
};

export type TaskWithRelations = Task & {
  tags: { tag: TaskTagDef }[];
  subtasks: Task[];
  comments: TaskCommentType[];
  shares: TaskShareType[];
  assignee: { id: string; name: string | null; email: string | null; image: string | null } | null;
};

export type TaskFilter = "ALL" | "TODAY" | "UPCOMING" | "IN_PROGRESS" | "DONE" | "OVERDUE";

export const TASK_FILTERS: TaskFilter[] = ["ALL", "TODAY", "UPCOMING", "IN_PROGRESS", "DONE", "OVERDUE"];

export const TASK_FILTER_LABELS: Record<TaskFilter, string> = {
  ALL: "Wszystkie",
  TODAY: "Dziś",
  UPCOMING: "Nadchodzące",
  IN_PROGRESS: "W trakcie",
  DONE: "Zrobione",
  OVERDUE: "Zaległe",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Do zrobienia",
  IN_PROGRESS: "W trakcie",
  DONE: "Zrobione",
  CANCELLED: "Anulowane",
  DEFERRED: "Odłożone",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  NONE: "Brak",
  LOW: "Niski",
  MEDIUM: "Średni",
  HIGH: "Wysoki",
  URGENT: "Pilne",
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  NONE: "var(--text-muted)",
  LOW: "#3b82f6",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  URGENT: "#dc2626",
};

export const TASK_STATUS_CYCLE: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

export type TaskStatusFilter = "ALL" | TaskStatus;
export const TASK_STATUS_FILTERS: TaskStatusFilter[] = ["ALL", "TODO", "IN_PROGRESS", "DONE", "DEFERRED", "CANCELLED"];
export const TASK_STATUS_FILTER_LABELS: Record<TaskStatusFilter, string> = {
  ALL: "Wszystkie",
  TODO: "Do zrobienia",
  IN_PROGRESS: "W trakcie",
  DONE: "Zrobione",
  DEFERRED: "Odłożone",
  CANCELLED: "Anulowane",
};

export type ViewMode = "today" | "upcoming" | "overdue" | "all" | "project";

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
