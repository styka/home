import { test } from "node:test";
import assert from "node:assert/strict";
import { POLITYKI, kluczOkna, kluczDzierzawy, type Polityka } from "../polityki";

/**
 * 081 — polityki są jedyną częścią limitera BEZ bazy, więc ich sensowność sprawdzamy bez bazy.
 * Nie chodzi o „czy 20 to dobra liczba" (to decyzja), tylko o niezmienniki, których złamanie
 * sprawia, że limiter przestaje limitować albo zaczyna kłamać w komunikacie.
 */
test("każda polityka ma spójne okna, dzierżawę i komunikaty", () => {
  for (const [zakres, p] of Object.entries(POLITYKI) as [string, Polityka][]) {
    if (p.naMinute !== null && p.naGodzine !== null) {
      assert.ok(
        p.naGodzine >= p.naMinute,
        `${zakres}: limit godzinny nie może być niższy od minutowego — okno minutowe stałoby się martwe`
      );
    }
    assert.ok(p.naMinute !== null || p.naGodzine !== null, `${zakres}: polityka bez ani jednego okna nic nie limituje`);
    if (p.rownolegle !== null) {
      assert.ok(p.rownolegle >= 1, `${zakres}: zero slotów zablokowałoby operację na stałe`);
      assert.ok(
        p.dzierzawaSek >= 60,
        `${zakres}: dzierżawa krótsza od minuty wygaśnie pod trwającą operacją i strażnik przestanie strzec`
      );
    }
    for (const [pole, tekst] of [
      ["komunikatMinuta", p.komunikatMinuta],
      ["komunikatGodzina", p.komunikatGodzina],
      ["komunikatSlot", p.komunikatSlot],
    ] as const) {
      assert.ok(tekst.length > 10, `${zakres}.${pole}: komunikat pokazywany użytkownikowi nie może być pusty`);
      assert.ok(
        /[ąćęłńóśżź]/i.test(tekst),
        `${zakres}.${pole}: komunikat trafia wprost na ekran, więc musi być po polsku`
      );
    }
  }
});

test("klucze zakresów nie mogą się na siebie nakładać", () => {
  // Gdyby klucz okna jednego zakresu dał się zbudować także dla innego (np. przez podmiot z
  // dwukropkiem), dwa niezależne limity zaczęłyby się nawzajem wyczerpywać.
  const a = kluczOkna("ai.agent", "u1", "min");
  const b = kluczOkna("ai.mowa", "u1", "min");
  assert.notEqual(a, b, "różne zakresy muszą mieć różne klucze");
  assert.notEqual(kluczOkna("ai.agent", "u1", "min"), kluczOkna("ai.agent", "u1", "godz"));
  assert.notEqual(kluczDzierzawy("ai.agent", "u1"), kluczDzierzawy("ai.mowa", "u1"));
});
