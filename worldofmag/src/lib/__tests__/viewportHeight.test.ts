import { test } from "node:test";
import assert from "node:assert/strict";
import { pickAppHeight } from "../viewportHeight";

// 036: reguła wysokości powłoki przy klawiaturze ekranowej. Testy pilnują dwóch rzeczy naraz:
// (1) że przy klawiaturze powłoka faktycznie się kurczy — bo z tego wynika `scrollY = 0`, czyli brak
//     przesunięcia widocznego obszaru, czyli brak drgania nagłówka asystenta;
// (2) że powłoka NIGDY nie jest niższa od okna — to zabezpieczenie przed paskiem tła u dołu ekranu,
//     który był realnym regresem podejścia z `h-full`.
// Liczby pochodzą z pomiarów na urządzeniu (iPhone, PWA), nie są wymyślone.

test("bez klawiatury: pełna wysokość okna (zmierzone 812)", () => {
  assert.equal(pickAppHeight(812, 812), 812);
});

test("z klawiaturą przy resizes-content: oba pomiary zmalały, powłoka oddaje miejsce (zmierzone 477)", () => {
  assert.equal(pickAppHeight(477, 477), 477);
});

test("powłoka nie może być NIŻSZA niż okno — inaczej u dołu ekranu robi się pasek tła", () => {
  // Odtworzony regres z `h-full`: blok bazowy 768 przy oknie 812 dawał 44 px paska.
  assert.equal(pickAppHeight(768, 812), 812);
});

test("gdy przeglądarka kurczy tylko widoczny obszar, degradujemy do wysokości okna, a nie niżej", () => {
  // `resizes-visual`: okno zostaje 812, widoczny obszar 477. Wynik = dzisiejsze zachowanie.
  assert.equal(pickAppHeight(477, 812), 812);
});

test("brak visualViewport (stara przeglądarka): wysokość okna", () => {
  assert.equal(pickAppHeight(null, 812), 812);
});

test("wartość niebędąca liczbą skończoną nie przepuszcza NaN do stylu", () => {
  assert.equal(pickAppHeight(Number.NaN, 812), 812);
  assert.equal(pickAppHeight(Number.POSITIVE_INFINITY, 812), 812);
});
