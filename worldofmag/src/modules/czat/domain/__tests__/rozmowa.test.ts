import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TTL_PISANIA_MS,
  czyMozeEdytowac,
  czyPisze,
  etykietaRozmowy,
  ktoPrzeczytal,
  piszacy,
  policzNieprzeczytane,
  type UczestnikRozmowy,
} from "../rozmowa";

const TERAZ = new Date("2026-08-27T12:00:00.000Z");
const przed = (ms: number) => new Date(TERAZ.getTime() - ms);

test("„pisze…” wygasa po TTL, bez żadnego zapisu w tle", () => {
  assert.equal(czyPisze(przed(1_000), TERAZ), true);
  assert.equal(czyPisze(przed(TTL_PISANIA_MS - 1), TERAZ), true);
  assert.equal(czyPisze(przed(TTL_PISANIA_MS), TERAZ), false, "granica wygasa, a nie trwa");
  assert.equal(czyPisze(null, TERAZ), false);
});

test("znacznik pisania „z przyszłości” nie zapala wiecznego „pisze…”", () => {
  const zPrzyszlosci = new Date(TERAZ.getTime() + 60_000);
  assert.equal(czyPisze(zPrzyszlosci, TERAZ), false);
});

const UCZESTNICY: UczestnikRozmowy[] = [
  { userId: "ja", nazwa: "Ja", przeczytaneDo: przed(0), pisalAt: przed(500) },
  { userId: "on", nazwa: "Ona", przeczytaneDo: przed(10_000), pisalAt: przed(1_000) },
  { userId: "trzeci", nazwa: "Trzeci", przeczytaneDo: null, pisalAt: null },
];

test("piszący pomija MNIE — własne pisanie to nie jest informacja dla mnie", () => {
  assert.deepEqual(piszacy(UCZESTNICY, "ja", TERAZ), ["Ona"]);
});

test("edytować wolno wyłącznie własną i nieusuniętą wiadomość", () => {
  assert.equal(czyMozeEdytowac({ autorId: "ja", deletedAt: null }, "ja"), true);
  assert.equal(czyMozeEdytowac({ autorId: "on", deletedAt: null }, "ja"), false, "cudza");
  assert.equal(czyMozeEdytowac({ autorId: "ja", deletedAt: TERAZ }, "ja"), false, "już usunięta");
});

const WIADOMOSCI = [
  { autorId: "on", createdAt: przed(30_000), deletedAt: null },
  { autorId: "on", createdAt: przed(5_000), deletedAt: null },
  { autorId: "ja", createdAt: przed(4_000), deletedAt: null },
  { autorId: "on", createdAt: przed(3_000), deletedAt: TERAZ },
];

test("nieprzeczytane pomijają własne i usunięte wiadomości", () => {
  assert.equal(policzNieprzeczytane(WIADOMOSCI, "ja", przed(20_000)), 1);
});

test("brak znacznika odczytu znaczy „nic nie czytałem”, a nie „nic nie jest nowe”", () => {
  assert.equal(policzNieprzeczytane(WIADOMOSCI, "ja", null), 2, "obie cudze nieusunięte");
});

test("„przeczytano” pyta o CUDZE znaczniki i mówi, przez kogo", () => {
  const wiadomosc = { createdAt: przed(20_000) };
  assert.deepEqual(ktoPrzeczytal(wiadomosc, UCZESTNICY, "ja"), ["Ona"]);

  // Wiadomość nowsza niż czyjkolwiek znacznik nie jest jeszcze przeczytana przez nikogo.
  assert.deepEqual(ktoPrzeczytal({ createdAt: przed(1_000) }, UCZESTNICY, "ja"), []);
});

test("etykieta rozmowy: kanał ma tytuł, rozmowa prywatna nazywa się drugą osobą", () => {
  assert.equal(
    etykietaRozmowy({ rodzaj: "zespol", tytul: "Dom" }, UCZESTNICY, "ja", "—"),
    "Dom",
  );
  assert.equal(
    etykietaRozmowy({ rodzaj: "prywatna", tytul: null }, UCZESTNICY.slice(0, 2), "ja", "—"),
    "Ona",
  );
});

test("rozmowa bez drugiej strony dostaje etykietę zastępczą, nie pustą", () => {
  const sam: UczestnikRozmowy[] = [UCZESTNICY[0]];
  assert.equal(etykietaRozmowy({ rodzaj: "prywatna", tytul: null }, sam, "ja", "Konto usunięte"), "Konto usunięte");
  assert.equal(etykietaRozmowy({ rodzaj: "zespol", tytul: null }, sam, "ja", "Zespół"), "Zespół");
});
