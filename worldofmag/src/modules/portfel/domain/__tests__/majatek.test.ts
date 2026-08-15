import { test } from "node:test";
import assert from "node:assert/strict";
import { signedBalance } from "../majatek";

test("dług wchodzi do majątku na minus", () => {
  assert.equal(signedBalance({ kind: "debt", balance: 12000 }), -12000);
});

test("pozostałe rodzaje wchodzą ze swoim znakiem", () => {
  assert.equal(signedBalance({ kind: "account", balance: 3200 }), 3200);
  assert.equal(signedBalance({ kind: "cash", balance: 150 }), 150);
  assert.equal(signedBalance({ kind: "savings", balance: 50000 }), 50000);
  assert.equal(signedBalance({ kind: "investment", balance: 8000 }), 8000);
});

test("nieznany rodzaj traktujemy jak aktywo, nie jak dług", () => {
  // Brzeg dobrany świadomie: reguła rozpoznaje JEDEN rodzaj i to on jest wyjątkiem. Nowy rodzaj
  // elementu dodany w przyszłości policzy się na plus — jeśli miałby być zobowiązaniem, trzeba
  // dopisać go tutaj, a ten test pokaże, że domyślne zachowanie jest inne.
  assert.equal(signedBalance({ kind: "kryptowaluty", balance: 900 }), 900);
});

test("nadpłacony dług (saldo ujemne) wychodzi na plus", () => {
  assert.equal(signedBalance({ kind: "debt", balance: -500 }), 500);
});

test("zero nie zmienia wartości bezwzględnej", () => {
  assert.equal(Math.abs(signedBalance({ kind: "debt", balance: 0 })), 0);
  assert.equal(signedBalance({ kind: "account", balance: 0 }), 0);
});
