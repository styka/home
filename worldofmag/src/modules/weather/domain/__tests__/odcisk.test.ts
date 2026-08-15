import { test } from "node:test";
import assert from "node:assert/strict";
import { roundedBrief } from "../odcisk";
import type { WybranaPora } from "../pora";
import { DAY_PARTS } from "../../lib/presets";
import type { HourPoint, DayPoint } from "../../lib/openMeteo";

const godzina = (temp: number, precipProb = 0): HourPoint => ({
  time: "2026-05-10T08:00",
  isDay: true,
  temp,
  apparent: temp,
  precipProb,
  precip: 0,
  windKph: 5,
  code: 1,
});

const dzien = (over: Partial<DayPoint> = {}): DayPoint => ({
  date: "2026-05-10",
  code: 1,
  tMax: 20,
  tMin: 10,
  precipSum: 0,
  precipProbMax: 0,
  windMaxKph: 10,
  sunrise: "",
  sunset: "",
  uvMax: 3,
  ...over,
});

const pora = (day: DayPoint | undefined, hours: HourPoint[]): WybranaPora => ({
  date: "2026-05-10",
  part: DAY_PARTS[0],
  hours,
  day,
});

test("odcisk składa dzień i godziny", () => {
  const odcisk = roundedBrief(pora(dzien(), [godzina(15)]));
  assert.equal(odcisk, "1|10|20|0#1|15|0");
});

test("DROBNA KOREKTA TEMPERATURY NIE ZMIENIA ODCISKU — po to jest zaokrąglenie", () => {
  // Gdyby odcisk liczył się z surowych wartości, każda aktualizacja modelu o dziesiątą stopnia
  // unieważniałaby zapamiętaną treść i kazała ją wygenerować od nowa. To niweczyłoby oszczędność,
  // dla której pamięć treści (038) w ogóle powstała.
  //
  // Wszystkie trzy temperatury są UŁAMKOWE celowo: przy fiksturze z liczbami całkowitymi
  // zaokrąglenie nic nie zmienia, więc test przechodziłby także po usunięciu `Math.round`
  // z któregoś pola i nie pilnowałby niczego. Wykrył to test mutacyjny w `/verify`.
  const a = roundedBrief(pora(dzien({ tMin: 9.1, tMax: 20.0 }), [godzina(15.0)]));
  const b = roundedBrief(pora(dzien({ tMin: 9.4, tMax: 20.3 }), [godzina(15.2)]));
  assert.equal(a, b);
  assert.equal(a, "1|9|20|0#1|15|0", "odcisk zawiera zaokrąglone liczby całkowite");
});

test("zaokrąglane jest KAŻDE pole z osobna — tMin, tMax i temperatura godzinowa", () => {
  // Trzy osobne wywołania `Math.round`; usunięcie któregokolwiek jednego musi być widoczne.
  assert.equal(roundedBrief(pora(dzien({ tMin: 9.6, tMax: 20 }), [godzina(15)])), "1|10|20|0#1|15|0");
  assert.equal(roundedBrief(pora(dzien({ tMin: 10, tMax: 19.6 }), [godzina(15)])), "1|10|20|0#1|15|0");
  assert.equal(roundedBrief(pora(dzien({ tMin: 10, tMax: 20 }), [godzina(14.6)])), "1|10|20|0#1|15|0");
});

test("REALNA ZMIANA POGODY ZMIENIA ODCISK — próg musi działać w drugą stronę", () => {
  // Druga strona tego samego progu: zaokrąglenie zbyt grube uznałoby treść za aktualną mimo
  // zmiany, którą użytkownik zobaczy za oknem.
  const a = roundedBrief(pora(dzien({ tMax: 20 }), [godzina(15)]));
  const b = roundedBrief(pora(dzien({ tMax: 24 }), [godzina(19)]));
  assert.notEqual(a, b);
});

test("szansa opadów skacze co 5 punktów procentowych", () => {
  const a = roundedBrief(pora(dzien({ precipProbMax: 40 }), [godzina(15, 40)]));
  const b = roundedBrief(pora(dzien({ precipProbMax: 42 }), [godzina(15, 42)]));
  const c = roundedBrief(pora(dzien({ precipProbMax: 48 }), [godzina(15, 48)]));
  assert.equal(a, b, "42% zaokrągla się do 40%");
  assert.notEqual(a, c, "48% zaokrągla się do 50%");
});

test("zmiana kodu pogody zmienia odcisk nawet przy tej samej temperaturze", () => {
  const slonce = roundedBrief(pora(dzien({ code: 1 }), [godzina(15)]));
  const deszcz = roundedBrief(pora(dzien({ code: 61 }), [godzina(15)]));
  assert.notEqual(slonce, deszcz);
});

test("brak danych dobowych daje pusty nagłówek, nie awarię", () => {
  assert.equal(roundedBrief(pora(undefined, [godzina(15)])), "#1|15|0");
});

test("brak godzin i brak dnia daje sam separator — odcisk pustej prognozy jest stabilny", () => {
  // Ważne, żeby to była WARTOŚĆ, a nie wyjątek: pusta prognoza ma dać powtarzalny odcisk,
  // inaczej każde odświeżenie uznawałoby treść za nieaktualną.
  assert.equal(roundedBrief(pora(undefined, [])), "#");
  assert.equal(roundedBrief(pora(undefined, [])), roundedBrief(pora(undefined, [])));
});

test("kolejność godzin jest częścią odcisku", () => {
  const rosnaco = roundedBrief(pora(dzien(), [godzina(10), godzina(20)]));
  const malejaco = roundedBrief(pora(dzien(), [godzina(20), godzina(10)]));
  assert.notEqual(rosnaco, malejaco);
});
