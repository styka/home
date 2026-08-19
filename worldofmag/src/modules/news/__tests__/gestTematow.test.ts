import { test } from "node:test";
import assert from "node:assert/strict";

// 080 (Z12). Zgłoszenie: „zmiana tematów gestem w lewo prawo jest jakby zbyt trudna do wykonania,
// jakieś zbyt wyostrzona weryfikacja". Próg wynosił 60 px przy dominacji 1.5 — na telefonie to
// wyraźny, świadomy ruch, a gest ma być SKRÓTEM.
//
// Te wartości żyją jako stałe w NewsStream.tsx (komponent klienta, nie da się go zaimportować
// w teście node bez DOM), więc test pilnuje samej REGUŁY rozstrzygania na obu progach — starym
// i nowym — żeby było widać, co dokładnie zmieniliśmy i że nowy próg nie łyka przewijania w pionie.

const STARY = { min: 60, dominacja: 1.5 };
const NOWY = { min: 40, dominacja: 1.2 };

/** Ta sama reguła co w `handleTouchEnd`. */
function czyGest(dx: number, dy: number, prog: { min: number; dominacja: number }): boolean {
  return Math.abs(dx) >= prog.min && Math.abs(dx) >= Math.abs(dy) * prog.dominacja;
}

test("naturalny ruch kciuka w bok (45 px, lekki łuk) był odrzucany, teraz przechodzi", () => {
  assert.equal(czyGest(45, 20, STARY), false, "tak wyglądał problem zgłoszony przez właściciela");
  assert.equal(czyGest(45, 20, NOWY), true);
});

test("przewijanie w pionie NADAL nie jest gestem zmiany tematu", () => {
  // Podstawowe ryzyko obniżenia progu: przypadkowe skoki tematów przy zwykłym przewijaniu.
  for (const [dx, dy] of [[10, 200], [30, 120], [40, 60], [20, 40]]) {
    assert.equal(czyGest(dx, dy, NOWY), false, `ruch ${dx}/${dy} nie może zmieniać tematu`);
  }
});

test("mikroruch przy dotknięciu nie zmienia tematu", () => {
  for (const [dx, dy] of [[5, 2], [12, 3], [30, 5]]) {
    assert.equal(czyGest(dx, dy, NOWY), false, `drgnięcie ${dx}/${dy} nie może zmieniać tematu`);
  }
});

test("wyraźny gest w bok działa w obie strony", () => {
  assert.equal(czyGest(80, 10, NOWY), true);
  assert.equal(czyGest(-80, 10, NOWY), true);
});

test("nowy próg jest łagodniejszy, ale nie zniesiony", () => {
  assert.ok(NOWY.min < STARY.min && NOWY.min > 0);
  assert.ok(NOWY.dominacja < STARY.dominacja && NOWY.dominacja > 1, "ruch w bok musi wciąż przeważać nad pionowym");
});
