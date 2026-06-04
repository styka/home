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

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_VERIFICATION" | "DONE" | "CANCELLED" | "DEFERRED";
export type TaskPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface RecurringRule {
  type: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  daysOfWeek?: number[];   // 0=Sun…6=Sat, used for WEEKLY
  dayOfMonth?: number;     // 1-31, used for MONTHLY
  endDate?: string | null;
  // Od czego liczyć następny termin po wykonaniu:
  //  "DUE" (domyślnie) = od terminu zadania; "COMPLETION" = od daty wykonania.
  anchor?: "DUE" | "COMPLETION";
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
  statusConfig: string | null;
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
  IN_VERIFICATION: "W weryfikacji",
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
export const TASK_STATUS_FILTERS: TaskStatusFilter[] = ["ALL", "TODO", "IN_PROGRESS", "IN_VERIFICATION", "DONE", "DEFERRED", "CANCELLED"];
export const TASK_STATUS_FILTER_LABELS: Record<TaskStatusFilter, string> = {
  ALL: "Wszystkie",
  TODO: "Do zrobienia",
  IN_PROGRESS: "W trakcie",
  IN_VERIFICATION: "W weryfikacji",
  DONE: "Zrobione",
  DEFERRED: "Odłożone",
  CANCELLED: "Anulowane",
};

// ─── Konfigurowalne statusy zadań (per projekt) ─────────────────────────────
// Każda lista (TaskProject) może mieć własny zestaw włączonych statusów oraz
// uporządkowaną „ścieżkę" przejść (przód/tył). Zawsze można skoczyć do dowolnego
// włączonego statusu. `null` w DB ⇒ DEFAULT_STATUS_CONFIG (statusy systemowe bez weryfikacji).

export type ProjectStatusConfig = {
  enabled: TaskStatus[]; // uporządkowane — zakładki filtrów + cele „skoku"
  chain: TaskStatus[];   // uporządkowany podzbiór enabled — cykl przód/tył (x/Spacja, klik checkboxa)
};

export type SystemTaskStatus = {
  key: TaskStatus;
  label: string;
  color: string;
  defaultEnabled: boolean; // czy w nowym projekcie status jest domyślnie widoczny
  defaultInChain: boolean; // czy domyślnie należy do ścieżki przejść
  isTerminal: boolean;     // status „zamykający" (DONE/CANCELLED) — ukrywany w widoku aktywnych
};

export const SYSTEM_TASK_STATUSES: SystemTaskStatus[] = [
  { key: "TODO",            label: "Do zrobienia",  color: "var(--text-muted)",   defaultEnabled: true,  defaultInChain: true,  isTerminal: false },
  { key: "IN_PROGRESS",     label: "W trakcie",     color: "var(--accent-blue)",  defaultEnabled: true,  defaultInChain: true,  isTerminal: false },
  { key: "IN_VERIFICATION", label: "W weryfikacji", color: "var(--accent-amber)", defaultEnabled: false, defaultInChain: false, isTerminal: false },
  { key: "DONE",            label: "Zrobione",      color: "var(--accent-green)", defaultEnabled: true,  defaultInChain: true,  isTerminal: true  },
  { key: "DEFERRED",        label: "Odłożone",      color: "var(--accent-amber)", defaultEnabled: true,  defaultInChain: false, isTerminal: false },
  { key: "CANCELLED",       label: "Anulowane",     color: "var(--text-muted)",   defaultEnabled: true,  defaultInChain: false, isTerminal: true  },
];

const ALL_STATUS_KEYS: TaskStatus[] = SYSTEM_TASK_STATUSES.map((s) => s.key);

export const DEFAULT_STATUS_CONFIG: ProjectStatusConfig = {
  enabled: SYSTEM_TASK_STATUSES.filter((s) => s.defaultEnabled).map((s) => s.key),
  chain: SYSTEM_TASK_STATUSES.filter((s) => s.defaultInChain).map((s) => s.key),
};

export function statusMeta(key: TaskStatus): SystemTaskStatus {
  return SYSTEM_TASK_STATUSES.find((s) => s.key === key) ?? SYSTEM_TASK_STATUSES[0];
}

/** Parsuje JSON statusConfig z DB; przy braku/uszkodzeniu zwraca konfigurację domyślną. */
export function parseStatusConfig(json: string | null | undefined): ProjectStatusConfig {
  if (!json) return DEFAULT_STATUS_CONFIG;
  try {
    const raw = JSON.parse(json) as Partial<ProjectStatusConfig>;
    const enabled = (raw.enabled ?? []).filter((s): s is TaskStatus => ALL_STATUS_KEYS.includes(s as TaskStatus));
    if (enabled.length === 0) return DEFAULT_STATUS_CONFIG;
    const chain = (raw.chain ?? []).filter((s): s is TaskStatus => enabled.includes(s as TaskStatus));
    return { enabled, chain: chain.length ? chain : enabled.slice(0, 1) };
  } catch {
    return DEFAULT_STATUS_CONFIG;
  }
}

export function serializeStatusConfig(cfg: ProjectStatusConfig): string {
  return JSON.stringify({ enabled: cfg.enabled, chain: cfg.chain });
}

export type ViewMode = "today" | "upcoming" | "overdue" | "all" | "project" | "multi";

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
  learnedCount?: number;
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

// ─── Leki i pielęgnacja (harmonogram podawania) ─────────────────────────────

export type MedicationKind = "MEDICATION" | "CARE";
export type MedicationFreqType = "DAILY" | "WEEKLY" | "HOURLY";
export type MedicationOutcome = "TAKEN" | "SKIPPED";

export type MedicationSchedule = {
  id: string;
  kind: MedicationKind;
  name: string;
  dosage: string | null;
  route: string | null;
  reason: string | null;
  instructions: string | null;
  freqType: MedicationFreqType;
  interval: number;
  daysOfWeek: string | null;
  timesOfDay: string | null;
  hourlyStart: string | null;
  hourlyEnd: string | null;
  startDate: Date;
  endDate: Date | null;
  active: boolean;
  notes: string | null;
  ownerId: string | null;
  ownerTeamId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MedicationLog = {
  id: string;
  scheduleId: string;
  date: string;
  slot: string;
  outcome: MedicationOutcome;
  takenAt: Date;
  note: string | null;
};

/** Pojedynczy slot dawki/czynności na dany dzień — wynik rozwinięcia harmonogramu. */
export type DoseSlot = {
  scheduleId: string;
  kind: MedicationKind;
  name: string;
  dosage: string | null;
  instructions: string | null;
  slot: string; // "HH:MM"
  done: boolean;
  outcome: MedicationOutcome | null;
};

// ─── Nawyki ───────────────────────────────────────────────────────────────

export type Habit = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  /** CSV dni tygodnia 0=niedz..6=sob, np. "1,2,3,4,5". null/"" = codziennie. */
  daysOfWeek: string | null;
  /** "HH:MM" czasu lokalnego lub null. */
  reminderTime: string | null;
  archived: boolean;
  sortOrder: number;
  ownerId: string | null;
  ownerTeamId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Nawyk wzbogacony o statystyki liczone po stronie serwera dla widoku. */
export type HabitWithStats = Habit & {
  /** Daty wykonań ("YYYY-MM-DD") z ostatniego roku, rosnąco. */
  entryDates: string[];
  completedToday: boolean;
  /** Czy nawyk jest zaplanowany na dziś (wg daysOfWeek). */
  scheduledToday: boolean;
  currentStreak: number;
  longestStreak: number;
  /** Liczba zaplanowanych dni w bieżącym tygodniu, które wykonano. */
  weekDone: number;
  /** Liczba zaplanowanych dni w bieżącym tygodniu (cel). */
  weekTarget: number;
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
