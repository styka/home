import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeColor, sanitizeIcon } from "../sanitize";
import { FAVORITE_COLORS, DEFAULT_FAVORITE_ICON } from "../favoriteViews";

test("kolor z palety motywu przechodzi", () => {
  for (const kolor of FAVORITE_COLORS) {
    assert.equal(sanitizeColor(kolor), kolor);
  }
});

test("HEX JEST ODRZUCANY — to egzekwowanie skinowalności, nie obrona przed złym typem", () => {
  // Zapisany hex przeżyłby zmianę skórki i świeciłby obcym kolorem w motywie, dla którego go
  // nie dobrano (C-30).
  assert.equal(sanitizeColor("#ff0000"), null);
  assert.equal(sanitizeColor("red"), null);
  assert.equal(sanitizeColor("var(--nieistniejacy-token)"), null);
});

test("brak koloru to brak koloru", () => {
  assert.equal(sanitizeColor(null), null);
  assert.equal(sanitizeColor(undefined), null);
  assert.equal(sanitizeColor(""), null);
});

test("ikona dłuższa niż dwa znaki jest ucinana", () => {
  assert.equal(sanitizeIcon("⭐🔥💡"), "⭐🔥");
});

test("ICONA LICZONA W ZNAKACH UNICODE, NIE W JEDNOSTKACH UTF-16", () => {
  // `slice(0, 2)` na napisie przeciąłby emoji w połowie pary zastępczej i dał krzaczek.
  // Reguła używa `Array.from`, więc liczy prawdziwe znaki — ten test tego pilnuje.
  const wynik = sanitizeIcon("🔥");
  assert.equal(wynik, "🔥");
  assert.equal(Array.from(wynik).length, 1);
});

test("brak ikony daje domyślną gwiazdkę", () => {
  assert.equal(sanitizeIcon(""), DEFAULT_FAVORITE_ICON);
  assert.equal(sanitizeIcon("   "), DEFAULT_FAVORITE_ICON);
  assert.equal(sanitizeIcon(null), DEFAULT_FAVORITE_ICON);
  assert.equal(sanitizeIcon(undefined), DEFAULT_FAVORITE_ICON);
});
