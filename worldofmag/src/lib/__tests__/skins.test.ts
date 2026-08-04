import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeTokenValue,
  validateTokens,
  parseTokens,
  resolveTokens,
  tokensToStyle,
  fontStack,
  DEFAULT_DARK_TOKENS,
  ALL_CONTROLS,
  ALLOWED_TOKEN_KEYS,
} from "../skins";

// Z-057 / Z-174: testy security boundary skórek — sanitizeTokenValue jest jedyną
// barierą przed wstrzyknięciem CSS przez tokeny motywu (stosowane inline na <html>).
//
// 045: skórka przestała być mapą kolorów — doszły gradienty, cienie i krzywe ruchu,
// czyli rodzaje, które Z NATURY wymagają nawiasów. Do tego skórkę można teraz
// ZAIMPORTOWAĆ Z PLIKU, więc źródło bywa obce. Testy poniżej pilnują, żeby ta zmiana
// nie otworzyła furtki, którą powyższe testy zamykały dla samych kolorów.

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

// ─── 045: nowe rodziny tokenów ───────────────────────────────────────────────

test("url() jest blokowane W KAŻDYM rodzaju — także tam, gdzie CSS by je przyjął", () => {
  assert.equal(sanitizeTokenValue("--bg-image-base", "url(https://obcy.example/x.png)"), null);
  assert.equal(sanitizeTokenValue("--bg-image-surface", "URL(data:image/svg+xml;base64,AAAA)"), null);
  assert.equal(sanitizeTokenValue("--shadow-elevated", "0 0 4px url(x)"), null);
});

test("komentarz CSS, @import i javascript: nie przechodzą w tokenach złożonych", () => {
  assert.equal(sanitizeTokenValue("--shadow-glow", "0 0 4px /* x */ red"), null);
  assert.equal(sanitizeTokenValue("--bg-image-base", "@import 'x'"), null);
  assert.equal(sanitizeTokenValue("--bg-image-base", "linear-gradient(javascript:alert(1),red)"), null);
  assert.equal(sanitizeTokenValue("--bg-image-base", "linear-gradient(red,blue); background: url(x)"), null);
});

test("background: dozwolone wyłącznie funkcje gradientu", () => {
  const lin = "linear-gradient(180deg, #101014 0%, #16161c 100%)";
  assert.equal(sanitizeTokenValue("--bg-image-base", lin), lin);
  const rad = "radial-gradient(circle at 20% 0%, #1a1a22 0%, #0d0d0d 60%)";
  assert.equal(sanitizeTokenValue("--bg-image-surface", rad), rad);
  assert.equal(sanitizeTokenValue("--bg-image-base", "none"), "none");
  assert.equal(sanitizeTokenValue("--bg-image-base", "paint(myWorklet)"), null, "paint() poza whitelistą");
  assert.equal(sanitizeTokenValue("--bg-image-base", "element(#x)"), null, "element() poza whitelistą");
});

test("shadow: dozwolone wyłącznie funkcje koloru", () => {
  const sh = "0 4px 16px rgba(0,0,0,0.4)";
  assert.equal(sanitizeTokenValue("--shadow-elevated", sh), sh);
  const glow = "0 0 12px color-mix(in srgb, #f5a524 40%, transparent)";
  assert.equal(sanitizeTokenValue("--shadow-glow", glow), glow);
  assert.equal(sanitizeTokenValue("--shadow-surface", "none"), "none");
  assert.equal(sanitizeTokenValue("--shadow-glow", "0 0 4px attr(data-x)"), null, "attr() poza whitelistą");
});

test("limit długości jest zależny od rodzaju: gradient dłuższy, ale nadal ograniczony", () => {
  const ok = "linear-gradient(180deg, #101014 0%, #16161c 40%, #101014 100%)";
  assert.equal(sanitizeTokenValue("--bg-image-base", ok), ok);
  const tooLong = "linear-gradient(180deg," + " #101014 0%,".repeat(30) + "#000 100%)";
  assert.equal(sanitizeTokenValue("--bg-image-base", tooLong), null);
});

test("font: tylko słowo kluczowe z zamkniętej listy (nigdy dowolny stos)", () => {
  assert.equal(sanitizeTokenValue("--font-family-base", "serif"), "serif");
  assert.equal(sanitizeTokenValue("--font-family-display", "condensed"), "condensed");
  assert.equal(sanitizeTokenValue("--font-family-base", "Comic Sans MS"), null);
  assert.equal(sanitizeTokenValue("--font-family-base", '"Evil", serif'), null);
});

test("keyword: tylko wartości zadeklarowane w kontrolce", () => {
  assert.equal(sanitizeTokenValue("--text-transform-heading", "uppercase"), "uppercase");
  assert.equal(sanitizeTokenValue("--text-transform-heading", "lowercase"), null);
  assert.equal(sanitizeTokenValue("--border-style", "dashed"), "dashed");
  assert.equal(sanitizeTokenValue("--border-style", "groove"), null);
  assert.equal(sanitizeTokenValue("--chrome-frame", "corners"), "corners");
});

test("weight / tracking / number / duration / easing", () => {
  assert.equal(sanitizeTokenValue("--font-weight-heading", "700"), "700");
  assert.equal(sanitizeTokenValue("--font-weight-heading", "750"), null);
  assert.equal(sanitizeTokenValue("--letter-spacing-heading", "0.08em"), "0.08em");
  assert.equal(sanitizeTokenValue("--letter-spacing-base", "-0.01em"), "-0.01em");
  assert.equal(sanitizeTokenValue("--line-height-base", "1.5"), "1.5");
  assert.equal(sanitizeTokenValue("--line-height-base", "1.5px"), null);
  assert.equal(sanitizeTokenValue("--motion-duration", "120ms"), "120ms");
  assert.equal(sanitizeTokenValue("--motion-duration-slow", "0.3s"), "0.3s");
  assert.equal(sanitizeTokenValue("--motion-duration", "120"), null);
  assert.equal(sanitizeTokenValue("--motion-easing", "ease-in-out"), "ease-in-out");
  assert.equal(sanitizeTokenValue("--motion-easing", "cubic-bezier(0.4, 0, 0.2, 1)"), "cubic-bezier(0.4, 0, 0.2, 1)");
  assert.equal(sanitizeTokenValue("--motion-easing", "steps(4)"), null, "steps() poza whitelistą");
});

test("length dopuszcza rem/em, ale radius i gęstość nadal tylko px", () => {
  assert.equal(sanitizeTokenValue("--view-padding", "1.5rem"), "1.5rem");
  assert.equal(sanitizeTokenValue("--control-height", "44px"), "44px");
  assert.equal(sanitizeTokenValue("--radius", "8em"), null, "promień w em skalowałby się z tekstem");
  assert.equal(sanitizeTokenValue("--radius", "1000px"), null, "to nie zaokrąglenie, tylko awaria układu");
});

test("import obcej skórki: złe wartości giną, reszta zostaje", () => {
  const out = validateTokens({
    "--bg-base": "#111111",
    "--accent-blue": "#zzzzzz",
    "--bg-image-base": "url(evil.png)",
    "--nieznany-token": "#ffffff",
    "--radius": "8px",
  });
  assert.deepEqual(out, { "--bg-base": "#111111", "--radius": "8px" });
});

test("parseTokens: uszkodzony JSON daje pustą mapę, nie wyjątek", () => {
  assert.deepEqual(parseTokens("{nie-json"), {});
  assert.deepEqual(parseTokens(null), {});
  assert.deepEqual(parseTokens('{"--radius":"8px"}'), { "--radius": "8px" });
});

test("skórka częściowa: brakujące tokeny dziedziczą domyślne, żaden nie ginie", () => {
  const resolved = resolveTokens({ "--bg-base": "#ffffff", "--radius": "0" });
  assert.equal(resolved["--bg-base"], "#ffffff");
  assert.equal(resolved["--text-primary"], DEFAULT_DARK_TOKENS["--text-primary"]);
  assert.equal(resolved["--motion-easing"], DEFAULT_DARK_TOKENS["--motion-easing"]);
  assert.equal(Object.keys(resolved).length, Object.keys(DEFAULT_DARK_TOKENS).length);
});

test('pusta skórka („Dark" = {}) daje dokładnie domyślne wartości', () => {
  assert.deepEqual(resolveTokens({}), DEFAULT_DARK_TOKENS);
});

test("tokensToStyle: słowo kluczowe czcionki jest tłumaczone na stos", () => {
  const style = tokensToStyle({ "--font-family-base": "serif", "--radius": "8px" }) as Record<string, string>;
  assert.ok(style["--font-family-base"].includes("Georgia"), "stos szeryfowy");
  assert.equal(style["--radius"], "8px", "pozostałe tokeny bez zmian");
});

test("fontStack: nieznane słowo degraduje do systemowego, nie wywala", () => {
  assert.equal(fontStack("nieistniejaca"), fontStack("system"));
});

// ─── Spójność rejestru ───────────────────────────────────────────────────────

test("każdy token ma kontrolkę, a każda kontrolka wartość domyślną", () => {
  for (const key of Object.keys(DEFAULT_DARK_TOKENS)) {
    assert.ok(ALLOWED_TOKEN_KEYS.has(key), `brak kontrolki dla ${key}`);
  }
  for (const control of ALL_CONTROLS) {
    assert.ok(control.key in DEFAULT_DARK_TOKENS, `brak wartości domyślnej dla ${control.key}`);
  }
});

test("każda wartość domyślna przechodzi własną sanityzację", () => {
  for (const [key, value] of Object.entries(DEFAULT_DARK_TOKENS)) {
    assert.equal(sanitizeTokenValue(key, value), value, `domyślna wartość ${key} nie przechodzi walidacji`);
  }
});

test("kontrolki keyword/font mają opcje, a klucze są unikalne", () => {
  for (const control of ALL_CONTROLS) {
    if (control.kind === "keyword" || control.kind === "font") {
      assert.ok(control.options && control.options.length > 0, `${control.key} bez listy opcji`);
    }
  }
  const keys = ALL_CONTROLS.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length, "zduplikowany klucz kontrolki");
});
