import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splaszczDrzewo,
  idPoddrzewa,
  czyRuchTworzyCykl,
  sortujTopologicznie,
  type WezelObszaru,
} from "@/modules/tasks/lib/obszary";

/**
 * 117 (AC-1, AC-5): drzewo obszarów — jedna definicja dla trzech wariantów widoku i restoratora
 * kosza. Testy bez DB: funkcje są czyste i to jest warunek, żeby sekcje, drill-down i panel
 * nie mogły policzyć trzech różnych drzew z tych samych wierszy.
 */

const W = (id: string, parentId: string | null, order = 0, name = id): WezelObszaru => ({
  id,
  parentId,
  name,
  order,
});

test("splaszczDrzewo: rodzic przed dziećmi, głębokość rośnie, rodzeństwo po order", () => {
  const drzewo = splaszczDrzewo([
    W("b", null, 2),
    W("a", null, 1),
    W("a1", "a", 1),
    W("a2", "a", 2),
    W("a1x", "a1", 0),
  ]);
  assert.deepEqual(
    drzewo.map((w) => [w.obszar.id, w.glebokosc]),
    [["a", 0], ["a1", 1], ["a1x", 2], ["a2", 1], ["b", 0]],
  );
});

test("splaszczDrzewo: sierota (rodzic spoza listy) nie znika — wraca jak korzeń", () => {
  const drzewo = splaszczDrzewo([W("x", "nie-ma-takiego"), W("a", null)]);
  assert.deepEqual(drzewo.map((w) => w.obszar.id).sort(), ["a", "x"]);
  assert.ok(drzewo.every((w) => w.glebokosc === 0));
});

test("idPoddrzewa: korzeń + wszystkie poziomy w dół, bez rodzeństwa", () => {
  const obszary = [W("a", null), W("a1", "a"), W("a1x", "a1"), W("b", null)];
  assert.deepEqual([...idPoddrzewa(obszary, "a")].sort(), ["a", "a1", "a1x"]);
  assert.deepEqual([...idPoddrzewa(obszary, "b")], ["b"]);
});

test("czyRuchTworzyCykl: pod potomka i pod samego siebie — cykl; na szczyt i do brata — nie", () => {
  const obszary = [W("a", null), W("a1", "a"), W("a1x", "a1"), W("b", null)];
  assert.equal(czyRuchTworzyCykl(obszary, "a", "a1x"), true);
  assert.equal(czyRuchTworzyCykl(obszary, "a", "a"), true);
  assert.equal(czyRuchTworzyCykl(obszary, "a", null), false);
  assert.equal(czyRuchTworzyCykl(obszary, "a1", "b"), false);
});

test("idPoddrzewa: cykl w danych nie zapętla funkcji", () => {
  // Taki stan nie powstanie przez akcje (walidacja), ale migawka mogła przyjść zepsuta.
  const obszary = [W("a", "b"), W("b", "a")];
  assert.deepEqual([...idPoddrzewa(obszary, "a")].sort(), ["a", "b"]);
});

test("sortujTopologicznie: każdy rodzic stoi przed swoim dzieckiem", () => {
  const obszary = [W("a1x", "a1"), W("b", null), W("a", null), W("a1", "a")];
  const kolejnosc = sortujTopologicznie(obszary).map((o) => o.id);
  for (const o of obszary) {
    if (o.parentId === null) continue;
    assert.ok(kolejnosc.indexOf(o.parentId) < kolejnosc.indexOf(o.id), `${o.parentId} przed ${o.id}`);
  }
});
