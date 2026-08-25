import type { ModuleServerContributions } from "@/platform/registry.server";

/**
 * 102 — wkład SERWEROWY modułu, oddzielony od deklaracji `module.ts`.
 *
 * `module.ts` trafia do `MODULES`, a `MODULES` importuje `ModuleSidebar` — komponent kliencki.
 * Leniwe `import()` do egzekutora asystenta czy handlera zadania i tak wciągnęłoby te moduły do
 * grafu klienta: produkcyjny bundel je odsiewa, ale **tryb deweloperski kompiluje je przy każdej
 * stronie** (zmierzone w 049: klikacze 12,7 → 26,0 minuty).
 */
const server: ModuleServerContributions = {
  ai: () => import("./ai"),
  jobs: () => import("./jobs"),
};

export default server;
