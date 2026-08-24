import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 082 — reguły układu listy obserwatorów. Bez bazy i bez Reacta: to jest cała treść tego, co
 * użytkownik zobaczy po ocenie, więc ma być sprawdzalne w milisekundach.
 */

type S = "met" | "partial" | "unmet" | "unknown";
const st = (x: { s: S | null }) => x.s;

test("wartość spoza unii wraca jako domyślna, nie jako wyjątek", async () => {
  const { czytajUklad } = await import("@/modules/weather/lib/uklad");
  assert.equal(czytajUklad("grouped"), "grouped");
  assert.equal(czytajUklad("manual"), "manual");
  // Preferencja przychodzi z bazy i może pochodzić z innej wersji aplikacji.
  assert.equal(czytajUklad("kafelki"), "status");
  assert.equal(czytajUklad(null), "status");
  assert.equal(czytajUklad(""), "status");
});

test("sortowanie po stanie jest stabilne, a brak werdyktu ląduje na końcu", async () => {
  const { poStanie } = await import("@/modules/weather/lib/uklad");
  const dane: { id: string; s: S | null }[] = [
    { id: "a", s: "unmet" },
    { id: "b", s: null },
    { id: "c", s: "met" },
    { id: "d", s: "unmet" },
    { id: "e", s: "partial" },
  ];
  assert.deepEqual(
    poStanie(dane, st).map((x) => x.id),
    // met → partial → unmet (a przed d: kolejność wewnątrz stanu zachowana) → bez werdyktu
    ["c", "e", "a", "d", "b"],
  );
});

test("sekcje idą w stałej kolejności, a pusta sekcja nie jest rysowana", async () => {
  const { wSekcje } = await import("@/modules/weather/lib/uklad");
  const dane: { id: string; s: S | null }[] = [
    { id: "a", s: "unknown" },
    { id: "b", s: "met" },
    { id: "c", s: null },
  ];
  const sekcje = wSekcje(dane, st);
  assert.deepEqual(sekcje.map((g) => g.status), ["met", "unknown", null]);
  assert.deepEqual(sekcje[2].pozycje.map((x) => x.id), ["c"]);
});

