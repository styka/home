import { test } from "node:test";
import assert from "node:assert/strict";
import { matchNamedRef, unresolvedRefMessage, type RefResolution } from "@/lib/ai/refResolve";

// 032: agent mówi nazwami („w projekcie Omnia", „na liście moje"), a read-toole przyjmowały je jako
// identyfikatory — `where: { id: "moje" }` nie pasowało do niczego i asystent twierdził, że nic tam
// nie ma. Te testy pilnują wszystkich pięciu ścieżek rozwiązywania referencji.

const LISTS = [
  { id: "cml1", name: "moje" },
  { id: "cml2", name: "Kocoń" },
  { id: "cml3", name: "Katowice" },
  { id: "cml4", name: "Katowice -> Kocoń" },
];

const unresolved = (r: RefResolution) => {
  assert.ok(!("id" in r), "oczekiwano nierozwiązanej referencji");
  return r as Extract<RefResolution, { unresolved: string }>;
};

test("identyfikator ma pierwszeństwo przed nazwą", () => {
  assert.deepEqual(matchNamedRef("cml2", LISTS), { id: "cml2" });
});

test("dokładna nazwa, bez rozróżniania wielkości liter i z obcięciem spacji", () => {
  assert.deepEqual(matchNamedRef("MOJE", LISTS), { id: "cml1" });
  assert.deepEqual(matchNamedRef("  moje  ", LISTS), { id: "cml1" });
});

test("dokładna nazwa wygrywa z dopasowaniem częściowym", () => {
  // „Katowice" pasuje częściowo też do „Katowice -> Kocoń", ale dokładne trafienie jest jedno.
  assert.deepEqual(matchNamedRef("Katowice", LISTS), { id: "cml3" });
});

test("jednoznaczne dopasowanie częściowe", () => {
  assert.deepEqual(matchNamedRef("kocoń", LISTS), { id: "cml2" });
  assert.deepEqual(matchNamedRef("-> Kocoń", LISTS), { id: "cml4" });
});

test("wiele dopasowań częściowych → nierozwiązane z listą trafień", () => {
  const res = unresolved(matchNamedRef("kato", LISTS));
  assert.deepEqual(res.matches, ["Katowice", "Katowice -> Kocoń"]);
  assert.equal(res.unresolved, "kato");
});

test("wiele dokładnych dopasowań (duplikat nazwy) → nierozwiązane", () => {
  const dup = [
    { id: "a", name: "Zakupy" },
    { id: "b", name: "zakupy" },
  ];
  const res = unresolved(matchNamedRef("Zakupy", dup));
  assert.equal(res.matches.length, 2);
});

test("brak dopasowania → nierozwiązane bez trafień, z listą dostępnych", () => {
  const res = unresolved(matchNamedRef("Rower", LISTS));
  assert.deepEqual(res.matches, []);
  assert.deepEqual(res.available, ["moje", "Kocoń", "Katowice", "Katowice -> Kocoń"]);
});

test("pusta referencja nie dopasowuje się do wszystkiego", () => {
  // Bez tego zabezpieczenia `includes("")` trafiałoby w KAŻDĄ pozycję i przy jednej liście
  // rozwiązywałoby się „na oślep".
  const res = unresolved(matchNamedRef("   ", LISTS));
  assert.deepEqual(res.matches, []);
});

test("komunikat rozróżnia „pasuje kilka” od „nie ma”", () => {
  const many = unresolvedRefMessage(unresolved(matchNamedRef("kato", LISTS)), "listy zakupów");
  assert.match(many, /pasuje do kilku pozycji/);
  assert.match(many, /Katowice, Katowice -> Kocoń/);

  const none = unresolvedRefMessage(unresolved(matchNamedRef("Rower", LISTS)), "listy zakupów");
  assert.match(none, /Nie znaleziono listy zakupów o nazwie/);
  assert.match(none, /Dostępne: moje, Kocoń/);
});

test("komunikat przy zupełnie pustym zbiorze mówi „(brak)”", () => {
  const none = unresolvedRefMessage(unresolved(matchNamedRef("cokolwiek", [])), "notatki");
  assert.match(none, /Dostępne: \(brak\)/);
});
