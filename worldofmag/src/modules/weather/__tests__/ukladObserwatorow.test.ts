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

test("pusty filtr znaczy BRAK filtra, nie zero dozwolonych stanów", async () => {
  const { czytajFiltr, zapiszFiltr } = await import("@/modules/weather/lib/uklad");
  assert.deepEqual(czytajFiltr(""), []);
  assert.deepEqual(czytajFiltr(null), []);
  // Śmieci odsiewane po cichu, powtórki scalane.
  assert.deepEqual(czytajFiltr("partial,met,met,cokolwiek"), ["partial", "met"]);
  // Zapis jest kanoniczny — kolejność stanów nie zależy od kolejności klikania.
  assert.equal(zapiszFiltr(["unknown", "met"]), "met,unknown");
  assert.equal(zapiszFiltr([]), "");
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

test("liczniki podają wszystkie stany, także te z zerem", async () => {
  const { liczniki } = await import("@/modules/weather/lib/uklad");
  const dane: { id: string; s: S | null }[] = [{ id: "a", s: "met" }, { id: "b", s: null }];
  assert.deepEqual(liczniki(dane, st), { met: 1, partial: 0, unmet: 0, unknown: 0 });
});
