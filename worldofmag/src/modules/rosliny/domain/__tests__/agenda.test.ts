import { test } from "node:test";
import assert from "node:assert/strict";
import { czytajWymaganiaWodne, kubelekAgendy, trybLubDomyslny } from "../agenda";
import { WYMAGANIA_WODNE_DOMYSLNE } from "../../lib/typy";

const teraz = new Date("2026-05-12T14:00:00");

test("zabieg bez terminu trafia do „wkrótce”, a nie do zaległych", () => {
  assert.equal(kubelekAgendy(null, teraz), "SOON");
});

test("zabieg na dziś zostaje „na dziś” także po południu", () => {
  assert.equal(kubelekAgendy(new Date("2026-05-12T08:00:00"), teraz), "TODAY");
  assert.equal(kubelekAgendy(new Date("2026-05-12T23:30:00"), teraz), "TODAY");
});

test("zaległe zaczynają się dopiero dobę po terminie", () => {
  // Wczoraj wieczorem — jeszcze nie alarmujemy.
  assert.equal(kubelekAgendy(new Date("2026-05-11T20:00:00"), teraz), "TODAY");
  // Dwa dni wstecz — to już zaległość.
  assert.equal(kubelekAgendy(new Date("2026-05-10T08:00:00"), teraz), "OVERDUE");
});

test("termin jutrzejszy to „wkrótce”", () => {
  assert.equal(kubelekAgendy(new Date("2026-05-13T08:00:00"), teraz), "SOON");
});

test("brak wymagań wodnych daje wartości domyślne", () => {
  assert.deepEqual(czytajWymaganiaWodne(null), WYMAGANIA_WODNE_DOMYSLNE);
  assert.deepEqual(czytajWymaganiaWodne(""), WYMAGANIA_WODNE_DOMYSLNE);
});

test("uszkodzony JSON nie wywraca agendy, tylko wraca do domyślnych", () => {
  assert.deepEqual(czytajWymaganiaWodne("{to nie jest json"), WYMAGANIA_WODNE_DOMYSLNE);
});

test("brakujące albo bezsensowne pole bierze zapas, nie psując pozostałych", () => {
  const w = czytajWymaganiaWodne(JSON.stringify({ summer: 3, winter: 0, spring: "abc" }));
  assert.equal(w.summer, 3);
  assert.equal(w.winter, WYMAGANIA_WODNE_DOMYSLNE.winter);
  assert.equal(w.spring, WYMAGANIA_WODNE_DOMYSLNE.spring);
  assert.equal(w.autumn, WYMAGANIA_WODNE_DOMYSLNE.autumn);
});

test("poprawny komplet przechodzi bez zmian", () => {
  const dane = { winter: 20, spring: 9, summer: 4, autumn: 13 };
  assert.deepEqual(czytajWymaganiaWodne(JSON.stringify(dane)), dane);
});

test("nieznany tryb schodzi do mieszkania — najbardziej zachowawczego", () => {
  assert.equal(trybLubDomyslny("field"), "field");
  assert.equal(trybLubDomyslny("plantacja"), "home");
  assert.equal(trybLubDomyslny(null), "home");
  assert.equal(trybLubDomyslny(undefined), "home");
});
