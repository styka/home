import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeTokenValue, validateTokens } from "../skins";

// Z-057 / Z-174: testy security boundary skórek — sanitizeTokenValue jest jedyną
// barierą przed wstrzyknięciem CSS przez tokeny motywu (stosowane inline na <html>).

test("kolory: poprawny hex i rgb() przechodzą", () => {
  assert.equal(sanitizeTokenValue("--accent-blue", "#3b82f6"), "#3b82f6");
  assert.equal(sanitizeTokenValue("--accent-blue", "#fff"), "#fff");
  assert.equal(sanitizeTokenValue("--accent-blue", "rgb(10, 20, 30)"), "rgb(10, 20, 30)");
});

test("CSS-injection przez ; { } < > \" ' jest blokowane", () => {
  assert.equal(sanitizeTokenValue("--accent-blue", "#fff;background:red"), null);
  assert.equal(sanitizeTokenValue("--accent-blue", "red}body{display:none"), null);
  assert.equal(sanitizeTokenValue("--accent-blue", '#fff"'), null);
  assert.equal(sanitizeTokenValue("--accent-blue", "</style>"), null);
});

test("url() / expression() / javascript: nie przechodzą (nie-rgb nawiasy)", () => {
  assert.equal(sanitizeTokenValue("--accent-blue", "url(javascript:alert(1))"), null);
  assert.equal(sanitizeTokenValue("--accent-blue", "expression(alert(1))"), null);
  assert.equal(sanitizeTokenValue("--accent-blue", "image-set(x)"), null);
});

test("kolor musi pasować do wzorca (słowa/nieznane formaty odrzucane)", () => {
  assert.equal(sanitizeTokenValue("--accent-blue", "red"), null);
  assert.equal(sanitizeTokenValue("--accent-blue", "transparent"), null);
});

test("nieznany klucz → null", () => {
  assert.equal(sanitizeTokenValue("--evil-key", "#fff"), null);
});

test("schemat: tylko light/dark", () => {
  assert.equal(sanitizeTokenValue("--color-scheme", "light"), "light");
  assert.equal(sanitizeTokenValue("--color-scheme", "dark"), "dark");
  assert.equal(sanitizeTokenValue("--color-scheme", "blue"), null);
  assert.equal(sanitizeTokenValue("--color-scheme", "#fff"), null);
});

test("radius/density: tylko 0 lub \\d{1,3}px", () => {
  assert.equal(sanitizeTokenValue("--radius", "8px"), "8px");
  assert.equal(sanitizeTokenValue("--radius", "0"), "0");
  assert.equal(sanitizeTokenValue("--radius", "1000px"), null);
  assert.equal(sanitizeTokenValue("--radius", "8em"), null);
});

test("nie-string / pusty / za długi → null", () => {
  assert.equal(sanitizeTokenValue("--accent-blue", 123), null);
  assert.equal(sanitizeTokenValue("--accent-blue", ""), null);
  assert.equal(sanitizeTokenValue("--accent-blue", "#" + "a".repeat(80)), null);
});

test("validateTokens: zachowuje poprawne, odrzuca złośliwe", () => {
  const out = validateTokens({
    "--accent-blue": "#3b82f6",
    "--accent-green": "#fff;x:y",   // injection → odrzucone
    "--evil": "#000",                // nieznany klucz → odrzucone
    "--color-scheme": "dark",
  });
  assert.equal(out["--accent-blue"], "#3b82f6");
  assert.equal(out["--color-scheme"], "dark");
  assert.ok(!("--accent-green" in out), "wartość z ; odrzucona");
  assert.ok(!("--evil" in out), "nieznany klucz odrzucony");
});
