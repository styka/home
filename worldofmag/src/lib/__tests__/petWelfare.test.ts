import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEnvironmentSuggestions } from "../petWelfare";

// Z-174: alarmy środowiskowe terrariów. Tu gałąź wymiany sprzętu (deterministyczna);
// latest:null pomija logikę zakresów (pokrytą osobno w petEnvironment.test).
const now = new Date("2026-06-16T12:00:00Z");
const enc = (equipment: unknown, latest: Record<string, number | null> | null = null) => ([{
  id: "e1", name: "Terrarium", type: "TERRARIUM", targetRanges: null,
  latest, equipment: JSON.stringify(equipment),
}]);

test("alarm gdy termin wymiany sprzętu minął", () => {
  const out = buildEnvironmentSuggestions(enc([{ name: "Lampa UV", replaceBy: "2026-01-01" }]), now);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /Lampa UV/);
  assert.equal(out[0].severity, "warning");
});

test("brak alarmu gdy termin w przyszłości lub brak terminu", () => {
  assert.equal(buildEnvironmentSuggestions(enc([{ name: "Lampa UV", replaceBy: "2027-01-01" }]), now).length, 0);
  assert.equal(buildEnvironmentSuggestions(enc([{ name: "Grzałka" }]), now).length, 0);
});

test("brak danych / pusty sprzęt → brak sugestii", () => {
  assert.deepEqual(buildEnvironmentSuggestions([], now), []);
  assert.deepEqual(buildEnvironmentSuggestions(enc([]), now), []);
});

test("wiele zaległych sprzętów → wiele alarmów", () => {
  const out = buildEnvironmentSuggestions(enc([
    { name: "Lampa UV", replaceBy: "2026-01-01" },
    { name: "Filtr", replaceBy: "2026-02-01" },
  ]), now);
  assert.equal(out.length, 2);
});
