import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOptimalCategoryOrder } from "../storeRoute";
import type { StoreNodeData, StoreEdgeData } from "@/types";

const node = (id: string, type: string, category: string | null = null): StoreNodeData => ({
  id, storeId: "s1", label: id, type, category, x: 0, y: 0,
});
const edge = (fromId: string, toId: string, weight: number): StoreEdgeData => ({
  id: `${fromId}-${toId}`, storeId: "s1", fromId, toId, weight,
});

// Sklep liniowy: START — A — B — STOP (trasa wprost = 3); skróty „na krzyż" droższe.
const nodes: StoreNodeData[] = [
  node("s", "START"),
  node("a", "CATEGORY", "A"),
  node("b", "CATEGORY", "B"),
  node("t", "STOP"),
];
const edges: StoreEdgeData[] = [
  edge("s", "a", 1), edge("a", "b", 1), edge("b", "t", 1),
  edge("s", "b", 5), edge("a", "t", 5),
];

// Z-174: optymalizacja kolejności kategorii po trasie sklepu (Floyd-Warshall + Held-Karp TSP).
test("porządkuje kategorie wzdłuż optymalnej trasy (B,A → A,B)", () => {
  assert.deepEqual(computeOptimalCategoryOrder(nodes, edges, ["B", "A"]), ["A", "B"]);
});

test("kategorie bez węzła w sklepie trafiają na koniec (unmapped)", () => {
  assert.deepEqual(computeOptimalCategoryOrder(nodes, edges, ["B", "A", "C"]), ["A", "B", "C"]);
});

test("brak węzłów / brak kategorii → zwraca wejście bez zmian", () => {
  assert.deepEqual(computeOptimalCategoryOrder([], edges, ["A", "B"]), ["A", "B"]);
  assert.deepEqual(computeOptimalCategoryOrder(nodes, edges, []), []);
});

test("brak START/STOP → zwraca wejście bez zmian", () => {
  const noStart = nodes.filter((n) => n.type !== "START");
  assert.deepEqual(computeOptimalCategoryOrder(noStart, edges, ["B", "A"]), ["B", "A"]);
});

test("kategorie spoza sklepu (brak węzłów CATEGORY) → wejście bez zmian", () => {
  assert.deepEqual(computeOptimalCategoryOrder(nodes, edges, ["X", "Y"]), ["X", "Y"]);
});
