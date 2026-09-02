import { test } from "node:test";
import assert from "node:assert/strict";
import {
  podzielNaFragmenty,
  odzyskajSlowka,
  scalSlowka,
  type SlowkoZTekstu,
} from "../ekstrakcjaSlowek";

// 121 (zgł. 1). Zgłoszenie właściciela: „jest ograniczenie przygotowania do 25 słówek z podanego
// tekstu, a powinny być wszystkie". Te testy pilnują dwóch rzeczy: że NIC w tej warstwie nie
// ucina listy po liczbie pozycji, i że ucięta budżetem odpowiedź oddaje kompletne pozycje
// zamiast zbijać całą operację (lekcja 119/120).

function slowko(term: string, translation = `tł-${term}`): SlowkoZTekstu {
  return { term, translation, example: null, partOfSpeech: null };
}

test("podzielNaFragmenty: krótki tekst = jeden fragment, bez zmian treści", () => {
  assert.deepEqual(podzielNaFragmenty("Ala ma kota.", 4000), ["Ala ma kota."]);
  assert.deepEqual(podzielNaFragmenty("   ", 4000), []);
});

test("podzielNaFragmenty: tnie na granicy, nigdy w środku słowa, i niczego nie gubi", () => {
  const zdania = Array.from({ length: 40 }, (_, i) => `Zdanie numer ${i} o czymś ważnym.`);
  const tekst = zdania.join(" ");
  const fragmenty = podzielNaFragmenty(tekst, 200);
  assert.ok(fragmenty.length > 1, "długi tekst ma się podzielić");
  for (const f of fragmenty) assert.ok(f.length <= 200, `fragment ponad limit: ${f.length}`);
  // Sklejone fragmenty = pełny tekst; gdyby cięcie padło w środku słowa, sklejenie przez spację
  // rozerwałoby to słowo i równość by nie zaszła — ta jedna asercja dowodzi obu własności.
  assert.equal(fragmenty.join(" ").replace(/\s+/g, " "), tekst.replace(/\s+/g, " "));
});

test("podzielNaFragmenty: słowo dłuższe niż limit nie zapętla podziału i trzyma limit", () => {
  const fragmenty = podzielNaFragmenty("x".repeat(500), 100);
  assert.equal(fragmenty.join(""), "x".repeat(500));
  for (const f of fragmenty) assert.ok(f.length <= 100, `fragment ponad limit: ${f.length}`);
});

test("odzyskajSlowka: kanoniczny JSON i płotki markdown wokół niego", () => {
  const czysty = '{"words":[{"term":"cat","translation":"kot"},{"term":"dog","translation":"pies"}]}';
  assert.equal(odzyskajSlowka(czysty).length, 2);
  const wPlotkach = "```json\n" + czysty + "\n```\nOto lista.";
  const wynik = odzyskajSlowka(wPlotkach);
  assert.equal(wynik.length, 2);
  assert.equal(wynik[0].term, "cat");
});

test("odzyskajSlowka: ucięta tablica oddaje kompletne pozycje, niedomknięta przepada", () => {
  const uciete =
    '{"words":[{"term":"cat","translation":"kot","example":"A {black} cat"},' +
    '{"term":"dog","translation":"pies"},{"term":"bird","transla';
  const wynik = odzyskajSlowka(uciete);
  assert.equal(wynik.length, 2);
  assert.deepEqual(wynik.map((w) => w.term), ["cat", "dog"]);
  // Klamra w treści przykładu nie psuje zliczania (skaner zna napisy i escapy).
  assert.equal(wynik[0].example, "A {black} cat");
});

test("odzyskajSlowka: pozycje bez term/translation odpadają, wartości są przycinane", () => {
  const raw = '{"words":[{"term":"  cat ","translation":" kot "},{"term":"","translation":"x"},{"term":"y"}]}';
  const wynik = odzyskajSlowka(raw);
  assert.equal(wynik.length, 1);
  assert.deepEqual(wynik[0], { term: "cat", translation: "kot", example: null, partOfSpeech: null });
});

test("odzyskajSlowka: brak treści = pusta lista, nie wyjątek", () => {
  assert.deepEqual(odzyskajSlowka(""), []);
  assert.deepEqual(odzyskajSlowka("Przepraszam, nie mogę."), []);
});

test("scalSlowka: NIE ucina — 60 pozycji wchodzi w całości (dowód AC-1)", () => {
  const duzo = Array.from({ length: 60 }, (_, i) => slowko(`word${i}`));
  const wynik = scalSlowka([duzo]);
  assert.equal(wynik.length, 60);
});

test("scalSlowka: duplikaty między fragmentami znikają bez względu na wielkość liter", () => {
  const a = [slowko("Cat"), slowko("dog")];
  const b = [slowko("cat", "inne tłumaczenie"), slowko("bird")];
  const wynik = scalSlowka([a, b]);
  assert.deepEqual(wynik.map((w) => w.term), ["Cat", "dog", "bird"]);
  // Wygrywa pierwsze wystąpienie — kolejność czytania tekstu.
  assert.equal(wynik[0].translation, "tł-Cat");
});
