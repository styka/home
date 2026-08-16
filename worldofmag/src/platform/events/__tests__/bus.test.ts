import { test } from "node:test";
import assert from "node:assert/strict";
import { subskrybuj, rozglos, ileSluchaczy, kanalyDla } from "../bus";

/** Zbiera sygnały i zwraca odsubskrybowanie razem z buforem. */
function sluchacz(kanaly: string[]) {
  const odebrane: string[] = [];
  const odsubskrybuj = subskrybuj(kanaly, (s) => odebrane.push(s.type));
  return { odebrane, odsubskrybuj };
}

test("sygnał trafia do słuchacza właściwego kanału", () => {
  const a = sluchacz(["ws:1"]);
  rozglos(["ws:1"], { type: "shopping.list.completed", workspaceId: "1" });
  assert.deepEqual(a.odebrane, ["shopping.list.completed"]);
  a.odsubskrybuj();
});

test("SYGNAŁ NIE TRAFIA DO CUDZEGO KANAŁU — to jest granica prywatności, nie filtr", () => {
  // Gdyby rozgłoszenie szło do wszystkich, użytkownik dostawałby sygnał o zmianach w cudzej
  // przestrzeni. Sam sygnał jest ubogi (`type` + `workspaceId`), ale to i tak wyciek informacji
  // o tym, że u kogoś coś się dzieje.
  const moj = sluchacz(["ws:moja"]);
  const cudzy = sluchacz(["ws:cudza"]);

  rozglos(["ws:cudza"], { type: "magazynowanie.stan.zmieniony", workspaceId: "cudza" });

  assert.deepEqual(moj.odebrane, [], "nie dostałem cudzego sygnału");
  assert.deepEqual(cudzy.odebrane, ["magazynowanie.stan.zmieniony"]);
  moj.odsubskrybuj();
  cudzy.odsubskrybuj();
});

test("ODSUBSKRYBOWANIE REALNIE USUWA SŁUCHACZA — inaczej zamknięte karty zostają na zawsze", () => {
  const przed = ileSluchaczy();
  const a = sluchacz(["ws:1", "user:x"]);
  assert.equal(ileSluchaczy(), przed + 1);

  a.odsubskrybuj();
  assert.equal(ileSluchaczy(), przed, "słuchacz zniknął ze WSZYSTKICH swoich kanałów");

  rozglos(["ws:1"], { type: "po-odsubskrybowaniu", workspaceId: "1" });
  assert.deepEqual(a.odebrane, [], "odsubskrybowany nic już nie dostaje");
});

test("dwóch słuchaczy tego samego kanału dostaje obaj", () => {
  const a = sluchacz(["ws:wspolna"]);
  const b = sluchacz(["ws:wspolna"]);
  rozglos(["ws:wspolna"], { type: "kuchnia.spizarnia.spisana", workspaceId: "wspolna" });
  assert.equal(a.odebrane.length, 1);
  assert.equal(b.odebrane.length, 1);
  a.odsubskrybuj();
  b.odsubskrybuj();
});

test("słuchacz zapisany na kilku kanałach dostaje sygnał RAZ, nie tyle razy, ile ma kanałów", () => {
  // Karta jest zapisana na własnym kanale i na kanale przestrzeni. Zdarzenie rozgłaszane na oba
  // nie może wywołać dwóch odświeżeń pod rząd.
  const a = sluchacz(["user:u1", "ws:w1"]);
  rozglos(["user:u1", "ws:w1"], { type: "podwojny", workspaceId: "w1" });
  assert.deepEqual(a.odebrane, ["podwojny"]);
  a.odsubskrybuj();
});

test("błąd jednego słuchacza nie blokuje pozostałych", () => {
  // Zerwane połączenie rzuca przy zapisie — to normalny koniec życia karty, nie awaria szyny.
  const odsubZly = subskrybuj(["ws:1"], () => {
    throw new Error("połączenie zerwane");
  });
  const dobry = sluchacz(["ws:1"]);

  rozglos(["ws:1"], { type: "mimo-bledu", workspaceId: "1" });

  assert.deepEqual(dobry.odebrane, ["mimo-bledu"]);
  odsubZly();
  dobry.odsubskrybuj();
});

test("kanały liczone są z sesji: własny plus po jednym na przestrzeń", () => {
  assert.deepEqual(kanalyDla("u1", ["a", "b"]), ["user:u1", "ws:a", "ws:b"]);
  assert.deepEqual(kanalyDla("u1", []), ["user:u1"], "bez przestrzeni zostaje kanał własny");
});
