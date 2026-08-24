import { test } from "node:test";
import assert from "node:assert/strict";
import { roboczyTytul, czyTytulRoboczy, PREFIKS_ZGLOSZENIA } from "../feedbackTitle";

test("pusty opis daje nazwę zastępczą, nie błąd", () => {
  assert.equal(roboczyTytul(""), `${PREFIKS_ZGLOSZENIA}Zgłoszenie`);
  assert.equal(roboczyTytul("   \n  "), `${PREFIKS_ZGLOSZENIA}Zgłoszenie`);
});

test("bierze pierwsze zdanie, nie cały opis", () => {
  assert.equal(
    roboczyTytul("Punkty osi wystają poza pasek. Widać je przy przewijaniu, co wygląda źle."),
    `${PREFIKS_ZGLOSZENIA}Punkty osi wystają poza pasek`
  );
});

test("bardzo długie zdanie jest przycięte z wielokropkiem", () => {
  const tytul = roboczyTytul("a".repeat(200));
  assert.equal(tytul.startsWith(PREFIKS_ZGLOSZENIA), true);
  assert.equal(tytul.length <= PREFIKS_ZGLOSZENIA.length + 80, true);
  assert.equal(tytul.endsWith("…"), true);
});

test("opis bez kropki zostaje w całości", () => {
  assert.equal(roboczyTytul("pusta linia na mobile"), `${PREFIKS_ZGLOSZENIA}pusta linia na mobile`);
});

test("wielokrotne spacje i nowe linie są zwijane", () => {
  assert.equal(roboczyTytul("dwa\n\n  słowa"), `${PREFIKS_ZGLOSZENIA}dwa słowa`);
});

test("czyTytulRoboczy odróżnia tytuł nadany od zmienionego ręcznie", () => {
  const roboczy = roboczyTytul("coś nie działa");
  assert.equal(czyTytulRoboczy(roboczy, roboczy), true);
  assert.equal(czyTytulRoboczy("🐛 Coś zupełnie innego", roboczy), false);
});
