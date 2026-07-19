// 011-ai-full-action-coverage: odczyt manifestu pokrycia akcji przez asystenta AI
// do prezentacji w panelu admina. Źródłem prawdy jest `action-coverage.json`,
// pilnowany przez bramkę `scripts/check-ai-coverage.js` (build pada, gdy jakakolwiek
// mutacja/odczyt użytkownika nie jest sklasyfikowana). Dzięki temu ta lista jest
// ZAWSZE aktualna wobec kodu wdrożonego na danym środowisku — panel tylko ją renderuje.
import manifest from "@/lib/ai/action-coverage.json";

export type CoverageStatus = "ai" | "pending" | "excluded";
export type CoverageKind = "read" | "mutation";

export interface CoverageEntry {
  /** `plik:funkcja` z `src/actions/*` (np. `tasks:updateTaskTags`). */
  key: string;
  module: string;
  fn: string;
  kind: CoverageKind;
  status: CoverageStatus;
  /** Nazwa akcji AI / read-toola (gdy status = ai). */
  action?: string;
  /** Powód wykluczenia (gdy status = excluded). */
  reason?: string;
}

export interface CoverageModule {
  module: string;
  entries: CoverageEntry[];
  aiCount: number;
  total: number;
}

export interface CoverageCounts {
  ai: number;
  pending: number;
  excluded: number;
  total: number;
}

export interface AiCoverage {
  modules: CoverageModule[];
  mutation: CoverageCounts;
  read: CoverageCounts;
}

type RawEntry = { status?: string; kind?: string; action?: string; reason?: string };

function emptyCounts(): CoverageCounts {
  return { ai: 0, pending: 0, excluded: 0, total: 0 };
}

/** Zbuduj strukturę pokrycia z manifestu (pogrupowaną po module + liczniki). Czyste, bez DB. */
export function getAiCoverage(): AiCoverage {
  const raw = manifest as Record<string, RawEntry>;
  const byModule = new Map<string, CoverageEntry[]>();
  const mutation = emptyCounts();
  const read = emptyCounts();

  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("__")) continue;
    const [module, fn] = key.split(":");
    const kind: CoverageKind = value.kind === "read" ? "read" : "mutation";
    const status = (["ai", "pending", "excluded"].includes(value.status ?? "") ? value.status : "pending") as CoverageStatus;
    const entry: CoverageEntry = { key, module, fn, kind, status, action: value.action, reason: value.reason };
    if (!byModule.has(module)) byModule.set(module, []);
    byModule.get(module)!.push(entry);

    const bucket = kind === "read" ? read : mutation;
    bucket.total++;
    bucket[status]++;
  }

  const modules: CoverageModule[] = Array.from(byModule, ([module, entries]): CoverageModule => {
    entries.sort((a, b) => a.fn.localeCompare(b.fn));
    return { module, entries, aiCount: entries.filter((e) => e.status === "ai").length, total: entries.length };
  }).sort((a, b) => a.module.localeCompare(b.module));

  return { modules, mutation, read };
}
