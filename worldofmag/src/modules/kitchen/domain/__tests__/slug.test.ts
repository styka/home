import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../slug";

test("typowy tytuł przepisu", () => {
  assert.equal(slugify("Spaghetti Carbonara"), "spaghetti-carbonara");
});

test("polskie znaki schodzą do łacińskich — także `ł`, którego NFD nie rozkłada", () => {
  // `ł` nie jest literą z akcentem, tylko osobnym znakiem, więc `normalize("NFD")` go nie tknie.
  // Stąd osobna podmiana w regule — i osobny przypadek tutaj.
  assert.equal(slugify("Żurek śląski"), "zurek-slaski");
  assert.equal(slugify("Kluski łyżką"), "kluski-lyzka");
});

test("znaki interpunkcyjne i wielokrotne spacje dają pojedynczy myślnik", () => {
  assert.equal(slugify("Zupa   z dyni: wersja 2.0!"), "zupa-z-dyni-wersja-2-0");
});

test("myślniki na brzegach są obcinane", () => {
  assert.equal(slugify("  --- Naleśniki ---  "), "nalesniki");
});

test("tytuł bez znaków łacińskich daje wartość awaryjną, nie pusty adres", () => {
  // Przepis bez adresu nie istnieje — dlatego to jest reguła, a nie zabezpieczenie.
  assert.equal(slugify("🍕🍝"), "przepis");
  assert.equal(slugify("!!!"), "przepis");
  assert.equal(slugify(""), "przepis");
});

test("długi tytuł jest przycięty do 80 znaków", () => {
  const wynik = slugify("a".repeat(200));
  assert.equal(wynik.length, 80);
});

test("przycięcie może zostawić myślnik na końcu — zastane zachowanie", () => {
  // Kolejność w regule to: obetnij myślniki brzegowe, POTEM przytnij do 80. Więc jeśli 80. znak
  // wypadnie na myślniku, zostaje on na końcu. Utrwalamy stan zastany: slug trafił już do adresów
  // istniejących przepisów, a 069 przenosi reguły, nie zmienia ich.
  const tytul = "a".repeat(79) + " b";
  assert.equal(slugify(tytul), "a".repeat(79) + "-");
});

test("różnice wobec reguły QA — udokumentowane wartościami, nie importem", () => {
  // `modules/qa/domain/slug.ts` robi to samo zadanie inaczej. Nie importujemy jej tutaj: to byłoby
  // sięgnięcie po wnętrze cudzego modułu (C-36), a ścieżka względna przemknęłaby obok reguły lintu.
  // Lustrzane przypadki stoją w teście QA — te trzy wartości trzymają obie strony w zgodzie.
  assert.equal(slugify("test_logowania"), "test-logowania"); // QA: "test_logowania"
  assert.equal(slugify("!!!"), "przepis"); //                    QA: ""
  assert.equal(slugify("a".repeat(200)).length, 80); //          QA: 200
});
