import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, acquireSlot } from "../rateLimit";

// Z-211/Z-130/Z-174: strażnik współbieżności + burst (in-memory). uid unikalne per test.
const uid = () => "u-" + Math.random().toString(36).slice(2);

test("acquireSlot: max 2 równoległe, release zwalnia slot", () => {
  const u = uid();
  const r1 = acquireSlot(u);
  const r2 = acquireSlot(u);
  assert.ok(r1 && r2, "dwa sloty dostępne");
  assert.equal(acquireSlot(u), null, "trzeci odrzucony (MAX_CONCURRENT=2)");
  r1!();
  const r3 = acquireSlot(u);
  assert.ok(r3, "po zwolnieniu slot znów dostępny");
  r2!(); r3!();
});

test("release jest idempotentny (podwójne wywołanie nie psuje licznika)", () => {
  const u = uid();
  const r = acquireSlot(u)!;
  r(); r(); // druga próba zwolnienia — bez efektu
  // po zwolnieniu powinny być znów 2 wolne sloty (nie 3)
  const a = acquireSlot(u), b = acquireSlot(u);
  assert.ok(a && b);
  assert.equal(acquireSlot(u), null, "wciąż max 2 — release nie nadpisał licznika w dół");
  a!(); b!();
});

test("checkRateLimit: pod limitem OK, po przekroczeniu 429 z retryAfter", () => {
  const u = uid();
  for (let i = 0; i < 20; i++) assert.equal(checkRateLimit(u).ok, true, `zapytanie ${i + 1}`);
  const over = checkRateLimit(u);
  assert.equal(over.ok, false, "21. przekracza limit minutowy (20)");
  if (!over.ok) assert.ok(over.retryAfterSec > 0 && over.message.length > 0);
});
