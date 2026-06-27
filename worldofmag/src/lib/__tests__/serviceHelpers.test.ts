import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "@/lib/services/helpers";

// Usługi — slugify wykonawcy (publiczny URL /providers/[slug]). Dotąd bez testu.
test("slugify: spacje → myślniki, lowercase", () => {
  assert.equal(slugify("Jan Kowalski"), "jan-kowalski");
});

test("slugify: zwija wielokrotne separatory i przycina brzegowe", () => {
  assert.equal(slugify("  Multiple   Spaces!!!  "), "multiple-spaces");
  assert.equal(slugify("--hej--"), "hej");
});

test("slugify: usuwa diakrytyki rozkładalne (ą ę ó ś ż ź ć ń)", () => {
  assert.equal(slugify("Zażółć gęślą jaźń"), "zazolc-gesla-jazn");
});

test("slugify: polskie ł/Ł mapowane na l (nie staje się separatorem)", () => {
  assert.equal(slugify("Łódź"), "lodz");
  assert.equal(slugify("Wałbrzych"), "walbrzych");
});

test("slugify: pusty / same znaki specjalne → fallback 'wykonawca'", () => {
  assert.equal(slugify(""), "wykonawca");
  assert.equal(slugify("!!! @@@ ###"), "wykonawca");
  assert.equal(slugify("   "), "wykonawca");
});

test("slugify: ucina do 48 znaków", () => {
  const s = slugify("a".repeat(100));
  assert.ok(s.length <= 48);
  assert.equal(s, "a".repeat(48));
});
