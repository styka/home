import { test } from "node:test";
import assert from "node:assert/strict";
import { tytulWygladaNaObcy } from "../jezykTytulu";

/**
 * 124 (AC-1) — próg jest ostrożny: heurystyka wskazuje kandydatów do PŁATNEGO tłumaczenia,
 * więc fałszywe „obcy" na polskim tytule jest droższe niż przepuszczenie wątpliwego.
 */
test("przykład ze zgłoszenia właściciela jest obcy", () => {
  assert.equal(
    tytulWygladaNaObcy(
      "The economics of agent scale: tokens, ROI, and building platforms for AI-first teams (Part 2)"
    ),
    true
  );
});

test("jeden diakrytyk przesądza o polskości", () => {
  assert.equal(tytulWygladaNaObcy("Sejm przyjął ustawę o KSeF"), false);
});

test("polski tytuł bez diakrytyków nie jest oznaczany", () => {
  // Zdanie bez ą/ę/ł…, ale też bez dwóch obcych słów funkcyjnych.
  assert.equal(tytulWygladaNaObcy("Nowy rekord na rynku pracy w Polsce"), false);
});

test("polski tytuł z angielskim terminem nie jest oznaczany", () => {
  assert.equal(tytulWygladaNaObcy("Tokeny w LLM: ile kosztuje agent w firmie"), false);
});

test("pojedyncze `the` w nazwie własnej nie wystarcza", () => {
  assert.equal(tytulWygladaNaObcy("The Economist ostrzega przed spowolnieniem w Europie"), false);
});

test("tytuł niemiecki jest obcy", () => {
  assert.equal(tytulWygladaNaObcy("Die Bundesregierung und der Haushalt: was jetzt kommt"), true);
});

test("pusty i biały tytuł nie jest oznaczany", () => {
  assert.equal(tytulWygladaNaObcy(""), false);
  assert.equal(tytulWygladaNaObcy("   "), false);
});

test("dwa różne obce słowa muszą być OSOBNYMI wyrazami, nie fragmentami", () => {
  // „theatre" zawiera „the", „android" zawiera „and" — podział na wyrazy nie może ich łapać.
  assert.equal(tytulWygladaNaObcy("Theatre android premiera w Warszawie"), false);
});
