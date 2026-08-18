import { test } from "node:test";
import assert from "node:assert/strict";
import { formatujDate, formatujGodzine, formatujKwote, formatujLiczbe, granicaDnia } from "../format";
import { jezykLubDomyslny, strefaLubDomyslna } from "../jezyki";

/**
 * 089 (zadanie 37) — FORMATOWANIE. Bez bazy: to czyste funkcje nad `Intl`.
 *
 * Sedno nie leży w tym, czy „19 sie 2026" wygląda ładnie, tylko w trzech rzeczach, które
 * `toLocaleString("pl-PL")` robi źle, a wyglądają poprawnie: ignoruje strefę przestrzeni,
 * wyprowadza walutę z języka i liczy granicę doby arytmetyką na `Date`.
 */
const WARSZAWA = { locale: "pl", timezone: "Europe/Warsaw" };
const TOKIO = { locale: "pl", timezone: "Asia/Tokyo" };

test("godzina zależy od strefy PRZESTRZENI, nie od strefy serwera", () => {
  // 20:00 UTC to 22:00 w Warszawie (latem UTC+2) i 05:00 następnego dnia w Tokio (UTC+9).
  // Bez `timeZone` obie wyszłyby tak samo — i tak samo źle dla każdego spoza strefy serwera.
  const chwila = new Date("2026-08-19T20:00:00.000Z");
  assert.match(formatujGodzine(chwila, WARSZAWA), /22:00/);
  assert.match(formatujGodzine(chwila, TOKIO), /05:00/);
});

test("data też przesuwa się razem ze strefą", () => {
  // Ta sama chwila to w Warszawie jeszcze 19 sierpnia, a w Tokio już 20.
  const chwila = new Date("2026-08-19T20:00:00.000Z");
  assert.match(formatujDate(chwila, WARSZAWA), /19/);
  assert.match(formatujDate(chwila, TOKIO), /20/);
});

test("waluta jest PARAMETREM, nie pochodną języka", () => {
  // W tej samej polskiej przestrzeni trzyma się złotówki i euro (Portfel jest wielowalutowy).
  // Wyprowadzanie waluty z języka dałoby złą kwotę przy poprawnym formacie.
  const pln = formatujKwote(1234.5, "PLN", WARSZAWA);
  const eur = formatujKwote(1234.5, "EUR", WARSZAWA);
  assert.notEqual(pln, eur);
  assert.ok(pln.includes("1") && eur.includes("1"));
});

test("liczby formatują się wg języka", () => {
  assert.equal(formatujLiczbe(1234567, WARSZAWA), new Intl.NumberFormat("pl", { maximumFractionDigits: 0 }).format(1234567));
});

test("granica doby liczona jest w strefie przestrzeni, nie serwera", () => {
  // Serwer na Renderze chodzi w UTC. Między północą a drugą w nocy polskie „dzisiaj" to serwerowe
  // „wczoraj" — arytmetyka na `Date` dawałaby wtedy złą odpowiedź na „co jest na dziś".
  const wPolskiPoranek = new Date("2026-08-19T00:30:00.000Z"); // 02:30 w Warszawie
  const { start, koniec } = granicaDnia(wPolskiPoranek, "Europe/Warsaw");
  assert.ok(start <= wPolskiPoranek && wPolskiPoranek < koniec, "chwila musi mieścić się w swojej dobie");
  assert.equal(koniec.getTime() - start.getTime(), 86_400_000);
  // Ta sama chwila w Tokio należy już do innej doby.
  const tokijska = granicaDnia(wPolskiPoranek, "Asia/Tokyo");
  assert.notEqual(tokijska.start.getTime(), start.getTime());
});

test("nieznany język i nieznana strefa degradują się, a nie wywracają strony", () => {
  assert.equal(jezykLubDomyslny("kl"), "pl");
  assert.equal(jezykLubDomyslny(null), "pl");
  assert.equal(strefaLubDomyslna("Nie/Istnieje"), "Europe/Warsaw");
  assert.equal(strefaLubDomyslna("Asia/Tokyo"), "Asia/Tokyo");
});
