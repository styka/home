import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLogRecord, oczysc, wKontekscieLogu, biezacyKontekstLogu } from "../log";

/**
 * 086 (zadanie 31) — LOGI STRUKTURALNE. Test bez bazy: budowanie rekordu jest czyste.
 *
 * Sedno leży w dwóch miejscach, które łatwo napisać tak, że „działa", a wymagania nie spełnia:
 * kontekst musi doklejać się SAM (inaczej pola z rozdz. 11.7 istnieją w typie i nie ma ich
 * w logach), a ochrona przed PII musi działać na WARTOŚCIACH, nie na dobrych intencjach.
 */
test("rekord ma znacznik czasu, poziom i nazwę zdarzenia", () => {
  const r = buildLogRecord("info", "test.zdarzenie", { a: 1 }, new Date("2026-08-19T10:00:00.000Z"), {});
  assert.equal(r.ts, "2026-08-19T10:00:00.000Z");
  assert.equal(r.level, "info");
  assert.equal(r.event, "test.zdarzenie");
  assert.equal(r.a, 1);
});

test("kontekst dokleja się automatycznie i SCALA przy zagnieżdżeniu", () => {
  wKontekscieLogu({ requestId: "r1" }, () => {
    wKontekscieLogu({ module: "tasks" }, () => {
      const ctx = biezacyKontekstLogu();
      // Bez scalania trasa ustawiłaby requestId, a akcja w środku by go zgubiła — czyli dokładnie
      // to jedno pole, po którym zbiera się linie jednego żądania.
      assert.equal(ctx.requestId, "r1");
      assert.equal(ctx.module, "tasks");
      const r = buildLogRecord("info", "x");
      assert.equal(r.requestId, "r1");
      assert.equal(r.module, "tasks");
    });
  });
});

test("poza kontekstem rekord po prostu nie ma tych pól", () => {
  const r = buildLogRecord("info", "x", undefined, new Date(), biezacyKontekstLogu());
  assert.equal(r.requestId, undefined, "brak kontekstu to brak pól, a nie wyjątek");
});

test("adres e-mail nigdy nie trafia do logu", () => {
  assert.equal(oczysc("kontakt: jan.kowalski@example.com prosi o zwrot"), "kontakt: [e-mail] prosi o zwrot");
  const r = buildLogRecord("warn", "x", { detail: "błąd dla a@b.pl" }, new Date(), {});
  assert.ok(!String(r.detail).includes("a@b.pl"));
});

test("obiekty i tablice są spłaszczane do rozmiaru", () => {
  // Obiekt w logu to prawie zawsze cały rekord wrzucony odruchowo — czyli najkrótsza droga do
  // wycieku danych osobowych i do linii, której nikt nie przeczyta.
  assert.equal(oczysc({ email: "a@b.pl", imie: "Jan" }), "[obiekt 2 pól]");
  assert.equal(oczysc([1, 2, 3]), "[tablica 3]");
});

test("długi tekst jest przycinany", () => {
  const wynik = String(oczysc("x".repeat(500)));
  assert.ok(wynik.length < 250, "log nie jest miejscem na 500 znaków treści");
  assert.ok(wynik.endsWith("…"), "przycięcie musi być widoczne, żeby nikt nie czytał urwanej wartości jako pełnej");
});

test("błąd jest logowany komunikatem, nie obiektem", () => {
  assert.equal(oczysc(new Error("coś poszło nie tak")), "coś poszło nie tak");
});

/**
 * Z-096 (przeniesione razem z warstwą): własności samego rekordu, niezależne od kontekstu i PII.
 * Zostają, bo pilnują rzeczy, których nowe przypadki nie dotykają — a jedna linia JSON to warunek
 * czytelności strumienia dla agregatora.
 */
const NOW = new Date("2026-06-17T08:30:00.000Z");

test("bez pól rekord ma wyłącznie ts/level/event", () => {
  const r = buildLogRecord("warn", "x", undefined, NOW, {});
  assert.deepEqual(Object.keys(r).sort(), ["event", "level", "ts"]);
});

test("rekord serializuje się do JEDNEJ linii JSON", () => {
  const line = JSON.stringify(buildLogRecord("error", "boom", { durationMs: 12, outcome: "blad" }, NOW, {}));
  assert.ok(!line.includes("\n"), "wielolinijkowy rekord rozwaliłby parser agregatora");
  const parsed = JSON.parse(line);
  assert.equal(parsed.event, "boom");
  assert.equal(parsed.outcome, "blad");
  assert.equal(parsed.durationMs, 12);
});

test("pola własne nie nadpisują ts/level/event", () => {
  const r = buildLogRecord("info", "e", { custom: 1 }, NOW, {});
  assert.equal(r.event, "e");
  assert.equal(r.custom, 1);
});
