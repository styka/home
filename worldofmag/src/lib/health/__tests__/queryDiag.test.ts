import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeExplainPlan, REPRESENTATIVE_QUERIES } from "@/lib/health/queryDiag";

// Z-037 — parser EXPLAIN (FORMAT JSON). Czysta logika, bez DB.

test("summarizeExplainPlan: Index Scan → 'index' + nazwa indeksu + koszt/wiersze z korzenia", () => {
  const plan = [
    {
      Plan: {
        "Node Type": "Limit",
        "Total Cost": 8.5,
        "Plan Rows": 50,
        Plans: [
          { "Node Type": "Index Scan", "Index Name": "Note_ownerId_idx", "Total Cost": 8.5, "Plan Rows": 50 },
        ],
      },
    },
  ];
  const r = summarizeExplainPlan(plan);
  assert.equal(r.scanType, "index");
  assert.deepEqual(r.indexes, ["Note_ownerId_idx"]);
  assert.equal(r.estCost, 8.5);
  assert.equal(r.planRows, 50);
});

test("summarizeExplainPlan: Seq Scan zagnieżdżony → 'seq', brak indeksów, koszt z korzenia", () => {
  const plan = [
    {
      Plan: {
        "Node Type": "Limit",
        "Total Cost": 12.3,
        "Plan Rows": 50,
        Plans: [
          {
            "Node Type": "Sort",
            Plans: [{ "Node Type": "Seq Scan", "Total Cost": 12.3, "Plan Rows": 200 }],
          },
        ],
      },
    },
  ];
  const r = summarizeExplainPlan(plan);
  assert.equal(r.scanType, "seq");
  assert.deepEqual(r.indexes, []);
  assert.equal(r.estCost, 12.3);
  assert.equal(r.planRows, 50);
});

test("summarizeExplainPlan: Bitmap/Index Only Scan też liczone jako 'index', indeksy deduplikowane", () => {
  const plan = [
    {
      Plan: {
        "Node Type": "Bitmap Heap Scan",
        "Total Cost": 4,
        "Plan Rows": 10,
        Plans: [
          { "Node Type": "Bitmap Index Scan", "Index Name": "ix_a" },
          { "Node Type": "Index Only Scan", "Index Name": "ix_a" },
        ],
      },
    },
  ];
  const r = summarizeExplainPlan(plan);
  assert.equal(r.scanType, "index");
  assert.deepEqual(r.indexes, ["ix_a"]);
});

test("summarizeExplainPlan: Seq przeważa nad Index (sygnał regresu) gdy oba obecne", () => {
  const plan = [
    {
      Plan: {
        "Node Type": "Hash Join",
        "Total Cost": 99,
        "Plan Rows": 5,
        Plans: [
          { "Node Type": "Seq Scan" },
          { "Node Type": "Index Scan", "Index Name": "ix_b" },
        ],
      },
    },
  ];
  assert.equal(summarizeExplainPlan(plan).scanType, "seq");
});

test("summarizeExplainPlan: akceptuje string JSON oraz obiekt { Plan }", () => {
  const asString = JSON.stringify([{ Plan: { "Node Type": "Index Scan", "Index Name": "x", "Total Cost": 1, "Plan Rows": 1 } }]);
  assert.equal(summarizeExplainPlan(asString).scanType, "index");
  const asObject = { Plan: { "Node Type": "Seq Scan", "Total Cost": 2, "Plan Rows": 2 } };
  assert.equal(summarizeExplainPlan(asObject).scanType, "seq");
});

test("summarizeExplainPlan: śmieci / pusty → 'other' i zera (nie rzuca)", () => {
  assert.deepEqual(summarizeExplainPlan(null), { scanType: "other", estCost: 0, planRows: 0, indexes: [] });
  assert.deepEqual(summarizeExplainPlan("{not json"), { scanType: "other", estCost: 0, planRows: 0, indexes: [] });
  assert.equal(summarizeExplainPlan([]).scanType, "other");
});

test("REPRESENTATIVE_QUERIES: poprawny kształt + $1 tylko gdy needsOwner", () => {
  assert.ok(REPRESENTATIVE_QUERIES.length >= 3);
  for (const q of REPRESENTATIVE_QUERIES) {
    assert.ok(q.label && q.sql);
    assert.doesNotMatch(q.sql, /EXPLAIN/i, "SQL nie powinien zawierać EXPLAIN (dokładamy go przy uruchomieniu)");
    if (q.needsOwner) assert.match(q.sql, /\$1/, "zapytanie po właścicielu musi mieć placeholder $1");
    else assert.doesNotMatch(q.sql, /\$1/, "zapytanie globalne nie powinno mieć $1");
  }
});
