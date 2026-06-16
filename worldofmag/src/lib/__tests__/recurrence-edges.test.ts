import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNextDue } from "../recurrence";
import type { RecurringRule } from "@/types";

// Z-174: krawędzie cykliczności nieobjęte podstawowymi testami — przewijanie końca
// miesiąca (dayOfMonth), rok przestępny, wysoki dzień bazowy, weekly bez daysOfWeek.

function ymd(d: Date | null): string {
  assert.ok(d, "oczekiwano daty");
  return `${d!.getFullYear()}-${String(d!.getMonth() + 1).padStart(2, "0")}-${String(d!.getDate()).padStart(2, "0")}`;
}

test("MONTHLY dayOfMonth=31 → luty (28 dni) clampowany do 28, bez przeskoku na marzec", () => {
  const rule = { type: "MONTHLY", interval: 1, dayOfMonth: 31 } as RecurringRule;
  assert.equal(ymd(computeNextDue(new Date(2026, 0, 10), rule)), "2026-02-28");
});

test("MONTHLY dayOfMonth=29 → rok przestępny daje 29 lutego, nieprzestępny 28", () => {
  const rule = { type: "MONTHLY", interval: 1, dayOfMonth: 29 } as RecurringRule;
  assert.equal(ymd(computeNextDue(new Date(2024, 0, 10), rule)), "2024-02-29"); // 2024 przestępny
  assert.equal(ymd(computeNextDue(new Date(2026, 0, 10), rule)), "2026-02-28"); // 2026 nieprzestępny
});

test("MONTHLY dayOfMonth: wysoki dzień bazowy (31.) nie powoduje podwójnego przeskoku miesiąca", () => {
  const rule = { type: "MONTHLY", interval: 1, dayOfMonth: 15 } as RecurringRule;
  // baza 31 stycznia — bez logiki „setDate(1) najpierw" wpadłoby w marzec
  assert.equal(ymd(computeNextDue(new Date(2026, 0, 31), rule)), "2026-02-15");
});

test("MONTHLY bez dayOfMonth: po prostu +interval miesięcy", () => {
  const rule = { type: "MONTHLY", interval: 2 } as RecurringRule;
  assert.equal(ymd(computeNextDue(new Date(2026, 2, 10), rule)), "2026-05-10");
});

test("WEEKLY bez daysOfWeek: +7*interval dni", () => {
  const rule = { type: "WEEKLY", interval: 2 } as RecurringRule;
  assert.equal(ymd(computeNextDue(new Date(2026, 5, 15), rule)), "2026-06-29");
});

test("YEARLY: +interval lat (29 lutego przestępnego → 1 marca nieprzestępnego wg JS)", () => {
  const rule = { type: "YEARLY", interval: 1 } as RecurringRule;
  // 2024-02-29 + 1 rok: JS setFullYear → 2025-03-01 (brak 29 lutego)
  assert.equal(ymd(computeNextDue(new Date(2024, 1, 29), rule)), "2025-03-01");
});
