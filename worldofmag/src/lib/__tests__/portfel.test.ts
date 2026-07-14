import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, ELEMENT_KIND_LABELS, ENTRY_KIND_LABELS } from "@/lib/portfel";

// Usuwamy CAŁĄ białą spację. Separator tysięcy w pl-PL to spacja niełamliwa/wąska,
// a jej OBECNOŚĆ zależy od buildu ICU (pełne ICU grupuje „1 234,50", małe nie).
// Po usunięciu spacji oba warianty zlewają się do tych samych cyfr → asercja odporna.
const norm = (s: string) => s.replace(/\s/g, "");

test("formatMoney: PLN, 2 miejsca po przecinku, kwota z tysiącami", () => {
  assert.ok(norm(formatMoney(0)).includes("0,00"), "0 → 0,00");
  assert.ok(norm(formatMoney(0)).includes("zł"), "symbol PLN = zł");
  assert.ok(norm(formatMoney(5)).includes("5,00"), "min 2 miejsca");
  assert.ok(norm(formatMoney(1234.5)).includes("1234,50"), "cyfry + 2 miejsca (niezależnie od grupowania)");
});

test("formatMoney: liczby ujemne mają znak minus", () => {
  const neg = norm(formatMoney(-99.9));
  assert.ok(neg.includes("99,90"));
  assert.match(neg, /[−-]/);
});

test("formatMoney: obca waluta (EUR) renderuje swój symbol", () => {
  const eur = norm(formatMoney(1234.5, "EUR"));
  assert.ok(eur.includes("1234,50"));
  assert.ok(eur.includes("€"));
});

test("etykiety rodzajów: kompletność i poprawność", () => {
  assert.equal(ELEMENT_KIND_LABELS.debt, "Dług");
  assert.equal(ELEMENT_KIND_LABELS.savings, "Oszczędności");
  assert.equal(ENTRY_KIND_LABELS.income, "Przychód");
  assert.equal(ENTRY_KIND_LABELS.expense, "Rozchód");
});
