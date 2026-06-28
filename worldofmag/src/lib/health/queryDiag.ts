// Z-037 — diagnostyka „wolnych zapytań" dla /admin/health.
//
// Czysta (testowalna) warstwa: parser wyniku `EXPLAIN (FORMAT JSON)` + lista
// reprezentatywnych zapytań listujących. Samo URUCHOMIENIE EXPLAIN (DB) jest w
// `actions/systemHealth.ts` — tu trzymamy logikę bez zależności od Prismy.
//
// Cel: wykrywać REGRESY wydajności bazy (np. lista, która przestała używać indeksu
// i robi Seq Scan). To MONITOR, nie pass/fail: na małych tabelach planner świadomie
// wybiera Seq Scan i to jest poprawne — sygnałem jest Seq Scan na DUŻej liście.

export type ScanType = "index" | "seq" | "other";

export interface ExplainSummary {
  scanType: ScanType;
  estCost: number;
  planRows: number;
  indexes: string[];
}

interface PlanNode {
  "Node Type"?: string;
  "Total Cost"?: number;
  "Plan Rows"?: number;
  "Index Name"?: string;
  Plans?: PlanNode[];
}

/**
 * Parsuje wynik `EXPLAIN (FORMAT JSON) <query>`. Akceptuje:
 *  - tablicę `[{ Plan: {...} }]` (natywny kształt EXPLAIN FORMAT JSON),
 *  - obiekt `{ Plan: {...} }`,
 *  - string JSON (zostanie sparsowany).
 * Schodzi po drzewie planu, klasyfikuje typ skanu i zbiera użyte indeksy.
 */
export function summarizeExplainPlan(input: unknown): ExplainSummary {
  let data: unknown = input;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return { scanType: "other", estCost: 0, planRows: 0, indexes: [] };
    }
  }

  const wrapper = Array.isArray(data) ? data[0] : data;
  const root: PlanNode | undefined =
    (wrapper as { Plan?: PlanNode })?.Plan ?? (wrapper as PlanNode | undefined);

  const nodeTypes: string[] = [];
  const indexes: string[] = [];
  const walk = (n: PlanNode | undefined): void => {
    if (!n || typeof n !== "object") return;
    if (typeof n["Node Type"] === "string") nodeTypes.push(n["Node Type"]);
    if (typeof n["Index Name"] === "string" && n["Index Name"]) indexes.push(n["Index Name"]);
    for (const child of n.Plans ?? []) walk(child);
  };
  walk(root);

  // Heurystyka sygnału: Seq Scan (gdziekolwiek) jest ważniejszym sygnałem niż Index Scan,
  // bo to on bywa regresem na gorących listach.
  const hasSeq = nodeTypes.some((t) => /seq scan/i.test(t));
  const hasIndex = nodeTypes.some((t) => /index.*scan/i.test(t));
  const scanType: ScanType = hasSeq ? "seq" : hasIndex ? "index" : "other";

  return {
    scanType,
    estCost: typeof root?.["Total Cost"] === "number" ? root["Total Cost"]! : 0,
    planRows: typeof root?.["Plan Rows"] === "number" ? root["Plan Rows"]! : 0,
    indexes: Array.from(new Set(indexes)),
  };
}

export interface RepresentativeQuery {
  label: string;
  /** SQL bez `EXPLAIN`; `$1` (gdy `needsOwner`) = ownerId właściciela próbki. */
  sql: string;
  needsOwner: boolean;
}

/**
 * Reprezentatywne, gorące zapytania listujące (filtr po właścicielu + sort) — wzorce,
 * po których chcemy widzieć, czy baza trzyma plan indeksowy. `LIMIT` jak w realnych listach.
 */
export const REPRESENTATIVE_QUERIES: RepresentativeQuery[] = [
  {
    label: "Notatki — właściciel, wg updatedAt",
    needsOwner: true,
    sql: `SELECT "id" FROM "Note" WHERE "ownerId" = $1 ORDER BY "updatedAt" DESC LIMIT 50`,
  },
  {
    label: "Zadania — wg projektu właściciela",
    needsOwner: true,
    sql: `SELECT t."id" FROM "Task" t JOIN "TaskProject" p ON p."id" = t."projectId" WHERE p."ownerId" = $1 LIMIT 50`,
  },
  {
    label: "Listy zakupów — właściciel, wg updatedAt",
    needsOwner: true,
    sql: `SELECT "id" FROM "ShoppingList" WHERE "ownerId" = $1 ORDER BY "updatedAt" DESC LIMIT 50`,
  },
  {
    label: "Log audytu — wg createdAt",
    needsOwner: false,
    sql: `SELECT "id" FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 50`,
  },
];
