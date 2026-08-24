import { test } from "node:test";
import assert from "node:assert/strict";
import { etapGoracychTematow } from "../goraceTematy";

/**
 * 086 (AC-9, AC-11) — reguła etapu gorących tematów w przebiegu odświeżania.
 *
 * Dwie rzeczy, które muszą być prawdziwe niezależnie od dostawcy modelu i od bazy: nie płacimy za
 * analizę tej samej puli drugi raz, a awaria etapu DODATKOWEGO nie może wywrócić przebiegu, w którym
 * wiadomości są już pobrane i zapisane.
 */

test("bez nowych materiałów NIE przeliczamy — nie płacimy za tę samą pulę drugi raz", async () => {
  let wywolan = 0;
  const wynik = await etapGoracychTematow({
    pobrano: 0,
    przelicz: async () => {
      wywolan++;
    },
  });
  assert.equal(wywolan, 0);
  assert.equal(wynik, false);
});

test("z nowymi materiałami przeliczamy raz", async () => {
  let wywolan = 0;
  const wynik = await etapGoracychTematow({
    pobrano: 7,
    przelicz: async () => {
      wywolan++;
    },
  });
  assert.equal(wywolan, 1);
  assert.equal(wynik, true);
});

test("awaria przeliczania NIE wychodzi na zewnątrz — przebieg kończy się sukcesem", async () => {
  const zgloszenia: unknown[] = [];
  const wynik = await etapGoracychTematow({
    pobrano: 3,
    przelicz: async () => {
      throw new Error("dostawca odmówił");
    },
    onBlad: (e) => zgloszenia.push(e),
  });
  // Brak wyjątku to sedno testu: gdyby leciał dalej, użytkownik straciłby pobrane wiadomości.
  assert.equal(wynik, false);
  assert.equal(zgloszenia.length, 1);
  assert.match(String(zgloszenia[0]), /dostawca odmówił/);
});

test("ujemna liczba materiałów zachowuje się jak zero", async () => {
  let wywolan = 0;
  await etapGoracychTematow({ pobrano: -1, przelicz: async () => { wywolan++; } });
  assert.equal(wywolan, 0);
});
