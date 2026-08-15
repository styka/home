import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestVertexDist2 } from "../korytarz";

/** Linia trasy w formacie ORS: pary [lng, lat]. */
const trasa: [number, number][] = [
  [21.0, 52.0],
  [21.1, 52.1],
  [21.2, 52.2],
];

test("punkt leżący na wierzchołku ma odległość zero", () => {
  assert.equal(nearestVertexDist2(52.1, 21.1, trasa), 0);
});

test("bierze NAJBLIŻSZY wierzchołek, nie pierwszy ani ostatni", () => {
  // Punkt tuż obok środkowego wierzchołka: wynik musi pochodzić od niego, mimo że lista zaczyna
  // się i kończy gdzie indziej.
  const d = nearestVertexDist2(52.1, 21.11, trasa);
  assert.ok(d < 0.0002, `oczekiwano bliskiego wierzchołka, było ${d}`);
});

test("kolejność wyników odpowiada rzeczywistej bliskości — po to ta funkcja istnieje", () => {
  // Wynik służy wyłącznie do posortowania robót drogowych i wybrania najbliższych, więc
  // sprawdzamy własność PORZĄDKU, a nie konkretną liczbę.
  const blisko = nearestVertexDist2(52.0, 21.01, trasa);
  const dalej = nearestVertexDist2(52.0, 21.5, trasa);
  const bardzoDaleko = nearestVertexDist2(48.0, 15.0, trasa);
  assert.ok(blisko < dalej);
  assert.ok(dalej < bardzoDaleko);
});

test("PUSTA TRASA DAJE NIESKOŃCZONOŚĆ — punkt trafia na koniec porządku, nie na początek", () => {
  // Gdyby brak wierzchołków dawał 0, roboty drogowe przy nieistniejącej trasie zostałyby uznane
  // za najbliższe ze wszystkich i zajęły cały limit omijanych punktów.
  assert.equal(nearestVertexDist2(52.0, 21.0, []), Infinity);
});

test("trasa jednopunktowa liczy się względem tego jedynego wierzchołka", () => {
  assert.equal(nearestVertexDist2(52.0, 21.0, [[21.0, 52.0]]), 0);
});

test("kolejność pary to [lng, lat] — zamiana miejscami zmienia wynik", () => {
  // Pomyłka w kolejności współrzędnych to klasyczny cichy błąd w geometrii: nic nie wybuchnie,
  // trasa po prostu ominie nie te roboty. Test przypina konwencję.
  const poprawnie = nearestVertexDist2(52.0, 21.0, [[21.0, 52.0]]);
  const odwrotnie = nearestVertexDist2(52.0, 21.0, [[52.0, 21.0]]);
  assert.equal(poprawnie, 0);
  assert.ok(odwrotnie > 0);
});
