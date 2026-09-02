import { test } from "node:test";
import assert from "node:assert/strict";
import { dopasujIstniejacy } from "../kontaktZWpisu";

test("dopasujIstniejacy: ta sama nazwa bez rozróżniania wielkości liter i spacji brzegowych", () => {
  const kontakty = [{ name: "dr Anna Kowalska" }, { name: "Jan Nowak" }];
  assert.equal(dopasujIstniejacy(kontakty, "DR ANNA KOWALSKA"), true);
  assert.equal(dopasujIstniejacy(kontakty, "  Jan Nowak  "), true);
  assert.equal(dopasujIstniejacy(kontakty, "Jan Nowakowski"), false);
  assert.equal(dopasujIstniejacy([], "ktokolwiek"), false);
});

test("dopasujIstniejacy: polskie znaki wg locale (Ł/ł)", () => {
  assert.equal(dopasujIstniejacy([{ name: "Łukasz Zieliński" }], "łukasz zieliński"), true);
});
