import { test } from "node:test";
import assert from "node:assert/strict";
import { obliczPozycje, type Prostokat } from "@/components/ui/anchoredPosition";

// 080 (Z7, Z2). Zgłoszenie właściciela: popover kosztów LLM „zawsze otwiera się w górę i jeśli
// nie mieści się w oknie, to wychodzi powyżej widoku ekranu". Ta sama klasa błędu siedziała
// w panelach paska akcji zbiorczych na /tasks/multi.
//
// Sedno tych testów sprowadza się do jednego zdania: PANEL MA BYĆ W OKNIE. Zawsze. Niezależnie
// od tego, gdzie stoi przycisk i jak duża jest treść.

const OKNO = { width: 1200, height: 800 };
const PANEL = { width: 320, height: 240 };

/** Czy cały panel mieści się w oknie — to jest właściwość, której brakowało. */
function wOknie(p: { top: number; left: number }, panel = PANEL, okno = OKNO): boolean {
  return p.top >= 0 && p.left >= 0 && p.left + panel.width <= okno.width && p.top + panel.height <= okno.height;
}

const przycisk = (top: number, left = 100): Prostokat => ({ top, left, width: 120, height: 32 });

test("przycisk przy GÓRNEJ krawędzi: panel nie wychodzi ponad ekran", () => {
  // Dokładnie przypadek ze zgłoszenia: wskaźnik kosztu stoi u góry strony, panel chciał w górę.
  const p = obliczPozycje({ wyzwalacz: przycisk(10), panel: PANEL, okno: OKNO, strona: "gora" });
  assert.equal(p.strona, "dol", "brak miejsca u góry musi odbić panel w dół");
  assert.ok(wOknie(p), `panel poza oknem: ${JSON.stringify(p)}`);
});

test("przycisk przy DOLNEJ krawędzi: panel nie wychodzi poniżej ekranu", () => {
  // Przypadek paska akcji zbiorczych — przyklejony do dołu, więc w dół miejsca nie ma nigdy.
  const p = obliczPozycje({ wyzwalacz: przycisk(770), panel: PANEL, okno: OKNO, strona: "dol" });
  assert.equal(p.strona, "gora", "brak miejsca na dole musi odbić panel w górę");
  assert.ok(wOknie(p), `panel poza oknem: ${JSON.stringify(p)}`);
});

test("gdy miejsca starczy, preferowana strona jest uszanowana", () => {
  const dol = obliczPozycje({ wyzwalacz: przycisk(300), panel: PANEL, okno: OKNO, strona: "dol" });
  const gora = obliczPozycje({ wyzwalacz: przycisk(300), panel: PANEL, okno: OKNO, strona: "gora" });
  assert.equal(dol.strona, "dol");
  assert.equal(gora.strona, "gora");
  assert.ok(dol.top > 300, "panel w dół stoi pod przyciskiem");
  assert.ok(gora.top < 300, "panel w górę stoi nad przyciskiem");
});

test("panel wyższy niż OBIE strony dostaje maxHeight, zamiast wychodzić poza okno", () => {
  const wysoki = { width: 320, height: 5000 };
  const p = obliczPozycje({ wyzwalacz: przycisk(400), panel: wysoki, okno: OKNO, strona: "dol" });
  assert.ok(p.maxHeight > 0, "musi zostać jakaś wysokość do przewijania");
  assert.ok(p.top + p.maxHeight <= OKNO.height, "dolna krawędź panelu zostaje w oknie");
  assert.ok(p.top >= 0);
});

test("przycisk przy PRAWEJ krawędzi: panel dosuwa się do wnętrza okna", () => {
  const p = obliczPozycje({ wyzwalacz: przycisk(300, 1150), panel: PANEL, okno: OKNO });
  assert.ok(p.left + PANEL.width <= OKNO.width, "prawa krawędź panelu zostaje w oknie");
  assert.ok(wOknie(p));
});

test("przycisk przy LEWEJ krawędzi z wyrównaniem do końca: panel nie ucieka w ujemne", () => {
  const p = obliczPozycje({ wyzwalacz: przycisk(300, 4), panel: PANEL, okno: OKNO, wyrownanie: "koniec" });
  assert.ok(p.left >= 0, "panel nie może zaczynać się poza lewą krawędzią");
  assert.ok(wOknie(p));
});

test("wyrównanie do środka trzyma się środka wyzwalacza, dopóki się mieści", () => {
  const t = przycisk(300, 500);
  const p = obliczPozycje({ wyzwalacz: t, panel: PANEL, okno: OKNO, wyrownanie: "srodek" });
  assert.equal(p.left, t.left + t.width / 2 - PANEL.width / 2);
});

test("panel szerszy od okna zaczyna się od LEWEJ — obcięty koniec boli mniej niż obcięty początek", () => {
  const szeroki = { width: 2000, height: 200 };
  const p = obliczPozycje({ wyzwalacz: przycisk(300, 600), panel: szeroki, okno: OKNO });
  assert.ok(p.left >= 0, `początek treści musi być widoczny, było ${p.left}`);
});

test("każda pozycja przycisku na ekranie daje panel w oknie", () => {
  // Właściwość, nie przypadek: przechodzimy całą wysokość i szerokość okna.
  for (let top = 0; top <= OKNO.height - 32; top += 40) {
    for (let left = 0; left <= OKNO.width - 120; left += 120) {
      for (const strona of ["gora", "dol"] as const) {
        const p = obliczPozycje({ wyzwalacz: przycisk(top, left), panel: PANEL, okno: OKNO, strona });
        assert.ok(p.left >= 0 && p.left + PANEL.width <= OKNO.width, `poziom: top=${top} left=${left}`);
        assert.ok(p.top >= 0, `pion: top=${top} left=${left}`);
        assert.ok(p.top + Math.min(PANEL.height, p.maxHeight) <= OKNO.height, `dół: top=${top} left=${left}`);
      }
    }
  }
});
