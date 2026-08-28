import { test } from "node:test";
import assert from "node:assert/strict";
import {
  brakiEwidencji,
  ewidencjaDoCsv,
  nazwaPlikuEwidencji,
  KOLUMNY_EWIDENCJI,
  type WierszEwidencji,
} from "../eksportEwidencji";

const wiersz = (over: Partial<WierszEwidencji> = {}): WierszEwidencji => ({
  occurredAt: new Date("2026-05-12T09:30:00Z"),
  spaceName: "Pole 3",
  plantName: "Pszenica ozima",
  placeName: "Kwatera A",
  productName: "Preparat X 500 SC",
  permitNumber: "R-123/2024",
  applicationKind: "opryskiwanie",
  doseValue: 1.5,
  doseUnit: "l/ha",
  areaValue: 4.2,
  areaUnit: "ha",
  locationText: "dz. ew. 123/4, obręb Wólka",
  operator: "Szymon T.",
  conditions: "12°C, wiatr 2 m/s",
  withdrawalDays: 35,
  note: null,
  ...over,
});

// ─── Kompletność wobec wymogu od 2026-01-01 ─────────────────────────────────

test("kompletny wpis nie ma braków", () => {
  assert.deepEqual(brakiEwidencji(wiersz()), []);
});

test("trzy pola, które doszły od 2026, są wymagane po nazwie", () => {
  assert.ok(brakiEwidencji(wiersz({ applicationKind: null })).includes("rodzaj zastosowania"));
  assert.ok(brakiEwidencji(wiersz({ permitNumber: null })).includes("numer zezwolenia"));
  assert.ok(brakiEwidencji(wiersz({ locationText: null })).includes("dokładna lokalizacja"));
});

test("pozostałe wymagane pola też są zgłaszane", () => {
  const braki = brakiEwidencji({});
  for (const pole of ["nazwa środka", "dawka", "powierzchnia", "wykonujący"]) {
    assert.ok(braki.includes(pole), `brak zgłoszenia dla: ${pole}`);
  }
});

test("zabieg bez uprawy I bez miejsca jest niekompletny — dokument nie zna wtedy przedmiotu zabiegu", () => {
  assert.ok(brakiEwidencji(wiersz({ plantName: null, placeName: null })).includes("uprawa lub miejsce"));
  // Jedno z dwojga wystarcza: oprysk całej grządki nazywa uprawę miejscem.
  assert.deepEqual(brakiEwidencji(wiersz({ plantName: null })), []);
  assert.deepEqual(brakiEwidencji(wiersz({ placeName: null })), []);
});

test("dawka zero i puste ciągi liczą się jako brak, nie jako wypełnienie", () => {
  assert.ok(brakiEwidencji(wiersz({ doseValue: 0 })).includes("dawka"));
  assert.ok(brakiEwidencji(wiersz({ operator: "   " })).includes("wykonujący"));
});

// ─── CSV ─────────────────────────────────────────────────────────────────────

test("eksport ma wszystkie kolumny wymogu, w ustalonej kolejności", () => {
  const csv = ewidencjaDoCsv([wiersz()]);
  const naglowek = csv.split("\r\n")[0].replace(/^﻿/, "");
  assert.equal(naglowek, KOLUMNY_EWIDENCJI.join(";"));
  assert.equal(KOLUMNY_EWIDENCJI.length, 16);
});

test("wiersz danych trafia w te same kolumny co nagłówek", () => {
  const csv = ewidencjaDoCsv([wiersz()]);
  const [naglowek, dane] = csv.replace(/^﻿/, "").split("\r\n");
  assert.equal(dane.split(";").length, naglowek.split(";").length);
  assert.ok(dane.startsWith("2026-05-12;"));
  assert.ok(dane.includes("R-123/2024"));
});

/**
 * Minimalny parser CSV — świadomy cudzysłowów. Naiwne `split(";")` nie nadaje się do sprawdzenia
 * tego przypadku, bo dzieli także w środku pola objętego cudzysłowem, czyli mierzy dokładnie ten
 * błąd, którego szukamy.
 */
function poleCsv(linia: string): string[] {
  const pola: string[] = [];
  let biezace = "";
  let wCudzyslowie = false;
  for (let i = 0; i < linia.length; i++) {
    const z = linia[i];
    if (wCudzyslowie) {
      if (z === '"' && linia[i + 1] === '"') { biezace += '"'; i++; }
      else if (z === '"') wCudzyslowie = false;
      else biezace += z;
    } else if (z === '"') wCudzyslowie = true;
    else if (z === ";") { pola.push(biezace); biezace = ""; }
    else biezace += z;
  }
  pola.push(biezace);
  return pola;
}

test("średnik w treści nie rozjeżdża wiersza o kolumnę", () => {
  // To jest realny przypadek: użytkownik wpisuje warunki zdaniem z separatorem.
  const csv = ewidencjaDoCsv([wiersz({ conditions: "12°C; wiatr 2 m/s; sucho" })]);
  const [naglowek, dane] = csv.replace(/^﻿/, "").split("\r\n");
  assert.equal(poleCsv(dane).length, poleCsv(naglowek).length);
  assert.equal(poleCsv(dane)[13], "12°C; wiatr 2 m/s; sucho");
});

test("cudzysłów w treści jest podwajany, a nie gubiony", () => {
  const csv = ewidencjaDoCsv([wiersz({ note: 'preparat "X"' })]);
  assert.ok(csv.includes('"preparat ""X"""'));
});

test("plik zaczyna się od BOM — bez niego polski Excel rozjeżdża znaki", () => {
  assert.ok(ewidencjaDoCsv([]).startsWith("﻿"));
});

test("pusty rejestr daje sam nagłówek, a nie pusty plik", () => {
  const csv = ewidencjaDoCsv([]).replace(/^﻿/, "");
  assert.equal(csv.trim(), KOLUMNY_EWIDENCJI.join(";"));
});

test("brakujące pola zostają puste, a nie jako „null”", () => {
  const csv = ewidencjaDoCsv([wiersz({ permitNumber: null, withdrawalDays: null })]);
  assert.doesNotMatch(csv, /null|undefined/);
});

// ─── Nazwa pliku ─────────────────────────────────────────────────────────────

test("nazwa pliku bierze się z ZAKRESU podanego przez użytkownika", () => {
  assert.equal(
    nazwaPlikuEwidencji({ od: new Date(2026, 3, 1), do: new Date(2026, 3, 30) }, [wiersz()]),
    "ewidencja-zabiegow-2026-04-01_2026-04-30.csv",
  );
});

test("pełny rok kalendarzowy skraca się do samego roku — tak nazywa go wymóg", () => {
  assert.equal(
    nazwaPlikuEwidencji({ od: new Date(2026, 0, 1), do: new Date(2026, 11, 31) }, [wiersz()]),
    "ewidencja-zabiegow-2026.csv",
  );
});

test("bez filtra nazwa opisuje daty skrajne WYEKSPORTOWANYCH wierszy, a nie rok bieżący", () => {
  // To jest ten błąd, przez który w 2028 rolnik dostawał „ewidencja-zabiegow-2028.csv"
  // z zabiegami z trzech lat.
  const nazwa = nazwaPlikuEwidencji(undefined, [
    wiersz({ occurredAt: new Date(2026, 4, 12) }),
    wiersz({ occurredAt: new Date(2028, 6, 3) }),
    wiersz({ occurredAt: new Date(2027, 1, 20) }),
  ]);
  assert.equal(nazwa, "ewidencja-zabiegow-2026-05-12_2028-07-03.csv");
});

test("pusty eksport nie zmyśla zakresu", () => {
  assert.equal(nazwaPlikuEwidencji(undefined, []), "ewidencja-zabiegow-brak-zabiegow.csv");
});
