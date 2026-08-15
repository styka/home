import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDueFrom } from "../terminOpieki";

const dzien = (iso: string) => new Date(`${iso}T10:00:00.000Z`);

test("nawrót dzienny wyznacza kolejny termin", () => {
  const next = nextDueFrom(dzien("2026-05-10"), { type: "DAILY", interval: 3 });
  assert.equal(next?.toISOString().slice(0, 10), "2026-05-13");
});

test("nawrót miesięczny przechodzi przez koniec roku", () => {
  const next = nextDueFrom(dzien("2026-12-05"), { type: "MONTHLY", interval: 2 });
  assert.equal(next?.toISOString().slice(0, 10), "2027-02-05");
});

test("zadanie jednorazowe nie ma następnego terminu", () => {
  assert.equal(nextDueFrom(dzien("2026-05-10"), null), null);
});

test("nieznany rodzaj reguły kończy serię zamiast zgadywać", () => {
  const next = nextDueFrom(dzien("2026-05-10"), {
    type: "NIEZNANY",
    interval: 1,
  } as unknown as Parameters<typeof nextDueFrom>[1]);
  assert.equal(next, null);
});

test("TERMIN PO DACIE KOŃCA KOŃCZY SERIĘ — to jest właściwa treść tej reguły", () => {
  // `computeNextDue` o `endDate` nie wie; całe zadanie tej funkcji to dołożyć ucięcie.
  const next = nextDueFrom(dzien("2026-05-10"), {
    type: "DAILY",
    interval: 7,
    endDate: "2026-05-14",
  });
  assert.equal(next, null);
});

test("BRZEG WŁĄCZAJĄCY: termin RÓWNY dacie końca co do milisekundy jeszcze się liczy", () => {
  // Fikstura musi trafić DOKŁADNIE w brzeg, inaczej nie rozróżnia `>` od `>=`. Baza to
  // 2026-05-10 10:00Z, nawrót dzienny co 1 dzień, więc termin wypada 2026-05-11 10:00Z —
  // i taką samą wartość dostaje `endDate`.
  //
  // Wcześniejsza wersja tego testu dawała `endDate` na 23:59 i przechodziła także po zamianie
  // `>` na `>=`, czyli nie sprawdzała tego, co miała. Wykrył to test mutacyjny w `/verify`.
  const base = dzien("2026-05-10");
  const next = nextDueFrom(base, {
    type: "DAILY",
    interval: 1,
    endDate: "2026-05-11T10:00:00.000Z",
  });
  assert.equal(
    next?.toISOString(),
    "2026-05-11T10:00:00.000Z",
    "ostatnie zaplanowane podanie ma się odbyć — brzeg jest włączający"
  );
});

test("brzeg wyłączający z drugiej strony: milisekunda za datą końca kończy serię", () => {
  const next = nextDueFrom(dzien("2026-05-10"), {
    type: "DAILY",
    interval: 1,
    endDate: "2026-05-11T09:59:59.999Z",
  });
  assert.equal(next, null);
});

test("data końca w przyszłości nie przeszkadza", () => {
  const next = nextDueFrom(dzien("2026-05-10"), {
    type: "WEEKLY",
    interval: 1,
    endDate: "2027-01-01",
  });
  assert.equal(next?.toISOString().slice(0, 10), "2026-05-17");
});
