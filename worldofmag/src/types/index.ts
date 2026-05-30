import type {
  Item as PrismaItem,
  ShoppingList as PrismaShoppingList,
  ItemHistory,
  Product as PrismaProduct,
  Note as PrismaNote,
  NoteGroup,
  Tag,
  Pet as PrismaPet,
  PetShare as PrismaPetShare,
  PetMeasurement as PrismaPetMeasurement,
  PetHealthRecord as PrismaPetHealthRecord,
  PetVetVisit as PrismaPetVetVisit,
  PetTreatment as PrismaPetTreatment,
  PetCareTask as PrismaPetCareTask,
  PetCareLog as PrismaPetCareLog,
  PetEnclosure as PrismaPetEnclosure,
  PetEnvironmentReading as PrismaPetEnvironmentReading,
  PetBreedingPair as PrismaPetBreedingPair,
  PetClutch as PrismaPetClutch,
  PetSale as PrismaPetSale,
} from "@prisma/client";

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

// ─── Store Maps ───────────────────────────────────────────────────────────────

export type StoreNodeType = "START" | "STOP" | "CATEGORY";

export interface StoreNodeData {
  id: string;
  storeId: string;
  label: string;
  type: string;
  category: string | null;
  x: number;
  y: number;
}

export interface StoreEdgeData {
  id: string;
  storeId: string;
  fromId: string;
  toId: string;
  weight: number;
}

export interface StoreWithGraph {
  id: string;
  name: string;
  ownerId: string | null;
  nodes: StoreNodeData[];
  edges: StoreEdgeData[];
  createdAt: Date;
  updatedAt: Date;
}

export type SortMode =
  | { type: "category" }
  | { type: "product" }
  | { type: "store"; storeId: string; storeName: string };

// ─── Pets / Zwierzęta ───────────────────────────────────────────────────────

export type {
  PrismaPetShare,
  PrismaPetMeasurement,
  PrismaPetHealthRecord,
  PrismaPetVetVisit,
  PrismaPetTreatment,
  PrismaPetCareTask,
  PrismaPetCareLog,
};

export type PetSpecies =
  | "dog" | "cat" | "snake" | "lizard" | "turtle" | "fish" | "bird" | "rodent" | "rabbit" | "other";
export type PetSex = "male" | "female" | "unknown";
export type PetStatus = "ACTIVE" | "DECEASED" | "REHOMED" | "SOLD" | "ARCHIVED";
export type PetTreatmentKind = "MEDICATION" | "VACCINE" | "DEWORMER" | "PARASITE" | "SUPPLEMENT";
export type PetCareCategory =
  | "FEEDING" | "CLEANING" | "GROOMING" | "WALK" | "WATER_CHANGE" | "UVB_REPLACEMENT" | "WEIGHING" | "CUSTOM";
export type PetHealthType = "CONDITION" | "ALLERGY" | "SYMPTOM" | "INJURY" | "NOTE" | "MILESTONE";
export type ShareRole = "VIEWER" | "EDITOR";

export type PetMeasurement = PrismaPetMeasurement;
export type PetHealthRecord = PrismaPetHealthRecord;
export type PetVetVisit = PrismaPetVetVisit;
export type PetTreatment = PrismaPetTreatment;
export type PetCareTask = PrismaPetCareTask;
export type PetCareLog = PrismaPetCareLog;
export type PetEnclosure = PrismaPetEnclosure;
export type PetEnvironmentReading = PrismaPetEnvironmentReading;
export type PetBreedingPair = PrismaPetBreedingPair;
export type PetClutch = PrismaPetClutch;
export type PetSale = PrismaPetSale;

export type PetEnclosureWithReadings = PetEnclosure & {
  readings: PetEnvironmentReading[];
};

export type PetRef = { id: string; name: string; species?: string; sex?: string | null; status?: string };

export type PetBreedingPairWithRelations = PetBreedingPair & {
  male: PetRef | null;
  female: PetRef | null;
  clutches: PetClutch[];
};

/** Dane zakładek Hodowla / Genetyka (ładowane osobno, by nie obciążać getPet). */
export interface PetBreedingData {
  genetics: string | null;
  sire: PetRef | null;
  dam: PetRef | null;
  offspring: PetRef[];
  pairs: PetBreedingPairWithRelations[];
  sales: PetSale[];
  candidates: Array<PetRef & { genetics: string | null }>;
}

export type PetShare = PrismaPetShare & {
  user?: { id: string; name: string | null; email: string | null; image: string | null } | null;
  team?: { id: string; name: string } | null;
};

export type Pet = PrismaPet & {
  ownerTeam?: { id: string; name: string } | null;
  _count?: { treatments?: number; careTasks?: number; vetVisits?: number };
};

export type PetWithRelations = Pet & {
  shares: PetShare[];
  measurements: PetMeasurement[];
  healthRecords: PetHealthRecord[];
  vetVisits: PetVetVisit[];
  treatments: PetTreatment[];
  careTasks: PetCareTask[];
  careLogs: PetCareLog[];
  enclosure: PetEnclosureWithReadings | null;
};

/** A single due/overdue/upcoming item in the unified care agenda. */
export interface CareAgendaItem {
  id: string;
  petId: string;
  petName: string;
  petSpecies: string;
  kind: "TREATMENT" | "CARE_TASK" | "VET_VISIT";
  category: string; // PetTreatmentKind | PetCareCategory | "VET"
  title: string;
  dueAt: string; // ISO
  bucket: "OVERDUE" | "TODAY" | "UPCOMING";
}

export interface WelfareSuggestion {
  id: string;
  petId: string | null;
  severity: "info" | "warning" | "danger";
  title: string;
  detail?: string;
}

// ─── Nauka języków ──────────────────────────────────────────────────────────

export type Vocabulary = {
  id: string;
  deckId: string;
  term: string;
  translation: string;
  example: string | null;
  partOfSpeech: string | null;
  notes: string | null;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
  createdAt: Date;
};

export type LanguageDeck = {
  id: string;
  name: string;
  description: string | null;
  nativeLang: string;
  targetLang: string;
  sourceText: string | null;
  ownerId: string | null;
  ownerTeamId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { cards: number };
  dueCount?: number;
};

// ─── Zdrowie ──────────────────────────────────────────────────────────────

export type HealthKind = "VISIT" | "TEST";
export type HealthStatus = "PLANNED" | "DONE" | "CANCELLED";

export type HealthEvent = {
  id: string;
  kind: HealthKind;
  title: string;
  doctorName: string | null;
  specialty: string | null;
  facility: string | null;
  location: string | null;
  scheduledAt: Date;
  status: HealthStatus;
  notes: string | null;
  result: string | null;
  referral: string | null;
  reminderAt: Date | null;
  ownerId: string | null;
  ownerTeamId: string | null;
  createdAt: Date;
  updatedAt: Date;
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
