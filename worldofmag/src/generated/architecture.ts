// PLIK GENEROWANY — nie edytuj ręcznie.
// Źródło: scripts/generate-architecture.js (094, zadanie 45). Uruchamiane w `npm run build`.
//
// Powód, dla którego to jest generowane, a nie pisane: poprzednia wersja strony
// `/admin/architecture` była pisana ręcznie i mówiła „SQLite (lokalne dev)" długo po przejściu na
// Postgresa. Opis struktury utrzymywany osobno od struktury zawsze się rozjeżdża.

export interface PrzegladArchitektury {
  wygenerowano: string;
  zdolnosciPlatformy: string[];
  moduly: string[];
  bramki: string[];
  bakowanie: string[];
  liczbaModeli: number;
  liczbaMigracji: number;
  modeleZWersja: string[];
  modeleZPrzestrzenia: string[];
  zapadki: { nazwa: string; wartosc: number; bramka: string }[];
}

export const PRZEGLAD_ARCHITEKTURY: PrzegladArchitektury = {
  "wygenerowano": "2026-08-18T20:38:22.308Z",
  "zdolnosciPlatformy": [
    "ai",
    "audit",
    "auth",
    "cache",
    "calendar",
    "concurrency",
    "dashboard",
    "db",
    "events",
    "favorites",
    "i18n",
    "jobs",
    "llm",
    "notifications",
    "observability",
    "pagination",
    "rateLimit",
    "registry",
    "registry.server",
    "retention",
    "runtime",
    "sharing",
    "shortcuts",
    "trash",
    "ui",
    "viewState",
    "workspaces"
  ],
  "moduly": [
    "calendar",
    "contacts",
    "flota",
    "habits",
    "health",
    "home",
    "kitchen",
    "languages",
    "magazynowanie",
    "news",
    "notes",
    "pets",
    "portfel",
    "qa",
    "reports",
    "services",
    "shopping",
    "tasks",
    "truck",
    "warsztaty",
    "weather"
  ],
  "bramki": [
    "check-action-coverage",
    "check-ai-access",
    "check-ai-coverage",
    "check-boundaries",
    "check-content-memory",
    "check-cost-badge",
    "check-domain",
    "check-events",
    "check-grant-mirror",
    "check-i18n",
    "check-logs",
    "check-migrations",
    "check-module-registry",
    "check-owner-columns",
    "check-ownership-scope",
    "check-pagination",
    "check-perf-budget",
    "check-realtime",
    "check-schema-drift",
    "check-subscribers",
    "check-ui-contract",
    "check-versioning",
    "check-workspace-fill",
    "check-workspace-mirror",
    "check-workspace-nullable"
  ],
  "bakowanie": [
    "copy-architektura",
    "copy-audyt",
    "copy-audyt-podsumowanie",
    "copy-docs",
    "copy-spec-pipeline",
    "generate-architecture"
  ],
  "liczbaModeli": 155,
  "liczbaMigracji": 265,
  "modeleZWersja": [
    "ShoppingList",
    "Note",
    "TaskProject",
    "Task",
    "Recipe",
    "StorageItem",
    "Contact"
  ],
  "modeleZPrzestrzenia": [
    "Skin",
    "ShoppingList",
    "ItemHistory",
    "NoteGroup",
    "Tag",
    "Note",
    "TaskProject",
    "ProjectGroup",
    "Store",
    "Recipe",
    "Cookbook",
    "MealPlanEntry",
    "PantryItem",
    "StorageItem",
    "StorageSupplier",
    "StorageDocument",
    "StoragePurchaseOrder",
    "Pet",
    "PetEnclosure",
    "PetBreedingPair",
    "PetSale",
    "Vehicle",
    "WalletElement",
    "FavoriteView",
    "Budget",
    "FinanceGoal",
    "LanguageDeck",
    "HealthEvent",
    "MedicationSchedule",
    "Habit",
    "NewsSource",
    "NewsTopic",
    "NewsArticle",
    "NewsHiddenTopic",
    "NewsPref",
    "UserFact",
    "WeatherLocation",
    "WeatherWatcher",
    "WeatherIdea",
    "AiContent",
    "AiSectionPref",
    "NewsRefreshRun",
    "Workshop",
    "Contact",
    "WorkspaceMember",
    "ResourceGrant",
    "DomainEvent"
  ],
  "zapadki": [
    {
      "nazwa": "Zapytania listowe bez `take`",
      "wartosc": 207,
      "bramka": "check:pagination"
    },
    {
      "nazwa": "Teksty zaszyte w komponentach",
      "wartosc": 1416,
      "bramka": "check:i18n"
    },
    {
      "nazwa": "Najcięższa trasa (bajty JS)",
      "wartosc": 1191000,
      "bramka": "check:perf"
    }
  ]
};
