import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheKeyFor, getCached, setCached } from "../cache";

// Z-511/Z-174: cache odpowiedzi LLM (in-memory). Klucze unikalne per test (store globalny).
const k = () => "t-" + Math.random().toString(36).slice(2);

test("cacheKeyFor: deterministyczny dla tego samego wejścia, różny dla różnego", () => {
  const a = cacheKeyFor({ op: "dispatch", text: "mleko" });
  assert.equal(a, cacheKeyFor({ op: "dispatch", text: "mleko" }));
  assert.notEqual(a, cacheKeyFor({ op: "dispatch", text: "chleb" }));
});

test("set + get zwraca wartość i model", () => {
  const key = k();
  assert.equal(getCached(key), null, "miss przed set");
  setCached(key, "wynik", "groq/llama");
  assert.deepEqual(getCached(key), { value: "wynik", model: "groq/llama" });
});

test("TTL=0 → natychmiast wygasłe (miss)", () => {
  const key = k();
  setCached(key, "x", undefined, 0);
  assert.equal(getCached(key), null);
});
