import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "@/modules/home/contract";

/**
 * 050 — KORZEŃ KOMPOZYCJI WKŁADÓW PULPITU.
 *
 * **Dlaczego to jest osobny plik, a nie filtr po `MODULE_SERVER` (jak `calendarContributors.ts`).**
 * Zmierzone, nie wydedukowane. `MODULE_SERVER` to obiekt czterech leniwych loaderów na moduł
 * (`ai`, `jobs`, `calendar`, `dashboard`). Kto go zaimportuje **dla jednego** pola, płaci grafem
 * za **wszystkie cztery**: webpack w trybie dev kompiluje cele `import()` osiągalne ze statycznie
 * zaimportowanego pliku. Pomiar `next dev` dla strony głównej:
 *
 * | wariant | `/auth/signin` | `/` |
 * |---|---|---|
 * | przed 050 (trasa importowała osiem kontraktów) | 1771 | **1889** |
 * | wkłady przez `MODULE_SERVER` | 1771 | **2117** |
 * | wkłady stąd, bez `ai`/`jobs`/`calendar` | 1771 | **1902** |
 *
 * 215 modułów różnicy to egzekutory asystenta i handlery zadań w tle **siedemnastu** modułów,
 * których pulpit nie wywoła ani razu. To ta sama lekcja co w 049 (kontrakt modułu jest plikiem
 * zbiorczym), tyle że piętro wyżej: **wspólny rejestr leniwych loaderów też jest plikiem
 * zbiorczym.** Pozostałe +13 to dokładnie liczba nowych plików (jedenaście wkładów, ten korzeń
 * i typ w platformie) — czyli koszt samego kodu, nie napompowanego grafu.
 *
 * Konsekwencja dla `calendarContributors.ts`, `lib/ai/catalog.ts` i `lib/jobs/registry.ts`: one
 * płacą dziś tak samo (agenda kalendarza wciąga egzekutory asystenta). Rozdzielenie ich to ta sama
 * operacja co tutaj i jest wskazane jako osobny krok — nie robimy tego w tym przebiegu, żeby nie
 * mieszać dowodu równoważności migawki z przebudową trzech innych korzeni (C-53).
 *
 * **Wpięcie tutaj jest pilnowane bramką** (`check:module-registry`), w obie strony: moduł
 * z `dashboard.ts` musi tu być, a każdy wpis tutaj musi wskazywać istniejący plik. Bez tego wkład
 * istniałby na dysku i nie istniał w aplikacji — dokładnie tak, jak przed kontrolą wpięcia
 * `module.ts` w `src/lib/modules.tsx`.
 */
export const DASHBOARD_CONTRIBUTORS: Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => Promise<{ default: DashboardContributor<Partial<DashboardSnapshot>> }>
> = {
  contacts: () => import("@/modules/contacts/dashboard"),
  flota: () => import("@/modules/flota/dashboard"),
  habits: () => import("@/modules/habits/dashboard"),
  health: () => import("@/modules/health/dashboard"),
  kitchen: () => import("@/modules/kitchen/dashboard"),
  languages: () => import("@/modules/languages/dashboard"),
  magazynowanie: () => import("@/modules/magazynowanie/dashboard"),
  notes: () => import("@/modules/notes/dashboard"),
  pets: () => import("@/modules/pets/dashboard"),
  portfel: () => import("@/modules/portfel/dashboard"),
  rosliny: () => import("@/modules/rosliny/dashboard"),
  reports: () => import("@/modules/reports/dashboard"),
  shopping: () => import("@/modules/shopping/dashboard"),
  tasks: () => import("@/modules/tasks/dashboard"),
  warsztaty: () => import("@/modules/warsztaty/dashboard"),
  weather: () => import("@/modules/weather/dashboard"),
};
