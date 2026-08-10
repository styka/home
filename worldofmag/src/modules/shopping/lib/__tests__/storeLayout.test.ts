import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLayout } from "../storeLayout";

// Z-174: deterministyczny układ węzłów mapy sklepu (BFS-warstwy, STOP po prawej,
// izolowane na dole). Canvas domyślny 900×550, marginesy 80/80/60/60.

test("pusta lista → pusta mapa", () => {
  assert.equal(computeLayout([], []).size, 0);
});

test("liniowy START→A→STOP: pozycje na warstwach, STOP po prawej, wszyscy umiejscowieni", () => {
  const nodes = [
    { id: "s", type: "START" },
    { id: "a", type: "CATEGORY" },
    { id: "t", type: "STOP" },
  ];
  const edges = [{ fromId: "s", toId: "a" }, { fromId: "a", toId: "t" }];
  const pos = computeLayout(nodes, edges);
  assert.equal(pos.size, 3, "każdy węzeł ma pozycję");
  assert.equal(pos.get("s")!.x, 80, "START w pierwszej kolumnie (marginL)");
  assert.deepEqual(pos.get("t"), { x: 820, y: 275 }, "STOP po prawej, środek pionu");
  // A między START a STOP, w granicach kanwy
  const a = pos.get("a")!;
  assert.ok(a.x > 80 && a.x < 820, "A między kolumnami");
});

test("wszystkie pozycje mieszczą się w kanwie", () => {
  const nodes = [
    { id: "s", type: "START" }, { id: "a", type: "CATEGORY" },
    { id: "b", type: "CATEGORY" }, { id: "t", type: "STOP" },
  ];
  const edges = [{ fromId: "s", toId: "a" }, { fromId: "s", toId: "b" }, { fromId: "a", toId: "t" }];
  for (const { x, y } of computeLayout(nodes, edges, 900, 550).values()) {
    assert.ok(x >= 0 && x <= 900, `x w zakresie: ${x}`);
    assert.ok(y >= 0 && y <= 550, `y w zakresie: ${y}`);
  }
});

test("węzeł izolowany (nieosiągalny ze STARTU) ląduje na dole i jest umiejscowiony", () => {
  const nodes = [{ id: "s", type: "START" }, { id: "z", type: "CATEGORY" }];
  const pos = computeLayout(nodes, []); // brak krawędzi → z izolowany
  assert.equal(pos.size, 2);
  assert.equal(pos.get("z")!.y, 514, "izolowany na dole (canvasH-36)");
});
