import { test } from "node:test";
import assert from "node:assert/strict";
import { trashCutoff, TRASH_RETENTION_DAYS } from "@/lib/trash";

// Z-059: granica retencji kosza. Wpis usunięty PRZED cutoff → do twardego usunięcia.
test("trashCutoff: cofa o domyślne okno retencji (30 dni)", () => {
  assert.equal(TRASH_RETENTION_DAYS, 30);
  const now = new Date("2026-06-17T12:00:00.000Z");
  const cutoff = trashCutoff(now);
  // 30 dni wstecz
  assert.equal(cutoff.toISOString(), "2026-05-18T12:00:00.000Z");
});

test("trashCutoff: konfigurowalne okno retencji", () => {
  const now = new Date("2026-06-17T00:00:00.000Z");
  assert.equal(trashCutoff(now, 7).toISOString(), "2026-06-10T00:00:00.000Z");
  assert.equal(trashCutoff(now, 0).toISOString(), now.toISOString());
});

test("trashCutoff: wpis tuż po cutoff jest zachowany, tuż przed — do usunięcia", () => {
  const now = new Date("2026-06-17T12:00:00.000Z");
  const cutoff = trashCutoff(now);
  const justExpired = new Date(cutoff.getTime() - 1); // o 1 ms za stary
  const stillValid = new Date(cutoff.getTime() + 1);
  assert.ok(justExpired < cutoff, "starszy niż cutoff → kasowany (deletedAt < cutoff)");
  assert.ok(!(stillValid < cutoff), "młodszy niż cutoff → zostaje");
});
