import { test } from "node:test";
import assert from "node:assert/strict";
import { przetworzPartiami } from "../partieStreszczen";

/**
 * 084 (AC-21) — awaria JEDNEJ partii nie może kosztować wszystkich pozostałych.
 *
 * To jest dokładnie ta usterka, którą naprawiamy: `llmJson` rzuca przy każdym niepowodzeniu,
 * a wyjątek leciał z pętli na wylot i przerywał cały etap streszczania.
 */

const poz = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}` }));

test("partia, która rzuciła, NIE przerywa pozostałych", async () => {
  const widziane: string[][] = [];
  const wynik = await przetworzPartiami({
    pozycje: poz(6),
    rozmiarPartii: 2,
    maksPodejsc: 1,
    wykonaj: async (partia, _podejscie, zglos) => {
      widziane.push(partia.map((p) => p.id));
      if (partia[0].id === "i2") throw new Error("dostawca odmówił");
      partia.forEach((p) => zglos(p.id));
    },
  });

  // Wszystkie trzy partie zostały PRÓBOWANE, mimo że środkowa padła.
  assert.equal(widziane.length, 3);
  assert.deepEqual(wynik.udane.sort(), ["i0", "i1", "i4", "i5"]);
  assert.deepEqual(wynik.nieudane.sort(), ["i2", "i3"]);
});

test("pozycje z partii, która padła, wracają w kolejnym podejściu", async () => {
  let pierwsze = true;
  const wynik = await przetworzPartiami({
    pozycje: poz(4),
    rozmiarPartii: 2,
    maksPodejsc: 3,
    wykonaj: async (partia, _podejscie, zglos) => {
      if (pierwsze && partia[0].id === "i2") {
        pierwsze = false;
        throw new Error("chwilowa awaria");
      }
      partia.forEach((p) => zglos(p.id));
    },
  });
  assert.deepEqual(wynik.udane.sort(), ["i0", "i1", "i2", "i3"]);
  assert.deepEqual(wynik.nieudane, []);
  assert.equal(wynik.podejsc, 2);
});

test("awaria zgłasza się przez `onBlad`, a nie przez wyjątek", async () => {
  const zgloszenia: Array<{ podejscie: number; partia: number }> = [];
  await przetworzPartiami({
    pozycje: poz(2),
    rozmiarPartii: 2,
    maksPodejsc: 1,
    wykonaj: async () => {
      throw new Error("boom");
    },
    onBlad: (_e, podejscie, numerPartii) => zgloszenia.push({ podejscie, partia: numerPartii }),
  });
  assert.deepEqual(zgloszenia, [{ podejscie: 1, partia: 1 }]);
});

test("podejście bez ANI JEDNEGO sukcesu kończy pętlę — kolejne kosztowałoby tyle samo", async () => {
  let wywolan = 0;
  const wynik = await przetworzPartiami({
    pozycje: poz(2),
    rozmiarPartii: 1,
    maksPodejsc: 5,
    wykonaj: async () => {
      wywolan++;
      // model nic nie odesłał — ani jednego zgłoszenia sukcesu
    },
  });
  assert.equal(wynik.podejsc, 1);
  assert.equal(wywolan, 2, "dwie partie w jednym podejściu, bez kolejnych podejść");
  assert.deepEqual(wynik.nieudane.sort(), ["i0", "i1"]);
});

test("pozycja pominięta przez model wraca — reguła z 080 zachowana", async () => {
  let podejscie = 0;
  const wynik = await przetworzPartiami({
    pozycje: poz(2),
    rozmiarPartii: 2,
    maksPodejsc: 3,
    wykonaj: async (partia, _podejscie, zglos) => {
      podejscie++;
      // Pierwsze podejście: model odsyła tylko jedną pozycję z dwóch.
      if (podejscie === 1) zglos(partia[0].id);
      else partia.forEach((p) => zglos(p.id));
    },
  });
  assert.deepEqual(wynik.udane.sort(), ["i0", "i1"]);
  assert.deepEqual(wynik.nieudane, []);
});

test("pusta lista nie wykonuje ani jednego podejścia", async () => {
  let wywolan = 0;
  const wynik = await przetworzPartiami({
    pozycje: [],
    rozmiarPartii: 2,
    maksPodejsc: 3,
    wykonaj: async () => {
      wywolan++;
    },
  });
  assert.equal(wywolan, 0);
  assert.equal(wynik.podejsc, 0);
  assert.deepEqual(wynik.udane, []);
});

test("sukcesy zapisane PRZED wyjątkiem zostają policzone — nie trafią do „bez streszczenia\u201d", async () => {
  // Recenzja 084: wykonawca zapisał pierwszą pozycję do bazy i dopiero potem padł. Gdy sukces
  // wracał listą ZWRACANĄ na końcu, przepadał razem z wyjątkiem — a pozycja z gotowym
  // streszczeniem dostawała znacznik „bez streszczenia".
  const wynik = await przetworzPartiami({
    pozycje: poz(2),
    rozmiarPartii: 2,
    maksPodejsc: 1,
    wykonaj: async (partia, _podejscie, zglos) => {
      zglos(partia[0].id);
      throw new Error("druga pozycja wysadziła zapis");
    },
  });
  assert.deepEqual(wynik.udane, ["i0"]);
  assert.deepEqual(wynik.nieudane, ["i1"]);
});
