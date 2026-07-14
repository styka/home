import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateOffspring, zygositiesForMode, type PetGene } from "../petGenetics";

// Z-174: kalkulator genetyczny morphów (hodowla). Błędne % = złe decyzje hodowlane.
const g = (gene: string, mode: PetGene["mode"], zygosity: PetGene["zygosity"]): PetGene => ({ gene, mode, zygosity });
const pctOf = (outcomes: { label: string; pct: number }[], needle: string) =>
  outcomes.find((o) => o.label.includes(needle))?.pct;

test("recesywny het × het → 25% widoczny, 50% het, 25% nie nosi", () => {
  const r = calculateOffspring([g("Albino", "recessive", "het")], [g("Albino", "recessive", "het")]);
  assert.equal(r.length, 1);
  assert.equal(pctOf(r[0].outcomes, "widoczny"), 25);
  assert.equal(pctOf(r[0].outcomes, "het Albino"), 50);
  assert.equal(pctOf(r[0].outcomes, "nie nosi"), 25);
});

test("recesywny visual × normal → 100% het", () => {
  const r = calculateOffspring([g("Albino", "recessive", "visual")], [g("Albino", "recessive", "normal")]);
  assert.equal(r.length, 1);
  assert.equal(pctOf(r[0].outcomes, "het Albino"), 100);
  assert.equal(pctOf(r[0].outcomes, "widoczny"), undefined, "0% odfiltrowane");
});

test("kodominujący het × het → 25% super, 50% widoczny, 25% nie nosi", () => {
  const r = calculateOffspring([g("Pastel", "codominant", "het")], [g("Pastel", "codominant", "het")]);
  const exact = (label: string) => r[0].outcomes.find((o) => o.label === label)?.pct;
  assert.equal(exact("super Pastel"), 25);
  assert.equal(exact("Pastel"), 50); // dokładne dopasowanie (nie „super Pastel")
  assert.equal(pctOf(r[0].outcomes, "nie nosi"), 25);
});

test("gen tylko u jednego rodzica → drugi traktowany jak normalny (het 50 / nie 50)", () => {
  const r = calculateOffspring([g("Albino", "recessive", "het")], []);
  assert.equal(pctOf(r[0].outcomes, "het Albino"), 50);
  assert.equal(pctOf(r[0].outcomes, "nie nosi"), 50);
});

test("brak wspólnych zmutowanych genów → pusty wynik", () => {
  assert.deepEqual(calculateOffspring([g("X", "recessive", "normal")], [g("Y", "recessive", "normal")]), []);
});

test("dopasowanie genów case-insensitive", () => {
  const r = calculateOffspring([g("albino", "recessive", "het")], [g("ALBINO", "recessive", "het")]);
  assert.equal(r.length, 1, "ten sam gen mimo wielkości liter");
});

test("zygositiesForMode: dozwolone zygotyczności per tryb", () => {
  assert.deepEqual(zygositiesForMode("recessive"), ["normal", "het", "visual"]);
  assert.deepEqual(zygositiesForMode("codominant"), ["normal", "het", "super"]);
});
