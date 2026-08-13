import type { ResourceCatalog } from "@/platform/sharing/types";

/**
 * 052 — KORZEŃ KOMPOZYCJI KATALOGU ZASOBÓW.
 *
 * Platforma nie zna modułów (C-36), więc katalog składa warstwa, która z definicji zna wszystkich.
 *
 * **Własny korzeń per troska, nie pole w `module.server.ts`** — z tego samego, zmierzonego powodu
 * co wkłady pulpitu w 050: wspólny obiekt leniwych loaderów jest plikiem zbiorczym, więc import
 * dla JEDNEJ troski wciąga do grafu cele `import()` wszystkich pozostałych.
 *
 * Wpięcie pilnuje bramka `check:module-registry` **w obie strony**: moduł z `sharing.ts` musi tu
 * być, a każdy wpis musi wskazywać istniejący plik. Bez tego deklaracja zasobów istniałaby na
 * dysku i nie istniała w aplikacji — a objawiłoby się to **odmową dostępu**, czyli najbardziej
 * mylącym z możliwych objawów.
 */
export const SHARING_RESOURCES: Record<string, () => Promise<{ default: ResourceCatalog }>> = {
  tasks: () => import("@/modules/tasks/sharing"),
  pets: () => import("@/modules/pets/sharing"),
  shopping: () => import("@/modules/shopping/sharing"),
  kitchen: () => import("@/modules/kitchen/sharing"),
};

/** Scalony katalog wszystkich typów zasobów. Ładowany leniwie, memoizowany na proces. */
let scalony: ResourceCatalog | null = null;

export async function loadResourceCatalog(): Promise<ResourceCatalog> {
  if (scalony) return scalony;
  const czesci = await Promise.all(Object.values(SHARING_RESOURCES).map((l) => l()));
  scalony = Object.assign({}, ...czesci.map((c) => c.default)) as ResourceCatalog;
  return scalony;
}
