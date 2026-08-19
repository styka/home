import { test } from "node:test";
import assert from "node:assert/strict";
import { wyodrebnijTokeny, znormalizujKlucz, znormalizujWartosc } from "@/lib/skins/mapowanie";
import { validateTokens } from "@/lib/skins";

// 081 (Z10). Zgłoszenie właściciela: opis „Skórka nawiązująca do kosmicznej sagi Star Trek"
// kończył się komunikatem „Model nie odesłał żadnych tokenów". Model odsyłał je regularnie —
// tylko w innym kształcie niż jedno miejsce, z którego czytaliśmy (`parsed.tokens`).
//
// Te testy opisują kształty, w których modele realnie oddają mapę zmiennych CSS. Każdy z nich
// dawał wcześniej ZERO tokenów i nieprawdziwy komunikat.

test("kształt kanoniczny działa jak dotąd", () => {
  const w = wyodrebnijTokeny({ tokens: { "--bg-base": "#0b1020", "--text-primary": "#e8f1ff" } });
  assert.equal(w.zrodlo, "tokens");
  assert.equal(Object.keys(w.tokeny).length, 2);
  assert.equal(w.tokeny["--bg-base"], "#0b1020");
});

test("model opakował tokeny w inny pojemnik", () => {
  for (const pojemnik of ["variables", "cssVariables", "theme", "styles"]) {
    const w = wyodrebnijTokeny({ [pojemnik]: { "--bg-base": "#101010" } });
    assert.equal(w.tokeny["--bg-base"], "#101010", `pojemnik ${pojemnik}`);
  }
});

test("model odesłał TABLICĘ par zamiast mapy", () => {
  const w = wyodrebnijTokeny({
    tokens: [
      { name: "--bg-base", value: "#0b1020" },
      { key: "--text-primary", value: "#ffffff" },
      { token: "--accent-blue", val: "#4f8cff" },
    ],
  });
  assert.equal(Object.keys(w.tokeny).length, 3);
  assert.equal(w.tokeny["--accent-blue"], "#4f8cff");
});

test("model wypisał tokeny płasko, obok pól opisowych", () => {
  const w = wyodrebnijTokeny({
    name: "Mostek",
    description: "Chłodny granat",
    "--bg-base": "#050a18",
    "--text-primary": "#dbe9ff",
  });
  assert.equal(w.zrodlo, "korzeń");
  assert.equal(Object.keys(w.tokeny).length, 2);
});

test("inna konwencja nazwy klucza jest tłumaczona, nie odrzucana", () => {
  assert.equal(znormalizujKlucz("bgBase"), "--bg-base");
  assert.equal(znormalizujKlucz("bg-base"), "--bg-base");
  assert.equal(znormalizujKlucz("--BG-Base"), "--bg-base");
  assert.equal(znormalizujKlucz("  --bg_base  "), "--bg-base");
  assert.equal(znormalizujKlucz('"--bg-base"'), "--bg-base");

  const w = wyodrebnijTokeny({ tokens: { bgBase: "#000000", "text-primary": "#ffffff" } });
  assert.equal(Object.keys(w.tokeny).length, 2);
});

test("LICZBA w JSON zamiast napisu — token nie może ginąć po cichu", () => {
  // To był najbardziej podstępny przypadek: JSON ma prawdziwe liczby, CSS nie, a walidator
  // przyjmuje wyłącznie napisy. `"--font-weight-heading": 700` znikało bez śladu.
  assert.equal(znormalizujWartosc(700), "700");
  assert.equal(znormalizujWartosc(1.5), "1.5");

  const w = wyodrebnijTokeny({ tokens: { "--font-weight-heading": 700, "--line-height-base": 1.5 } });
  const bezpieczne = validateTokens(w.tokeny);
  assert.equal(bezpieczne["--font-weight-heading"], "700", "waga musi przejść walidację");
  assert.equal(bezpieczne["--line-height-base"], "1.5");
});

test("wartości złożone są odrzucane — nie ma dla nich sensownego tłumaczenia", () => {
  assert.equal(znormalizujWartosc({ r: 1 }), null);
  assert.equal(znormalizujWartosc([1, 2]), null);
  assert.equal(znormalizujWartosc(null), null);
  assert.equal(znormalizujWartosc(""), null);
});

test("wybieramy pojemnik, z którego da się złożyć WIĘCEJ skórki", () => {
  // Model odesłał i kadłubkowy `tokens`, i pełny `variables`. Pierwszy napotkany byłby złym wyborem.
  const w = wyodrebnijTokeny({
    tokens: { "--bg-base": "#000000" },
    variables: { "--bg-base": "#050a18", "--text-primary": "#dbe9ff", "--accent-blue": "#4f8cff" },
  });
  assert.equal(w.zrodlo, "variables");
  assert.equal(Object.keys(w.tokeny).length, 3);
});

test("klucze spoza katalogu są RAPORTOWANE, nie chowane", () => {
  const w = wyodrebnijTokeny({ tokens: { "--kolor-tla": "#000000", "--bg-base": "#111111" } });
  assert.equal(w.tokeny["--bg-base"], "#111111");
  assert.deepEqual(w.nieznane, ["--kolor-tla"]);
});

test("gdy NIC nie pasuje, wiemy ile model przysłał — to jest różnica między dwoma komunikatami", () => {
  const w = wyodrebnijTokeny({ tokens: { "--kolor-tla": "#000", "--czcionka": "serif" } });
  assert.equal(Object.keys(w.tokeny).length, 0);
  assert.equal(w.nieznane.length, 2, "trzeba umieć powiedzieć: przysłał 2 klucze, żaden nie pasuje");
});

test("odpowiedź bez tokenów nie wywraca funkcji", () => {
  for (const wejscie of [null, undefined, "tekst", 42, {}, { tokens: null }, { tokens: [] }]) {
    const w = wyodrebnijTokeny(wejscie);
    assert.equal(Object.keys(w.tokeny).length, 0);
  }
});

test("warstwa mapowania NIE rozluźnia walidacji", () => {
  // Sedno bezpieczeństwa: mapowanie doprowadza dane do postaci, na której walidacja może się
  // wypowiedzieć — i nic ponad to. Wstrzyknięcie ma dalej odpadać.
  const w = wyodrebnijTokeny({ tokens: { "--bg-base": "url(https://zlo.example/x.png)" } });
  assert.equal(w.tokeny["--bg-base"], "url(https://zlo.example/x.png)", "mapowanie przepuszcza…");
  assert.equal(validateTokens(w.tokeny)["--bg-base"], undefined, "…a walidacja odrzuca");
});
