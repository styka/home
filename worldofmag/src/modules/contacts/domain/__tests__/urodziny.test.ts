import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBirthday } from "../urodziny";

test("parseBirthday: poprawna data → północ UTC tego dnia", () => {
  const d = parseBirthday("1990-05-17");
  assert.ok(d);
  assert.equal(d!.toISOString(), "1990-05-17T00:00:00.000Z");
});

test("parseBirthday: puste/null → null", () => {
  assert.equal(parseBirthday(null), null);
  assert.equal(parseBirthday(undefined), null);
  assert.equal(parseBirthday("  "), null);
});

test("parseBirthday: zły format i nieistniejąca data rzucają", () => {
  assert.throws(() => parseBirthday("17.05.1990"), /RRRR-MM-DD/);
  assert.throws(() => parseBirthday("1990-13-40"), /Nieprawidłowa/);
});
