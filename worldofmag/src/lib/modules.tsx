import {
  Home, ShoppingCart, CheckSquare, FileText, PawPrint, ChefHat, GraduationCap,
  HeartPulse, Flame, Car, Wallet, Handshake, Calendar,
  Newspaper, CloudSun, Warehouse, Wrench,
} from "lucide-react";
import { PERMISSIONS } from "@/platform/auth/permissions";
import { defineModule, mergeModules, permissionForPathIn, type ResolvedModule } from "@/platform/registry";

// 046: deklaracje modułów przeniesionych do `src/modules/`. TO JEST KORZEŃ KOMPOZYCJI —
// jedyne miejsce w kodzie, które zna wszystkie moduły naraz. Nie może nim być
// `src/platform/registry.ts`, bo platforma z zasady nie zna modułów (reguła ESLint tego pilnuje).
import truckModule from "@/modules/truck/module";
import contactsModule from "@/modules/contacts/module";
import reportsModule from "@/modules/reports/module";
import qaModule from "@/modules/qa/module";
import newsModule from "@/modules/news/module";
import healthModule from "@/modules/health/module";
import flotaModule from "@/modules/flota/module";
import notesModule from "@/modules/notes/module";
import magazynowanieModule from "@/modules/magazynowanie/module";
import warsztatyModule from "@/modules/warsztaty/module";
import languagesModule from "@/modules/languages/module";
import habitsModule from "@/modules/habits/module";

// Definicja górnego (konfigurowalnego) modułu menu. Pozycje dolne (Ustawienia,
// Zaproszenia, Admin) NIE są tutaj — pozostają na stałe w komponentach paska.
export type ModuleDef = ResolvedModule;

const DECLARED: ResolvedModule[] = [truckModule, contactsModule, reportsModule, qaModule, habitsModule, languagesModule, warsztatyModule, magazynowanieModule, notesModule, flotaModule, healthModule, newsModule];

/**
 * Moduły JESZCZE NIEPRZENIESIONE do `src/modules/`. Lista przejściowa, kurcząca się z każdą
 * kolejną falą Fazy 1 — jawnie nazwana, żeby długu nie dało się przeoczyć (wzorzec statusu
 * `pending` z 045). Docelowo pusta: wtedy `MODULES` wynika wyłącznie z deklaracji.
 */
const LEGACY: ResolvedModule[] = [
  defineModule({ id: "home",      label: "Strona główna", href: "/",          exact: true, permission: PERMISSIONS.HOME,      color: "var(--text-secondary)", Icon: Home,          defaultEnabled: true }),
  defineModule({ id: "calendar",  label: "Kalendarz",     href: "/calendar",  permission: PERMISSIONS.CALENDAR,  color: "var(--accent-purple)", Icon: Calendar,      defaultEnabled: true }),
  defineModule({ id: "shopping",  label: "Zakupy",        href: "/shopping",  permission: PERMISSIONS.SHOPPING,  color: "var(--accent-blue)",   Icon: ShoppingCart,  defaultEnabled: true }),
  defineModule({ id: "tasks",     label: "Zadania",       href: "/tasks",     permission: PERMISSIONS.TASKS,     color: "var(--accent-green)",  Icon: CheckSquare,   defaultEnabled: true }),
  defineModule({ id: "pets",      label: "Zwierzęta",     href: "/pets",      permission: PERMISSIONS.PETS,      color: "var(--accent-orange)", Icon: PawPrint,      defaultEnabled: true }),
  defineModule({ id: "kitchen",   label: "Kuchnia",       href: "/kitchen",   permission: PERMISSIONS.KITCHEN,   color: "var(--accent-orange)", Icon: ChefHat,       defaultEnabled: true }),
  defineModule({ id: "weather",   label: "Pogoda",        href: "/pogoda",    permission: PERMISSIONS.WEATHER,   color: "var(--accent-amber)",  Icon: CloudSun,      defaultEnabled: true }),
  defineModule({ id: "services",  label: "Usługi",        href: "/services",  permission: PERMISSIONS.SERVICES,  color: "var(--accent-blue)",   Icon: Handshake,     defaultEnabled: true }),
  defineModule({ id: "portfel",   label: "Portfel",       href: "/portfel",   permission: PERMISSIONS.PORTFEL,   color: "var(--accent-green)",  Icon: Wallet,        defaultEnabled: true }),
];

/**
 * Kolejność pozycji w menu — decyzja produktowa, więc trzyma się jednej listy, a nie kolejności,
 * w jakiej moduły akurat zostały przeniesione. Zmiana kolejności = zmiana tej tablicy.
 */
const MODULE_ORDER = [
  "home", "calendar", "shopping", "tasks", "notes", "pets", "kitchen", "languages", "health",
  "news", "weather", "habits", "services", "contacts", "qa", "truck", "flota", "portfel",
  "magazynowanie", "warsztaty", "reports",
];

// Jedno źródło prawdy dla górnych modułów (kolejność = domyślna kolejność menu).
export const MODULES: ModuleDef[] = mergeModules(DECLARED, LEGACY, MODULE_ORDER);

const MODULE_INDEX = new Map(MODULES.map((m, i) => [m.id, i]));

/**
 * Mapowanie ścieżka → uprawnienie dla modułów ZADEKLAROWANYCH. Uzupełnia historyczny łańcuch
 * `if`-ów w `platform/auth/permissions.ts`, którego platforma nie może wyprowadzić z deklaracji,
 * bo nie wolno jej importować modułów.
 */
export function declaredPermissionForPath(path: string): string | null | undefined {
  return permissionForPathIn(DECLARED, path);
}

// Maksymalna liczba ikon w dolnym pasku (mobile) — przy większej liczbie robi się ciasno.
export const MAX_TAB_BAR = 5;

// Domyślny dolny pasek (mobile) — niezależny od kolejności menu bocznego.
// Wymaganie właściciela: Strona główna, Zadania, Zakupy.
export const DEFAULT_TAB_BAR = ["home", "tasks", "shopping"];

export type MenuPrefs = { order: string[]; disabled: string[]; tabBar: string[] };

export function defaultMenuPrefs(): MenuPrefs {
  return {
    order: MODULES.map((m) => m.id),
    disabled: MODULES.filter((m) => !m.defaultEnabled).map((m) => m.id),
    tabBar: [...DEFAULT_TAB_BAR],
  };
}

function hasAccess(m: ModuleDef, permissions: string[]): boolean {
  return m.permission === null || permissions.includes(m.permission);
}

/**
 * Rozdziela moduły wg uprawnień + preferencji:
 *  - `enabled`: dostępne i włączone (renderowane w menu, w kolejności użytkownika),
 *  - `more`: dostępne, ale wyłączone przez użytkownika (sekcja „Więcej…"),
 *  - niedostępne (brak uprawnień) — pomijane całkowicie (ukryte).
 */
export function resolveMenu(permissions: string[], prefs: MenuPrefs) {
  const orderIndex = new Map(prefs.order.map((id, i) => [id, i]));
  const ordered = [...MODULES].sort((a, b) => {
    // moduły spoza zapisanej kolejności (np. nowo dodane) lądują na końcu, w kolejności bazowej
    const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : 1000 + (MODULE_INDEX.get(a.id) ?? 0);
    const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : 1000 + (MODULE_INDEX.get(b.id) ?? 0);
    return ai - bi;
  });
  const accessible = ordered.filter((m) => hasAccess(m, permissions));
  const disabledSet = new Set(prefs.disabled);
  return {
    enabled: accessible.filter((m) => !disabledSet.has(m.id)),
    more: accessible.filter((m) => disabledSet.has(m.id)),
  };
}

/** Wszystkie dostępne moduły (do ekranu zarządzania menu w ustawieniach). */
export function accessibleModulesInOrder(permissions: string[], prefs: MenuPrefs): ModuleDef[] {
  const { enabled, more } = resolveMenu(permissions, prefs);
  // enabled w kolejności użytkownika, potem dostępne-wyłączone
  return [...enabled, ...more];
}

/**
 * Moduły dolnego paska (mobile) w kolejności wybranej przez użytkownika — niezależnej
 * od menu bocznego. Filtruje wg uprawnień, ucina do MAX_TAB_BAR. Gdy nic nie zostanie
 * (np. brak uprawnień do wybranych), wraca do pierwszych włączonych modułów menu.
 */
export function resolveTabBar(permissions: string[], prefs: MenuPrefs): ModuleDef[] {
  const byId = new Map(MODULES.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const picked: ModuleDef[] = [];
  for (const id of prefs.tabBar) {
    if (seen.has(id)) continue;
    const m = byId.get(id);
    if (m && hasAccess(m, permissions)) {
      picked.push(m);
      seen.add(id);
    }
    if (picked.length >= MAX_TAB_BAR) break;
  }
  if (picked.length > 0) return picked;
  return resolveMenu(permissions, prefs).enabled.slice(0, 4);
}
