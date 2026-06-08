import type { LucideIcon } from "lucide-react";
import {
  Home, ShoppingCart, CheckSquare, FileText, PawPrint, ChefHat, GraduationCap,
  HeartPulse, Flame, FlaskConical, Truck, Car, Wallet, BookOpen, Handshake, Calendar,
  Newspaper, CloudSun, Warehouse, Wrench, Users,
} from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions";

// Definicja górnego (konfigurowalnego) modułu menu. Pozycje dolne (Ustawienia,
// Zaproszenia, Admin) NIE są tutaj — pozostają na stałe w komponentach paska.
export type ModuleDef = {
  id: string;
  label: string;
  href: string;
  exact?: boolean;
  permission: string | null; // wymagany slug; null = dostępny zawsze (np. Raporty)
  color: string;
  Icon: LucideIcon;
  defaultEnabled: boolean; // domyślnie włączone wszystkie oprócz QA
};

// Jedno źródło prawdy dla górnych modułów (kolejność = domyślna kolejność menu).
export const MODULES: ModuleDef[] = [
  { id: "home",      label: "Strona główna", href: "/",          exact: true, permission: PERMISSIONS.HOME,      color: "var(--text-secondary)", Icon: Home,          defaultEnabled: true },
  { id: "calendar",  label: "Kalendarz",     href: "/calendar",  permission: PERMISSIONS.CALENDAR,  color: "var(--accent-purple)", Icon: Calendar,      defaultEnabled: true },
  { id: "shopping",  label: "Zakupy",        href: "/shopping",  permission: PERMISSIONS.SHOPPING,  color: "var(--accent-blue)",   Icon: ShoppingCart,  defaultEnabled: true },
  { id: "tasks",     label: "Zadania",       href: "/tasks",     permission: PERMISSIONS.TASKS,     color: "var(--accent-green)",  Icon: CheckSquare,   defaultEnabled: true },
  { id: "notes",     label: "Notatki",       href: "/notes",     permission: PERMISSIONS.NOTES,     color: "var(--accent-amber)",  Icon: FileText,      defaultEnabled: true },
  { id: "pets",      label: "Zwierzęta",     href: "/pets",      permission: PERMISSIONS.PETS,      color: "var(--accent-orange)", Icon: PawPrint,      defaultEnabled: true },
  { id: "kitchen",   label: "Kuchnia",       href: "/kitchen",   permission: PERMISSIONS.KITCHEN,   color: "var(--accent-orange)", Icon: ChefHat,       defaultEnabled: true },
  { id: "languages", label: "Nauka języków", href: "/languages", permission: PERMISSIONS.LANGUAGES, color: "var(--accent-purple)", Icon: GraduationCap, defaultEnabled: true },
  { id: "health",    label: "Zdrowie",       href: "/health",    permission: PERMISSIONS.HEALTH,    color: "var(--accent-red)",    Icon: HeartPulse,    defaultEnabled: true },
  { id: "news",      label: "Wiadomości",    href: "/wiadomosci", permission: PERMISSIONS.NEWS,     color: "var(--accent-blue)",   Icon: Newspaper,     defaultEnabled: true },
  { id: "weather",   label: "Pogoda",        href: "/pogoda",    permission: PERMISSIONS.WEATHER,   color: "var(--accent-amber)",  Icon: CloudSun,      defaultEnabled: true },
  { id: "habits",    label: "Nawyki",        href: "/habits",    permission: PERMISSIONS.HABITS,    color: "var(--accent-orange)", Icon: Flame,         defaultEnabled: true },
  { id: "services",  label: "Usługi",        href: "/services",  permission: PERMISSIONS.SERVICES,  color: "var(--accent-blue)",   Icon: Handshake,     defaultEnabled: true },
  { id: "contacts",  label: "Kontakty",      href: "/contacts",  permission: PERMISSIONS.CONTACTS,  color: "var(--accent-blue)",   Icon: Users,         defaultEnabled: true },
  { id: "qa",        label: "QA",            href: "/qa",        permission: PERMISSIONS.QA,        color: "var(--accent-red)",    Icon: FlaskConical,  defaultEnabled: false },
  { id: "truck",     label: "Trasy TIR",     href: "/truck",     permission: PERMISSIONS.TRUCK,     color: "var(--accent-blue)",   Icon: Truck,         defaultEnabled: true },
  { id: "flota",     label: "Flota",         href: "/flota",     permission: PERMISSIONS.FLOTA,     color: "var(--accent-blue)",   Icon: Car,           defaultEnabled: true },
  { id: "portfel",   label: "Portfel",       href: "/portfel",   permission: PERMISSIONS.PORTFEL,   color: "var(--accent-green)",  Icon: Wallet,        defaultEnabled: true },
  { id: "magazynowanie", label: "Magazynowanie", href: "/magazynowanie", permission: PERMISSIONS.MAGAZYNOWANIE, color: "var(--accent-blue)", Icon: Warehouse, defaultEnabled: true },
  { id: "warsztaty", label: "Warsztaty",     href: "/warsztaty", permission: PERMISSIONS.WARSZTATY,  color: "var(--accent-amber)",  Icon: Wrench,        defaultEnabled: true },
  { id: "reports",   label: "Raporty",       href: "/reports",   permission: null,                  color: "var(--accent-purple)", Icon: BookOpen,      defaultEnabled: true },
];

const MODULE_INDEX = new Map(MODULES.map((m, i) => [m.id, i]));

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
