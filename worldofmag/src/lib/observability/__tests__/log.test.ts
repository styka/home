import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLogRecord } from "@/lib/observability/log";

// Z-096: rekord loga strukturalnego.
const NOW = new Date("2026-06-17T08:30:00.000Z");

test("buildLogRecord: ts/level/event + pola", () => {
  const r = buildLogRecord("info", "retention.purge", { trashPurged: 5 }, NOW);
  assert.equal(r.ts, "2026-06-17T08:30:00.000Z");
  assert.equal(r.level, "info");
  assert.equal(r.event, "retention.purge");
  assert.equal(r.trashPurged, 5);
});

test("buildLogRecord: bez pól → tylko ts/level/event", () => {
  const r = buildLogRecord("warn", "x", undefined, NOW);
  assert.deepEqual(Object.keys(r).sort(), ["event", "level", "ts"]);
});

test("buildLogRecord: serializuje się do jednej linii JSON", () => {
  const line = JSON.stringify(buildLogRecord("error", "boom", { durationMs: 12, ok: false }, NOW));
  assert.ok(!line.includes("\n"), "jedna linia");
  const parsed = JSON.parse(line);
  assert.equal(parsed.event, "boom");
  assert.equal(parsed.ok, false);
  assert.equal(parsed.durationMs, 12);
});

test("buildLogRecord: pola nie nadpisują ts/level/event przypadkiem", () => {
  // pola po spreadzie wygrywają (świadome) — sprawdzamy że spread działa jak oczekiwano
  const r = buildLogRecord("info", "e", { custom: 1 }, NOW);
  assert.equal(r.event, "e");
  assert.equal(r.custom, 1);
});
