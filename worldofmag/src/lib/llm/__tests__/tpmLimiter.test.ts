import { test } from "node:test";
import assert from "node:assert/strict";
import { reserveTpm, estimateTokens } from "@/lib/llm/tpmLimiter";

// Pacing pod TPM: pierwsze wywołania mieszczące się w oknie idą bez czekania;
// po przekroczeniu capu kolejne czekają (rolling window 60 s).

test("estimateTokens ~ znaki/4", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("a".repeat(400)), 100);
});

test("mieszczące się rezerwacje nie czekają", async () => {
  const key = "test-model-" + Math.random().toString(36).slice(2);
  const limit = 12000; // cap = 0.9*12000 = 10800
  const w1 = await reserveTpm(key, 3000, limit);
  const w2 = await reserveTpm(key, 3000, limit);
  const w3 = await reserveTpm(key, 3000, limit);
  // 9000 <= 10800 → wszystkie natychmiast (bez oczekiwania)
  assert.ok(w1 < 50 && w2 < 50 && w3 < 50, `oczekiwania: ${w1}/${w2}/${w3} ms`);
});

test("przekroczenie capu wymusza oczekiwanie (albo twardy limit przepuszcza)", async () => {
  const key = "test-model-" + Math.random().toString(36).slice(2);
  const limit = 2000; // cap = 1800; jedna rezerwacja ~ cap
  await reserveTpm(key, 1800, limit); // zapełnia okno
  const started = Date.now();
  // druga rezerwacja nie ma miejsca → czeka (co najmniej jeden krok ~250ms),
  // a najpóźniej po MAX_WAIT_TOTAL_MS przepuszcza — w obu razach > 200 ms.
  const waited = await reserveTpm(key, 1800, limit);
  const elapsed = Date.now() - started;
  assert.ok(waited >= 200, `powinno czekać, czekało ${waited} ms`);
  assert.ok(elapsed >= 200);
});
