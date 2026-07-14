import { test } from "node:test";
import assert from "node:assert/strict";
import { timeAgo } from "@/lib/news/format";

const minAgo = (min: number) => new Date(Date.now() - min * 60000).toISOString();

test("timeAgo: progi minut → godzin → dni", () => {
  assert.equal(timeAgo(minAgo(0)), "przed chwilą");
  assert.equal(timeAgo(minAgo(0.4)), "przed chwilą", "<1 min → przed chwilą");
  assert.equal(timeAgo(minAgo(5)), "5 min temu");
  assert.equal(timeAgo(minAgo(59)), "59 min temu");
  assert.equal(timeAgo(minAgo(60)), "1 godz. temu", "60 min → godziny");
  assert.equal(timeAgo(minAgo(150)), "2 godz. temu");
  assert.equal(timeAgo(minAgo(60 * 24)), "1 dni temu", "24 godz. → dni");
  assert.equal(timeAgo(minAgo(60 * 24 * 3)), "3 dni temu");
});

test("timeAgo: data z przyszłości klamrowana do 0 → 'przed chwilą'", () => {
  assert.equal(timeAgo(new Date(Date.now() + 5 * 60000).toISOString()), "przed chwilą");
});
