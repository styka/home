import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, AA_TEXT, AA_LARGE } from "../skins/contrast";
import { FLAGSHIP_SKINS } from "../skins/flagship";
import { validateTokens, resolveTokens, DEFAULT_DARK_TOKENS } from "../skins";

// 045: właściciel postawił warunek — skórka ma być „nienachalna i z zachowaniem estetyki
// i UX". Ocena wzrokiem tego nie załatwia, zwłaszcza w motywach ciemnych, gdzie nasycony
// akcent WYGLĄDA na czytelny, a nie jest. Dlatego kontrast jest liczony i wpięty w testy:
// skórka flagowa, która spadnie poniżej AA, nie przejdzie.

test("kalkulator kontrastu zgadza się ze znanymi wartościami WCAG", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  assert.equal(Math.round(contrastRatio("#ffffff", "#ffffff")), 1);
  // #767676 na bieli to kanoniczna granica AA (4.54:1) — i o jeden odcień jaśniejszy
  // szary już jej NIE spełnia (4.48:1). Ta para pilnuje, że kalkulator jest dokładny
  // co do setnych, a nie tylko „mniej więcej" — przy dobieraniu akcentów różnica
  // między 4.48 a 4.54 decyduje o tym, czy przycisk da się przeczytać.
  assert.ok(contrastRatio("#767676", "#ffffff") >= 4.5, "kanoniczna granica AA");
  assert.ok(contrastRatio("#777777", "#ffffff") < 4.5, "o odcień jaśniejszy — już poniżej progu");
});

test("skrócony zapis #rgb jest równoważny pełnemu", () => {
  assert.equal(contrastRatio("#fff", "#000"), contrastRatio("#ffffff", "#000000"));
});

/** Akcenty, na których stoi tekst `--on-accent` (przyciski, plakietki). */
const ACCENT_KEYS = [
  "--accent-blue",
  "--accent-green",
  "--accent-red",
  "--accent-amber",
  "--accent-purple",
  "--accent-orange",
];

for (const skin of FLAGSHIP_SKINS) {
  test(`skórka „${skin.name}": tekst główny i drugorzędny spełniają AA`, () => {
    const t = resolveTokens(skin.tokens);

    const primary = contrastRatio(t["--text-primary"], t["--bg-base"]);
    assert.ok(primary >= 7, `tekst główny na tle: ${primary.toFixed(2)}:1 (oczekiwane ≥ 7 — AAA)`);

    const onSurface = contrastRatio(t["--text-primary"], t["--bg-surface"]);
    assert.ok(onSurface >= 7, `tekst główny na powierzchni: ${onSurface.toFixed(2)}:1`);

    const secondary = contrastRatio(t["--text-secondary"], t["--bg-base"]);
    assert.ok(secondary >= AA_TEXT, `tekst drugorzędny: ${secondary.toFixed(2)}:1 (oczekiwane ≥ ${AA_TEXT})`);

    const muted = contrastRatio(t["--text-muted"], t["--bg-surface"]);
    assert.ok(muted >= AA_TEXT, `tekst wyciszony na powierzchni: ${muted.toFixed(2)}:1`);
  });

  test(`skórka „${skin.name}": tekst na KAŻDYM akcencie spełnia AA`, () => {
    const t = resolveTokens(skin.tokens);
    for (const key of ACCENT_KEYS) {
      const ratio = contrastRatio(t["--on-accent"], t[key]);
      assert.ok(
        ratio >= AA_TEXT,
        `${key}: tekst na akcencie ${ratio.toFixed(2)}:1 (oczekiwane ≥ ${AA_TEXT}). ` +
          `To jest dokładnie ten błąd, przez który „ładna" skórka staje się bezużyteczna.`,
      );
    }
  });

  test(`skórka „${skin.name}": obramowania i obwódka fokusu są widoczne (AA dla elementów UI)`, () => {
    const t = resolveTokens(skin.tokens);
    const border = contrastRatio(t["--border"], t["--bg-base"]);
    assert.ok(border >= 1.3, `obramowanie ledwo widoczne: ${border.toFixed(2)}:1`);
    const focus = contrastRatio(t["--accent-blue"], t["--bg-base"]);
    assert.ok(focus >= AA_LARGE, `obwódka fokusu: ${focus.toFixed(2)}:1 (oczekiwane ≥ ${AA_LARGE})`);
  });

  test(`skórka „${skin.name}": wszystkie tokeny przechodzą sanityzację`, () => {
    const validated = validateTokens(skin.tokens);
    const rejected = Object.keys(skin.tokens).filter((k) => !(k in validated));
    assert.deepEqual(rejected, [], `odrzucone tokeny: ${rejected.join(", ")}`);
  });

  test(`skórka „${skin.name}": jest kompletna — nie zostawia motywu w połowie`, () => {
    // Skórka CZĘŚCIOWA jest legalna, ale flagowa ma dowodzić możliwości silnika.
    // Skórka ustawiająca same kolory nie pokazałaby typografii ani ruchu.
    const missing = Object.keys(DEFAULT_DARK_TOKENS).filter((k) => !(k in skin.tokens));
    assert.deepEqual(missing, [], `brakujące tokeny: ${missing.join(", ")}`);
  });

  test(`skórka „${skin.name}": nie ustawia ruchu dłuższego niż 300 ms`, () => {
    const t = resolveTokens(skin.tokens);
    for (const key of ["--motion-duration", "--motion-duration-slow"]) {
      const raw = t[key];
      const ms = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
      assert.ok(ms <= 300, `${key} = ${raw} — animacja dłuższa niż 300 ms zaczyna przeszkadzać`);
    }
  });
}

test("skórki flagowe mają unikalne, stałe identyfikatory (klucz migracji seedującej)", () => {
  const ids = FLAGSHIP_SKINS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^skin-system-[a-z]+$/);
});

test("nazwy i opisy skórek nie odwołują się do cudzych znaków towarowych", () => {
  const forbidden = ["star trek", "startrek", "lcars", "apple", "windows"];
  for (const skin of FLAGSHIP_SKINS) {
    const haystack = `${skin.name} ${skin.description}`.toLowerCase();
    for (const word of forbidden) {
      assert.ok(!haystack.includes(word), `„${skin.name}" odwołuje się do: ${word}`);
    }
  }
});
