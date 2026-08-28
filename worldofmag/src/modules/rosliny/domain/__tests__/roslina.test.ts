import { test } from "node:test";
import assert from "node:assert/strict";
import { bladZmianyStanu, powodWymagany, roslinaNaDTO, statusZakonczony, type WierszRosliny } from "../roslina";

const wiersz = (over: Partial<WierszRosliny> = {}): WierszRosliny => ({
  id: "p1",
  spaceId: "s1",
  placeId: null,
  speciesId: null,
  name: "Monstera z salonu",
  customSpecies: null,
  quantity: 1,
  quantityUnit: "szt",
  stage: null,
  status: "ACTIVE",
  statusReason: null,
  sownAt: null,
  acquiredAt: null,
  parentId: null,
  photoUrl: null,
  notes: null,
  place: null,
  species: null,
  ...over,
});

test("gatunek ze słownika ma pierwszeństwo przed wpisanym z ręki", () => {
  const dto = roslinaNaDTO(wiersz({
    species: { namePl: "Monstera dziurawa", family: "Araceae" },
    customSpecies: "monstera chyba",
  }));
  assert.equal(dto.gatunek, "Monstera dziurawa");
  assert.equal(dto.rodzina, "Araceae");
});

test("nazwa wpisana z ręki NIE znika, gdy nie ma dopasowania w słowniku", () => {
  const dto = roslinaNaDTO(wiersz({ customSpecies: "jakaś paproć od babci" }));
  assert.equal(dto.gatunek, "jakaś paproć od babci");
  assert.equal(dto.rodzina, null);
});

test("brak obu źródeł daje null, a nie pusty tekst", () => {
  assert.equal(roslinaNaDTO(wiersz()).gatunek, null);
});

test("daty wychodzą jako ISO albo null — nigdy jako obiekt Date", () => {
  const dto = roslinaNaDTO(wiersz({ sownAt: new Date("2026-03-01T00:00:00Z") }));
  assert.equal(typeof dto.sownAt, "string");
  assert.ok(dto.sownAt?.startsWith("2026-03-01"));
  assert.equal(dto.acquiredAt, null);
});

test("liczność przechodzi bez zmiany — także dla partii i powierzchni", () => {
  assert.equal(roslinaNaDTO(wiersz({ quantity: 100, quantityUnit: "szt" })).quantity, 100);
  const pole = roslinaNaDTO(wiersz({ quantity: 4.2, quantityUnit: "ha" }));
  assert.equal(pole.quantity, 4.2);
  assert.equal(pole.quantityUnit, "ha");
});

test("nazwa miejsca jest spłaszczana, a jej brak nie wywraca przepisania", () => {
  assert.equal(roslinaNaDTO(wiersz({ place: { name: "Parapet południowy" } })).placeName, "Parapet południowy");
  assert.equal(roslinaNaDTO(wiersz()).placeName, null);
});

// ─── Zmiana stanu ────────────────────────────────────────────────────────────

test("powodu wymaga WYŁĄCZNIE „padła” — sprzedaż i zbiór mówią same za siebie", () => {
  assert.equal(powodWymagany("DEAD"), true);
  assert.equal(powodWymagany("SOLD"), false);
  assert.equal(powodWymagany("HARVESTED"), false);
  assert.equal(powodWymagany("ARCHIVED"), false);
  assert.equal(powodWymagany("ACTIVE"), false);
});

test("puste i białe znaki nie są przyczyną", () => {
  assert.ok(bladZmianyStanu("DEAD", null));
  assert.ok(bladZmianyStanu("DEAD", ""));
  assert.ok(bladZmianyStanu("DEAD", "   "));
  assert.equal(bladZmianyStanu("DEAD", "przelana"), null);
});

test("komunikat mówi, PO CO ta przyczyna — nie tylko że jest wymagana", () => {
  const komunikat = bladZmianyStanu("DEAD", null);
  assert.match(String(komunikat), /za rok/);
});

test("stany zakończone znikają z listy aktywnych, ACTIVE nie", () => {
  assert.equal(statusZakonczony("ACTIVE"), false);
  for (const s of ["SOLD", "HARVESTED", "DEAD", "ARCHIVED"] as const) {
    assert.equal(statusZakonczony(s), true, `${s} powinien być stanem zakończonym`);
  }
});
