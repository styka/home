import { test } from "node:test";
import assert from "node:assert/strict";
import {
  walidujDefinicje,
  parseDefinicja,
  SCHEMA_VERSION,
  LIMIT_DEFINICJI,
} from "@/lib/skins/zaawansowane";
import { kompilujDefinicje } from "@/lib/skins/kompilacja";

// 116 — testy formatu skórki zaawansowanej. Definicję generuje LLM, więc walidacja
// to granica zaufania: wszystko niebezpieczne albo nieznane ma trafić na listę
// `odrzucone` (pokazywaną użytkownikowi), a jedno błędne pole nie może unieważnić
// reszty skórki (AC-4). Kompilator z kolei nigdy nie buduje `url()` z tekstu
// definicji — tylko z id zweryfikowanego względem listy assetów (AC-6/AC-9).

const POPRAWNA = {
  schemaVersion: 1,
  tokens: { "--bg-base": "#0b1020", "--accent-blue": "#22d3ee" },
  layout: { nav: "sidebar-prawy" },
  components: {
    button: {
      bg: "linear-gradient(135deg, #0ea5e9, #6366f1)",
      text: "#ffffff",
      radius: "2px",
      textTransform: "uppercase",
      states: { hover: { bg: "#38bdf8" }, disabled: { opacity: "0.4" } },
    },
    card: { bg: "#101828", radius: "12px" },
    navigation: { bg: "#050a14", frame: "corners" },
  },
  states: { error: { accent: "#ff5470" } },
  animations: {
    contentEntrance: { name: "slide-up", duration: "240ms", intensity: "strong" },
    buttonHover: { name: "glow-pulse" },
  },
  responsive: { mobile: { tokens: { "--font-size-base": "13px" } } },
  assets: [{ id: "clxyz123abc456def789ghij", slot: "app-background", fit: "cover" }],
};

test("poprawna definicja przechodzi w całości", () => {
  const { definicja, odrzucone } = walidujDefinicje(POPRAWNA);
  assert.deepEqual(odrzucone, []);
  assert.equal(definicja.schemaVersion, SCHEMA_VERSION);
  assert.equal(definicja.layout?.nav, "sidebar-prawy");
  assert.equal(definicja.components?.button.bg, "linear-gradient(135deg, #0ea5e9, #6366f1)");
  assert.equal(definicja.components?.button.states?.hover.bg, "#38bdf8");
  assert.equal(definicja.animations?.contentEntrance?.name, "slide-up");
  assert.equal(definicja.assets?.[0].slot, "app-background");
});

test("niebezpieczne wartości są odrzucane po nazwie, reszta zostaje (AC-4)", () => {
  const { definicja, odrzucone } = walidujDefinicje({
    schemaVersion: 1,
    tokens: {
      "--bg-base": "#101010",
      "--bg-image-base": 'url("https://zlo.example/x.png")', // url( zakazane w tokenach
    },
    components: {
      button: {
        bg: "expression(alert(1))",
        text: "#e8e8e8",
        radius: "6px; } body { display: none", // średnik i klamra — wstrzyknięcie
      },
      hacker: { bg: "#000000" }, // komponent spoza katalogu
    },
    animations: {
      contentEntrance: { name: "spin-forever" }, // nazwa spoza katalogu
      buttonHover: { name: "scale", duration: "99999ms" }, // ponad limit 3000 ms
    },
  });
  assert.ok(odrzucone.includes("tokens.--bg-image-base"));
  assert.ok(odrzucone.includes("components.button.bg"));
  assert.ok(odrzucone.includes("components.button.radius"));
  assert.ok(odrzucone.includes("components.hacker"));
  assert.ok(odrzucone.includes("animations.contentEntrance.name"));
  assert.ok(odrzucone.includes("animations.buttonHover.duration"));
  // reszta przeżyła:
  assert.equal(definicja.tokens?.["--bg-base"], "#101010");
  assert.equal(definicja.components?.button.text, "#e8e8e8");
  assert.equal(definicja.animations?.buttonHover?.name, "scale");
});

test("nieznane pole najwyższego poziomu ląduje na liście, definicja działa", () => {
  const { definicja, odrzucone } = walidujDefinicje({
    schemaVersion: 1,
    tokens: { "--bg-base": "#111111" },
    customCss: "body { background: red }",
  });
  assert.ok(odrzucone.includes("customCss"));
  assert.equal(definicja.tokens?.["--bg-base"], "#111111");
});

test("definicja ponad limit rozmiaru jest odrzucana w całości", () => {
  const { definicja, odrzucone } = walidujDefinicje({
    schemaVersion: 1,
    tokens: { "--bg-base": "#111111" },
    balast: "x".repeat(LIMIT_DEFINICJI),
  });
  assert.deepEqual(odrzucone, ["definicja.rozmiar"]);
  assert.equal(definicja.tokens, undefined);
});

test("nieznana (przyszła) wersja schematu → pusta definicja, nie wyjątek (AC-13)", () => {
  const { definicja, odrzucone } = walidujDefinicje({ schemaVersion: 99, tokens: { "--bg-base": "#111" } });
  assert.deepEqual(odrzucone, ["schemaVersion"]);
  assert.equal(definicja.schemaVersion, SCHEMA_VERSION);
  assert.equal(definicja.tokens, undefined);
});

test("brak schemaVersion = wersja bieżąca (LLM może pominąć pole)", () => {
  const { definicja, odrzucone } = walidujDefinicje({ tokens: { "--bg-base": "#0d0d0d" } });
  assert.deepEqual(odrzucone, []);
  assert.equal(definicja.tokens?.["--bg-base"], "#0d0d0d");
});

test("parseDefinicja nie rzuca na zepsutym JSON-ie (AC-9)", () => {
  const def = parseDefinicja("to nie jest json {");
  assert.equal(def.schemaVersion, SCHEMA_VERSION);
  assert.equal(def.tokens, undefined);
});

test("kompilacja: aliasy komponentów piszą do istniejących tokenów", () => {
  const { definicja } = walidujDefinicje(POPRAWNA);
  const w = kompilujDefinicje(definicja, [{ id: "clxyz123abc456def789ghij", mimeType: "image/png" }]);
  assert.equal(w.tokens["--bg-surface"], "#101828"); // card.bg
  assert.equal(w.tokens["--radius-lg"], "12px"); // card.radius
  assert.equal(w.tokens["--chrome-bg"], "#050a14"); // navigation.bg
  assert.equal(w.tokens["--chrome-frame"], "corners");
  assert.equal(w.tokens["--accent-red"], "#ff5470"); // states.error.accent
});

test("kompilacja: rodzina przycisku jest DOPEŁNIANA, bramki stają się atrybutami", () => {
  const { definicja } = walidujDefinicje({
    schemaVersion: 1,
    components: { button: { text: "#000000" } }, // tylko tekst
  });
  const w = kompilujDefinicje(definicja, []);
  assert.equal(w.tokens["--c-btn-text"], "#000000");
  // bg dopełnione bazowym akcentem — reguła przepisuje wszystkie zmienne naraz:
  assert.equal(w.tokens["--c-btn-bg"], "#3b82f6");
  assert.equal(w.tokens["--c-btn-hover-bg"], "#3b82f6");
  assert.equal(w.atrybuty["data-c-btn"], "1");
  assert.equal(w.atrybuty["data-c-btn-radius"], undefined); // radius nieustawiony → bez bramki
});

test("kompilacja: url() powstaje tylko dla assetu istniejącego w magazynie", () => {
  const { definicja } = walidujDefinicje({
    schemaVersion: 1,
    assets: [
      { id: "clprawdziwy0123456789abcd", slot: "app-background" },
      { id: "clnieistnieje123456789abc", slot: "nav-background" },
      { slot: "surface-texture", status: "missing", prompt: "tekstura starego papieru" },
    ],
  });
  const w = kompilujDefinicje(definicja, [{ id: "clprawdziwy0123456789abcd", mimeType: "image/webp" }]);
  assert.equal(w.tokens["--bg-image-base"], 'url("/api/skins/assets/clprawdziwy0123456789abcd")');
  assert.equal(w.tokens["--c-nav-bg-image"], undefined); // nieistniejący → slot pominięty
  assert.equal(w.ostrzezenia.length, 2); // nieistniejący + missing
  assert.ok(w.ostrzezenia.some((o) => o.includes("tekstura starego papieru")));
});

test("kompilacja: wariant układu i animacje idą atrybutami data-*", () => {
  const { definicja } = walidujDefinicje(POPRAWNA);
  const w = kompilujDefinicje(definicja, []);
  assert.equal(w.atrybuty["data-nav"], "sidebar-prawy");
  assert.equal(w.atrybuty["data-anim-content"], "slide-up");
  assert.equal(w.tokens["--anim-content-dur"], "240ms");
  assert.equal(w.tokens["--anim-content-dist"], "16px"); // intensity: strong
  assert.equal(w.atrybuty["data-anim-btn-hover"], "glow-pulse");
  assert.match(w.tokens["--anim-btnh-glow"], /^0 0 \d+px rgba\(\d+,\d+,\d+,0\.55\)$/);
});

test("kompilacja: sidebar-lewy (domyślny) nie emituje atrybutu", () => {
  const { definicja } = walidujDefinicje({ schemaVersion: 1, layout: { nav: "sidebar-lewy" } });
  const w = kompilujDefinicje(definicja, []);
  assert.equal(w.atrybuty["data-nav"], undefined);
});

test("kompilacja: nadpisania mobilne przenoszą token do pary --d-/--m- (AC-10/17)", () => {
  const { definicja } = walidujDefinicje({
    schemaVersion: 1,
    tokens: { "--font-size-base": "15px" },
    responsive: { mobile: { tokens: { "--font-size-base": "13px" } } },
  });
  const w = kompilujDefinicje(definicja, []);
  assert.equal(w.tokens["--font-size-base"], undefined); // NIE wolno zostawić inline
  assert.equal(w.tokens["--d-font-size-base"], "15px");
  assert.equal(w.tokens["--m-font-size-base"], "13px");
  assert.equal(w.atrybuty["data-resp-mobile"], "1");
});

test("kompilacja: ostrzega o niskim kontraście, ale nie blokuje (AC-11)", () => {
  const { definicja } = walidujDefinicje({
    schemaVersion: 1,
    tokens: { "--bg-base": "#eeeeee", "--text-primary": "#dddddd" },
  });
  const w = kompilujDefinicje(definicja, []);
  assert.ok(w.ostrzezenia.some((o) => o.includes("Niski kontrast")));
  assert.equal(w.tokens["--text-primary"], "#dddddd"); // wartość zostaje — decyzja użytkownika
});

test("pusta definicja kompiluje się do pustej mapy (fallback, AC-9)", () => {
  const w = kompilujDefinicje(parseDefinicja(null), []);
  assert.deepEqual(w.tokens, {});
  assert.deepEqual(w.atrybuty, {});
});
