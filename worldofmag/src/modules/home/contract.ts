/**
 * Kontrakt modułu **Strona główna** (pulpit: kafelki modułów, migawka dnia, szybkie akcje,
 * ostatnio używane, briefing).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/home/*` poza `contract`.
 *
 * Kontrakt eksportuje **wyłącznie typy**, bo pulpit nie ma zewnętrznego konsumenta danych: to on
 * czyta kontrakty **innych** modułów (Kuchnia, Flota, Zdrowie, Portfel, Magazynowanie, Nauka
 * języków, Zwierzęta), a nie odwrotnie. Kontrakt istnieje jako **granica**, nie jako spis życzeń —
 * tak samo jak przy Trasach TIR w 046 i Usługach w tej fali.
 *
 * **Co świadomie NIE jest częścią tego modułu:** globalny asystent (`components/assistant/`) oraz
 * feed aktywności (`components/settings/`). Pierwszy jest elementem powłoki montowanym na każdej
 * stronie, drugi należy do ustawień konta. Oba mieszkały wcześniej w `components/home/` i zostały
 * stamtąd wyprowadzone **osobnym commitem** — bez tego rozdzielenia powłoka musiałaby importować
 * wnętrze modułu.
 */

import type { TaskPriority, CareAgendaItem } from "@/types";

export interface TaskPreview {
  id: string;
  title: string;
  priority: TaskPriority;
  projectId: string | null;
  projectName: string | null;
  projectEmoji: string | null;
}

export interface MealPreview {
  id: string;
  slot: string;
  title: string;
  servings: number;
  recipeSlug: string | null;
}

export interface VehicleAlert {
  id: string;
  name: string;
  type: "inspection" | "insurance";
  dueAt: string;
  daysLeft: number;
}

export interface DeckDue {
  id: string;
  name: string;
  targetLang: string;
  dueCount: number;
}

export interface HealthUpcoming {
  id: string;
  kind: "VISIT" | "TEST";
  title: string;
  specialty: string | null;
  scheduledAt: string;
}

/**
 * 050 — **KSZTAŁT MIGAWKI PULPITU**: dokładnie te pola, które wnoszą MODUŁY.
 *
 * Nie ma tu danych konta (sesja, aktywność, zaproszenia, preferencje, ulubione) ani statystyk
 * admina — te zostają w trasie, bo nie należą do żadnego modułu.
 *
 * **Dlaczego typ mieszka w kontrakcie Strony głównej:** to jej widok definiuje, czego potrzebuje,
 * a moduł wnoszący dane musi znać ten kształt. Import jest **wyłącznie typowy**, więc znika przy
 * kompilacji i nie powiększa grafu — co po lekcji z 049 nie jest tu drobiazgiem, tylko warunkiem.
 */
export interface DashboardSnapshot {
  pendingItems: number;
  todayTasks: number;
  overdueTasks: number;
  todayTaskPreview: TaskPreview[];
  pinnedNotes: number;
  todayMeals: MealPreview[];
  expiringSoon: number;
  recentReports: number;
  petCareDue: number;
  petAgenda: CareAgendaItem[];
  vehiclesCount: number;
  vehicleAlerts: VehicleAlert[];
  wallet: { totalNet: number; currency: string; monthlyRate: number } | null;
  languagesDue: number;
  languageDecks: DeckDue[];
  healthUpcomingCount: number;
  healthUpcoming: HealthUpcoming[];
  storageLowStock: number;
  storageExpiring: number;
  /** 113: ile zabiegów w module Rośliny jest zaległych albo wypada dziś. */
  plantCareDue: number;
  plantAgenda: PlantAgendaItem[];
  /** 115 (Z-INT-17): odhaczone / zaplanowane na dziś nawyki (agregat, jak wkład do kalendarza). */
  habitsTodayDone: number;
  habitsTodayTotal: number;
  /** 115 (Z-INT-17): najbliższe przeglądy sprzętu warsztatowego + liczba materiałów na wyczerpaniu. */
  workshopDue: WorkshopDueItem[];
  workshopLowStock: number;
  /** 115 (Z-INT-17): urodziny kontaktów w najbliższych 30 dniach. */
  upcomingBirthdays: UpcomingBirthday[];
  /** 115 (Z-INT-17): bieżąca pogoda domyślnej lokalizacji — null, gdy brak lokalizacji albo timeout. */
  weatherToday: WeatherTodayInfo | null;
}

/** 115: pozycja przeglądu warsztatowego na pulpicie. */
export interface WorkshopDueItem {
  id: string;
  name: string;
  workshopName: string;
  dueAt: string | null;
  overdue: boolean;
}

/** 115: nadchodzące urodziny kontaktu — `date` to "YYYY-MM-DD" najbliższej rocznicy. */
export interface UpcomingBirthday {
  id: string;
  name: string;
  date: string;
}

/** 115: skrót bieżącej pogody na pulpit (temperatura zaokrąglona, etykieta = nazwa lokalizacji). */
export interface WeatherTodayInfo {
  temp: number;
  opis: string;
  emoji: string;
  label: string;
}

/** 113: pozycja agendy roślinnej na pulpicie — nazwa zabiegu, roślina i adres, pod który prowadzi. */
export interface PlantAgendaItem {
  id: string;
  title: string;
  plantName: string | null;
  href: string;
  bucket: "OVERDUE" | "TODAY" | "SOON";
}

/**
 * Wartości, które widzi użytkownik bez dostępu do danego modułu. **To są dokładnie dzisiejsze
 * inicjalizatory z trasy** (`let todayTasks = 0`, `let wallet = null`, …) — przeniesione w jedno
 * miejsce, nie wymyślone na nowo.
 */
export const EMPTY_SNAPSHOT: DashboardSnapshot = {
  pendingItems: 0,
  todayTasks: 0,
  overdueTasks: 0,
  todayTaskPreview: [],
  pinnedNotes: 0,
  todayMeals: [],
  expiringSoon: 0,
  recentReports: 0,
  petCareDue: 0,
  petAgenda: [],
  vehiclesCount: 0,
  vehicleAlerts: [],
  wallet: null,
  languagesDue: 0,
  languageDecks: [],
  healthUpcomingCount: 0,
  healthUpcoming: [],
  plantCareDue: 0,
  plantAgenda: [],
  storageLowStock: 0,
  storageExpiring: 0,
  habitsTodayDone: 0,
  habitsTodayTotal: 0,
  workshopDue: [],
  workshopLowStock: 0,
  upcomingBirthdays: [],
  weatherToday: null,
};

/** Sekcja pulpitu — kolejność i widoczność zapisuje `DashboardPref` (per użytkownik). */
export type DashboardSectionId =
  | "briefing"
  | "quickActions"
  | "todaySnapshot"
  | "moduleSnapshot"
  | "recentlyUsed"
  | "suggestions";
