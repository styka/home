// Typ akcji AI „magicznej ikony" — wspólny dla agenta (proponuje), panelu
// przeglądu (ActionDrawer) i executora (wykonuje). Trzymany w lib/ai (nie w
// pliku API-route), bo to model domenowy używany po obu stronach klient/serwer.
//
// JEDYNE źródło listy modułów akcji. Do 114 trasa agenta trzymała RÓWNOLEGŁĄ ręczną listę
// (`MODULES`), która została w tyle o `rosliny` i `youtube` — akcje tych modułów były po cichu
// przepisywane na "shopping" i kończyły się „Nieznany typ akcji". Tablica + typ pochodny zamiast
// gołej unii, bo unii nie da się wyliczyć w runtime — a to właśnie wymuszało drugą listę.
export const AI_ACTION_MODULES = [
  "shopping",
  "tasks",
  "notes",
  "pets",
  "habits",
  "portfel",
  "kitchen",
  "flota",
  "magazynowanie",
  "warsztaty",
  "health",
  "languages",
  "news",
  "weather",
  "contacts",
  "reports",
  "youtube",
  "rosliny",
] as const;

export type AIActionModule = (typeof AI_ACTION_MODULES)[number];

export interface AIAction {
  id: string;
  module: AIActionModule;
  description: string;
  type: string;
  params: Record<string, unknown>;
  searchQuery?: string;
}

// Akcje destrukcyjne (usuwanie/archiwizacja) — domyślnie ODZNACZONE w podglądzie planu
// (świadomy opt-in) i NIE wykonywane przy szybkim „Zatwierdź"/potwierdzeniu głosem; wymagają
// świadomego zaznaczenia w ActionDrawer. Współdzielone przez ActionDrawer i AICommandSheet.
export const DESTRUCTIVE_ACTION_TYPES = new Set<string>([
  "delete_item",
  "delete_task",
  "delete_note",
  "archive_list",
  "delete_health_event",
  "delete_word",
  "delete_news_topic",
  "delete_weather_location",
  "delete_list",
  "delete_project",
  "delete_habit",
  "delete_wallet_element",
  "delete_recipe",
  "delete_meal_plan",
  "delete_pantry_item",
  "delete_vehicle",
  "delete_deck",
  "delete_weather_watcher",
  "delete_storage_item",
  "delete_pet",
  "delete_medication",
  "delete_contact",
  "delete_budget",
  "delete_goal",
  "delete_cookbook",
  "delete_project_group",
  "delete_note_group",
  "delete_workshop",
  "delete_workshop_item",
  "delete_workshop_project",
  "delete_enclosure",
  "delete_news_source",
  "delete_supplier",
]);

/** Czy akcja jest destrukcyjna (usuwa/archiwizuje dane) — wymaga świadomego potwierdzenia. */
export function isDestructiveAction(action: Pick<AIAction, "type">): boolean {
  return DESTRUCTIVE_ACTION_TYPES.has(action.type);
}
