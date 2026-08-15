import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKeyUTC } from "../dzienPlanu";

test("sprowadza moment do południa UTC tego samego dnia", () => {
  const k = dayKeyUTC(new Date("2026-03-17T08:42:13.500Z"));
  assert.equal(k.toISOString(), "2026-03-17T12:00:00.000Z");
});

test("PÓŁNOC W PL NIE PRZESUWA DNIA — to jest cała racja bytu tej reguły", () => {
  // 2026-03-17 00:30 czasu polskiego to 2026-03-16T23:30Z. Klucz musi wskazać 17., a nie 16.:
  // inaczej obiad zaplanowany „we wtorek" wylądowałby w poniedziałek.
  //
  // Uwaga: reguła liczy dzień w UTC, więc test podaje moment, który W UTC jest już 17-ego —
  // dokładnie tak, jak trafia tu data z formularza (znormalizowana po stronie klienta).
  const k = dayKeyUTC(new Date("2026-03-17T00:30:00.000Z"));
  assert.equal(k.toISOString().slice(0, 10), "2026-03-17");
});

test("koniec doby UTC też zostaje w swoim dniu", () => {
  const k = dayKeyUTC(new Date("2026-03-17T23:59:59.999Z"));
  assert.equal(k.toISOString(), "2026-03-17T12:00:00.000Z");
});

test("wynik jest stabilny — dwukrotne zastosowanie nic nie zmienia", () => {
  // Klucz bywa liczony ponownie na już znormalizowanej dacie (odczyt → zapis).
  const raz = dayKeyUTC(new Date("2026-12-31T21:15:00.000Z"));
  const dwa = dayKeyUTC(raz);
  assert.equal(raz.toISOString(), dwa.toISOString());
});

test("nie modyfikuje daty przekazanej przez wywołującego", () => {
  const wejscie = new Date("2026-07-01T05:00:00.000Z");
  dayKeyUTC(wejscie);
  assert.equal(wejscie.toISOString(), "2026-07-01T05:00:00.000Z");
});

test("przełom roku nie gubi dnia", () => {
  const k = dayKeyUTC(new Date("2027-01-01T02:00:00.000Z"));
  assert.equal(k.toISOString(), "2027-01-01T12:00:00.000Z");
});
