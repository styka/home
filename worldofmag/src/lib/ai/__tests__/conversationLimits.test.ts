import { test } from "node:test";
import assert from "node:assert/strict";
import { boundMessageData, MAX_DATA_BYTES, MESSAGE_WINDOW } from "@/lib/ai/conversationLimits";

// Z-215: ochrona pamięci historii rozmów asystenta.
test("MESSAGE_WINDOW i MAX_DATA_BYTES mają sensowne wartości", () => {
  assert.ok(MESSAGE_WINDOW > 0 && MESSAGE_WINDOW <= 1000);
  assert.equal(MAX_DATA_BYTES, 128 * 1024);
});

test("boundMessageData: brak danych → undefined (nie zapisujemy)", () => {
  assert.equal(boundMessageData(undefined), undefined);
  assert.equal(boundMessageData(null), undefined);
});

test("boundMessageData: małe dane przechodzą bez zmian", () => {
  const data = { plan: [{ type: "add_task", title: "x" }] };
  assert.equal(boundMessageData(data), data);
});

test("boundMessageData: dane > limitu → marker truncated (treść chroniona)", () => {
  const huge = { blob: "x".repeat(MAX_DATA_BYTES + 10) };
  const res = boundMessageData(huge) as { truncated?: boolean };
  assert.equal(res.truncated, true);
});

test("boundMessageData: nieserializowalne (BigInt) → undefined, nie wyjątek", () => {
  assert.equal(boundMessageData({ n: BigInt(1) }), undefined);
});

test("boundMessageData: dokładnie na granicy limitu przechodzi", () => {
  // string krótszy, by cały JSON zmieścił się w limicie
  const data = { s: "a".repeat(MAX_DATA_BYTES - 100) };
  const res = boundMessageData(data);
  assert.equal(res, data, "tuż pod limitem → bez truncation");
});
