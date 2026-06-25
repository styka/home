import { test } from "node:test";
import assert from "node:assert/strict";
import { isoDay, monthRange } from "@/lib/calendar";

test("isoDay: 'YYYY-MM-DD' w czasie lokalnym, z paddingiem", () => {
  assert.equal(isoDay(new Date(2024, 0, 5)), "2024-01-05");
  assert.equal(isoDay(new Date(2024, 8, 9)), "2024-09-09");
  assert.equal(isoDay(new Date(2024, 11, 31)), "2024-12-31");
});

test("monthRange: półotwarty [start, end), rolowanie grudzień→styczeń", () => {
  const jan = monthRange(2024, 0);
  assert.equal(isoDay(jan.start), "2024-01-01");
  assert.equal(isoDay(jan.end), "2024-02-01", "end = 1. dzień następnego miesiąca (wyłączny)");

  const dec = monthRange(2024, 11);
  assert.equal(isoDay(dec.start), "2024-12-01");
  assert.equal(isoDay(dec.end), "2025-01-01", "grudzień → styczeń kolejnego roku");
});
