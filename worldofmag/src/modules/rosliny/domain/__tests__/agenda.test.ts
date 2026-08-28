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
  const w = czytajWymaganiaWodne(JSON.stringify({ summer: 3, spring: "abc", autumn: -4 }));
  assert.equal(w.summer, 3);
  assert.equal(w.spring, WYMAGANIA_WODNE_DOMYSLNE.spring);
  // Wartość ujemna to nie „nie podlewamy”, tylko dane bez sensu — stąd zapas.
  assert.equal(w.autumn, WYMAGANIA_WODNE_DOMYSLNE.autumn);
  assert.equal(w.winter, WYMAGANIA_WODNE_DOMYSLNE.winter);
});

test("zero jest wartością POPRAWNĄ i przechodzi nietknięte", () => {
  // Tak zapisuje katalog warzywa jednoroczne: zimą nie rosną, więc nie ma czego planować.
  // Podstawienie tu wartości domyślnej dawało pomidorowi w styczniu zadanie „podlej za 14 dni”
  // z uzasadnieniem, które brzmiało wiarygodnie i było zmyślone.
  const warzywo = czytajWymaganiaWodne(JSON.stringify({ winter: 0, spring: 4, summer: 3, autumn: 5 }));
  assert.deepEqual(warzywo, { winter: 0, spring: 4, summer: 3, autumn: 5 });

  // Zboża i uprawy polowe mają zera we wszystkich porach — nawadnianie jest tam decyzją
  // agrotechniczną, a nie odstępem między podlaniami.
  const zboze = czytajWymaganiaWodne(JSON.stringify({ winter: 0, spring: 0, summer: 0, autumn: 0 }));
  assert.deepEqual(zboze, { winter: 0, spring: 0, summer: 0, autumn: 0 });
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
