import { test } from "node:test";
import assert from "node:assert/strict";
import { clampLimit, keysetQuery, keysetResult } from "../pagination";

test("clampLimit: domyślny / zakres / sanityzacja", () => {
  assert.equal(clampLimit(undefined), 50);
  assert.equal(clampLimit(0), 50);
  assert.equal(clampLimit(10), 10);
  assert.equal(clampLimit(99999), 200);
  assert.equal(clampLimit(-5), 1);
  assert.equal(clampLimit(NaN), 50);
});

test("keysetQuery: bez cursora pobiera limit+1, bez skip", () => {
  assert.deepEqual(keysetQuery({ limit: 10 }), { take: 11 });
});

test("keysetQuery: z cursorem dokłada cursor+skip:1", () => {
  assert.deepEqual(keysetQuery({ cursor: "abc", limit: 10 }), { take: 11, cursor: { id: "abc" }, skip: 1 });
});

test("keysetResult: gdy jest więcej — tnie nadmiar i zwraca nextCursor", () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({ id: `id${i}` }));
  const page = keysetResult(rows, 10);
  assert.equal(page.items.length, 10);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextCursor, "id9");
});

test("keysetResult: gdy nie ma więcej — brak nextCursor", () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({ id: `id${i}` }));
  const page = keysetResult(rows, 10);
  assert.equal(page.items.length, 4);
  assert.equal(page.hasMore, false);
  assert.equal(page.nextCursor, null);
});

test("keysetResult: pusta strona", () => {
  const page = keysetResult([] as { id: string }[], 10);
  assert.deepEqual(page, { items: [], hasMore: false, nextCursor: null });
});
