import type { ModuleServerContributions } from "@/platform/registry.server";

/**
 * 049 — WKŁAD SERWEROWY MODUŁU, oddzielony od deklaracji `module.ts`.
 *
 * **Dlaczego to jest osobny plik, a nie trzy pola w `module.ts`.** `module.ts` trafia do `MODULES`,
 * a `MODULES` importuje `ModuleSidebar` — komponent **kliencki**. Leniwe `import()` do egzekutora
 * asystenta czy handlera zadania i tak wciąga te moduły do grafu klienta: produkcyjny bundel je
 * odsiewa (rozmiar się nie zmienia), ale **tryb deweloperski kompiluje je przy każdej stronie**.
 * Zmierzone: zestaw klikaczy spowolnił z 12,7 do 26,0 minuty, a smoke z 46 do 125 sekund.
 *
 * Ten plik importuje **wyłącznie kod serwerowy** i jest składany przez `src/lib/modules.server.ts`,
 * którego klient nigdy nie dotyka.
 */
const server: ModuleServerContributions = {
  ai: () => import("./ai"),
  jobs: () => import("./jobs"),
};

export default server;
