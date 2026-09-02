import { test } from "node:test";
import assert from "node:assert/strict";
import { domyslnaJednostka, poleWidoczne, trybZawodowy, type PoleZaawansowane } from "../tryb";
import { etykietaFazy, listaFaz, nazwaFazy, normalizujKod } from "../fenologia";
import { TRYBY_PRZESTRZENI } from "../typy";

const POLA: PoleZaawansowane[] = [
  "faza",
  "licznosc",
  "powierzchnia",
  "ewidencja",
  "kosztJednostkowy",
  "gleba",
  "parametryChemiczne",
];

// ─── Reguła nadrzędna: tryb CHOWA, nigdy nie BLOKUJE (AC-2 + AC-3) ───────────

test("po włączeniu trybu zaawansowanego KAŻDE pole jest widoczne w KAŻDYM trybie", () => {
  for (const tryb of TRYBY_PRZESTRZENI) {
    for (const pole of POLA) {
      assert.equal(
        poleWidoczne(tryb, pole, true),
        true,
        `tryb ${tryb} ukrywa ${pole} mimo rozwiniętej sekcji zaawansowanej — to byłaby blokada, nie domyślna widoczność`,
      );
    }
  }
});

test("mieszkanie domyślnie nie pokazuje ŻADNEGO pola zawodowego", () => {
  for (const pole of POLA) {
    assert.equal(poleWidoczne("home", pole), false, `mieszkanie pokazuje ${pole}`);
  }
});

test("parametry chemiczne domyślnie widzi wyłącznie pole", () => {
  assert.equal(poleWidoczne("home", "parametryChemiczne"), false);
  assert.equal(poleWidoczne("garden", "parametryChemiczne"), false);
  assert.equal(poleWidoczne("production", "parametryChemiczne"), false);
  assert.equal(poleWidoczne("field", "parametryChemiczne"), true);
});

test("ewidencja zabiegów jest domyślnie widoczna tylko w trybach zawodowych", () => {
  assert.equal(poleWidoczne("home", "ewidencja"), false);
  assert.equal(poleWidoczne("garden", "ewidencja"), false);
  assert.equal(poleWidoczne("production", "ewidencja"), true);
  assert.equal(poleWidoczne("field", "ewidencja"), true);
});

test("pełna tablica tryb × pole jest stabilna", () => {
  const tabela = TRYBY_PRZESTRZENI.map((tryb) => POLA.filter((p) => poleWidoczne(tryb, p)).length);
  assert.deepEqual(tabela, [0, 2, 5, 7]);
});

test("tryb zawodowy to produkcja i pole — nic więcej", () => {
  assert.deepEqual(TRYBY_PRZESTRZENI.filter(trybZawodowy), ["production", "field"]);
});

test("domyślna jednostka: hektary tylko na polu", () => {
  assert.equal(domyslnaJednostka("home"), "szt");
  assert.equal(domyslnaJednostka("garden"), "szt");
  assert.equal(domyslnaJednostka("production"), "szt");
  assert.equal(domyslnaJednostka("field"), "ha");
});

// ─── Fazy rozwojowe ──────────────────────────────────────────────────────────

test("kod normalizuje się z dowolnego zapisu, jaki wpisze użytkownik", () => {
  assert.equal(normalizujKod("65"), "65");
  assert.equal(normalizujKod("BBCH 65"), "65");
  assert.equal(normalizujKod(" bbch-65 "), "65");
  assert.equal(normalizujKod("6"), "60");
  assert.equal(normalizujKod(""), null);
  assert.equal(normalizujKod(null), null);
  assert.equal(normalizujKod("kwitnienie"), null);
});

test("każdy kod z listy wyboru ma polską nazwę", () => {
  const lista = listaFaz();
  assert.ok(lista.length > 20);
  for (const { kod, nazwa } of lista) {
    assert.ok(nazwa && nazwa.length > 0, `kod ${kod} bez nazwy`);
    assert.equal(nazwaFazy(kod), nazwa);
  }
});

test("nieznany kod schodzi do fazy głównej zamiast rzucać", () => {
  // 73 nie ma na liście szczegółowej — spodziewamy się fazy głównej „rozwój owoców".
  assert.equal(nazwaFazy("73"), "rozwój owoców");
  assert.equal(nazwaFazy("42"), "rozwój części jadalnych");
});

test("etykieta zależy od trybu: kod dla zawodowca, słowo dla hobbysty", () => {
  assert.equal(etykietaFazy("65", "home"), "pełnia kwitnienia");
  assert.equal(etykietaFazy("65", "garden"), "pełnia kwitnienia");
  assert.equal(etykietaFazy("65", "field"), "BBCH 65 — pełnia kwitnienia");
  assert.equal(etykietaFazy("65", "production"), "BBCH 65 — pełnia kwitnienia");
});

test("brak fazy nie daje pustej etykiety, tylko null", () => {
  for (const tryb of TRYBY_PRZESTRZENI) {
    assert.equal(etykietaFazy(null, tryb), null);
    assert.equal(etykietaFazy("", tryb), null);
  }
});
