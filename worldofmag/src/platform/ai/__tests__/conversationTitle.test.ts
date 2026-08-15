import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveTitle } from "../conversationTitle";

test("krótkie polecenie staje się tytułem bez zmian", () => {
  assert.equal(deriveTitle("Dodaj mleko do listy"), "Dodaj mleko do listy");
});

test("bierze pierwsze siedem słów", () => {
  assert.equal(
    deriveTitle("raz dwa trzy cztery piec szesc siedem osiem dziewiec"),
    "raz dwa trzy cztery piec szesc siedem"
  );
});

test("łamanie wierszy i wielokrotne spacje zwijają się do pojedynczych", () => {
  // Wklejony fragment z nowymi liniami rozjechałby listę historii rozmów.
  assert.equal(deriveTitle("Zaplanuj\n\n  tydzień   posiłków"), "Zaplanuj tydzień posiłków");
});

test("puste polecenie dostaje nazwę zastępczą, nie pusty tytuł", () => {
  assert.equal(deriveTitle(""), "Nowa rozmowa");
  assert.equal(deriveTitle("   \n  "), "Nowa rozmowa");
});

test("długi tytuł jest przycięty i oznaczony wielokropkiem", () => {
  const wynik = deriveTitle("a".repeat(90));
  assert.equal(wynik.length, 61, "60 znaków + wielokropek");
  assert.ok(wynik.endsWith("…"));
});

test("SIEDEM DŁUGICH SŁÓW MIEŚCI SIĘ W LIMICIE ZNAKÓW — oba ograniczenia działają razem", () => {
  // Limit słów sam nie wystarcza: siedem długich słów przekroczyłoby szerokość listy.
  const wynik = deriveTitle(Array(7).fill("wielozgloskowewyrazenie").join(" "));
  assert.ok(wynik.length <= 61, `tytuł ma ${wynik.length} znaków`);
  assert.ok(wynik.endsWith("…"));
});

test("dokładnie 60 znaków przechodzi bez wielokropka", () => {
  const wynik = deriveTitle("a".repeat(60));
  assert.equal(wynik, "a".repeat(60));
});
