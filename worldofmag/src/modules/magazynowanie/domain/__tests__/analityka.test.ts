import { test } from "node:test";
import assert from "node:assert/strict";
import {
  wartoscPozycji,
  liczbaPonizejMinimum,
  wartoscWgMagazynu,
  klasyfikacjaAbc,
  martwyZapas,
  trendRuchow,
  type PozycjaDoAnalizy,
} from "../analityka";

const poz = (over: Partial<PozycjaDoAnalizy> & { id: string }): PozycjaDoAnalizy => ({
  name: over.id,
  quantity: 1,
  unitPrice: 1,
  ...over,
});

test("wartość pozycji: brak ceny lub stanu znaczy zero, nie awarię", () => {
  assert.equal(wartoscPozycji({ quantity: 3, unitPrice: 12.5 }), 37.5);
  assert.equal(wartoscPozycji({ quantity: null, unitPrice: 12.5 }), 0);
  assert.equal(wartoscPozycji({ quantity: 3, unitPrice: null }), 0);
});

test("poniżej minimum: pozycje BEZ minimum się nie liczą", () => {
  // Brak minimum to „nie pilnuję tego towaru", a nie „minimum wynosi zero".
  const items = [
    poz({ id: "a", quantity: 2, minQuantity: 5 }),
    poz({ id: "b", quantity: 9, minQuantity: 5 }),
    poz({ id: "c", quantity: 0, minQuantity: null }),
  ];
  assert.equal(liczbaPonizejMinimum(items), 1);
});

test("poniżej minimum: stan równy minimum jeszcze nie alarmuje", () => {
  assert.equal(liczbaPonizejMinimum([poz({ id: "a", quantity: 5, minQuantity: 5 })]), 0);
  assert.equal(liczbaPonizejMinimum([poz({ id: "a", quantity: 4, minQuantity: 5 })]), 1);
});

test("wartość wg magazynu: sortowanie malejące, pusty magazyn pod myślnikiem", () => {
  const wynik = wartoscWgMagazynu([
    poz({ id: "a", quantity: 1, unitPrice: 10, warehouse: "Piwnica" }),
    poz({ id: "b", quantity: 1, unitPrice: 90, warehouse: "Garaż" }),
    poz({ id: "c", quantity: 1, unitPrice: 5, warehouse: "  " }),
  ]);
  assert.deepEqual(
    wynik.map((w) => w.warehouse),
    ["Garaż", "Piwnica", "—"]
  );
  assert.equal(wynik[0].value, 90);
});

test("ABC: progi liczone od UDZIAŁU NARASTAJĄCEGO, nie od wartości pozycji", () => {
  // Sedno reguły. Pozycja warta 80 % magazynu jest sama klasą A; kolejne dobijają do 95 % (B),
  // a ogon to C. Gdyby progi liczyć od wartości pojedynczej pozycji, w A nie znalazłoby się nic.
  const wynik = klasyfikacjaAbc([
    poz({ id: "duza", quantity: 1, unitPrice: 800 }),
    poz({ id: "srednia", quantity: 1, unitPrice: 150 }),
    poz({ id: "mala", quantity: 1, unitPrice: 50 }),
  ]);
  assert.deepEqual(
    wynik.map((i) => [i.id, i.klasa]),
    [
      ["duza", "A"],
      ["srednia", "B"],
      ["mala", "C"],
    ]
  );
});

test("ABC: PRÓG KLASY A TO DOKŁADNIE 80 % — przypięty fikstura, nie na słowo", () => {
  // Fikstura dobrana tak, żeby udział narastający wypadł MIĘDZY 80 a 90: pozycja warta 85 % magazynu
  // jest klasą **B**, bo 85 > 80. Gdyby ktoś przesunął próg na 90, ta sama pozycja wyszłaby jako A
  // i test to zauważy. Wcześniejsza fikstura (80/95/100) tego nie łapała — udziały trafiały dokładnie
  // w progi, więc przesunięcie progu niczego nie zmieniało.
  const wynik = klasyfikacjaAbc([
    poz({ id: "osiemdziesiat-piec", quantity: 1, unitPrice: 85 }),
    poz({ id: "reszta", quantity: 1, unitPrice: 15 }),
  ]);
  assert.equal(wynik[0].cumPct, 85);
  assert.equal(wynik[0].klasa, "B", "85 % udziału narastającego to już nie klasa A");
});

test("ABC: próg klasy A jest WŁĄCZAJĄCY — dokładnie 80 % to jeszcze A", () => {
  const wynik = klasyfikacjaAbc([
    poz({ id: "rowno-osiemdziesiat", quantity: 1, unitPrice: 80 }),
    poz({ id: "reszta", quantity: 1, unitPrice: 20 }),
  ]);
  assert.equal(wynik[0].cumPct, 80);
  assert.equal(wynik[0].klasa, "A");
});

test("ABC: PRÓG KLASY B TO DOKŁADNIE 95 % — przypięty osobno", () => {
  // Udział narastający drugiej pozycji wypada na 96 %, czyli MIĘDZY 95 a 99. Realna reguła daje C;
  // przesunięcie progu B na 99 dałoby B — i test to zauważy.
  const wynik = klasyfikacjaAbc([
    poz({ id: "polowa", quantity: 1, unitPrice: 50 }),
    poz({ id: "prawie-reszta", quantity: 1, unitPrice: 46 }),
    poz({ id: "ogon", quantity: 1, unitPrice: 4 }),
  ]);
  assert.equal(wynik[0].klasa, "A");
  assert.equal(wynik[1].cumPct, 96);
  assert.equal(wynik[1].klasa, "C", "96 % udziału narastającego to już nie klasa B");
});

test("ABC: próg klasy B jest WŁĄCZAJĄCY — dokładnie 95 % to jeszcze B", () => {
  const wynik = klasyfikacjaAbc([
    poz({ id: "a", quantity: 1, unitPrice: 50 }),
    poz({ id: "b", quantity: 1, unitPrice: 45 }),
    poz({ id: "c", quantity: 1, unitPrice: 5 }),
  ]);
  assert.equal(wynik[1].cumPct, 95);
  assert.equal(wynik[1].klasa, "B");
});

test("ABC: pozycje bezwartościowe wypadają, żeby nie przesuwać progów", () => {
  const wynik = klasyfikacjaAbc([
    poz({ id: "ma-wartosc", quantity: 2, unitPrice: 100 }),
    poz({ id: "bez-ceny", quantity: 5, unitPrice: null }),
    poz({ id: "zerowy-stan", quantity: 0, unitPrice: 999 }),
  ]);
  assert.deepEqual(
    wynik.map((i) => i.id),
    ["ma-wartosc"]
  );
  assert.equal(wynik[0].cumPct, 100);
});

test("ABC: pusty magazyn nie dzieli przez zero", () => {
  assert.deepEqual(klasyfikacjaAbc([]), []);
  assert.deepEqual(klasyfikacjaAbc([poz({ id: "a", quantity: 0, unitPrice: 0 })]), []);
});

test("ABC: ostatnia pozycja zawsze domyka się na 100 %", () => {
  const wynik = klasyfikacjaAbc([
    poz({ id: "a", quantity: 1, unitPrice: 3 }),
    poz({ id: "b", quantity: 1, unitPrice: 7 }),
  ]);
  assert.ok(Math.abs(wynik[wynik.length - 1].cumPct - 100) < 1e-9);
});

test("martwy zapas: brak ruchu w ogóle liczy się jak ruch dawno temu", () => {
  const teraz = new Date("2026-06-01T12:00:00.000Z");
  const wynik = martwyZapas(
    [
      poz({ id: "nigdy", quantity: 4, unitPrice: 10, lastMove: null }),
      poz({ id: "swiezy", quantity: 4, unitPrice: 10, lastMove: new Date("2026-05-30T12:00:00Z") }),
    ],
    90,
    teraz
  );
  assert.deepEqual(
    wynik.map((i) => i.id),
    ["nigdy"]
  );
});

test("martwy zapas: pozycja z zerowym stanem NIE jest martwym zapasem", () => {
  // Nie ma czego odmrażać — towaru po prostu nie ma na stanie.
  const wynik = martwyZapas([poz({ id: "pusty", quantity: 0, unitPrice: 10, lastMove: null })], 90);
  assert.deepEqual(wynik, []);
});

test("martwy zapas: granica dni działa w obie strony", () => {
  const teraz = new Date("2026-06-01T12:00:00.000Z");
  const tuzPrzed = new Date("2026-03-01T12:00:00.000Z"); // ~92 dni
  const tuzPo = new Date("2026-05-15T12:00:00.000Z"); //   ~17 dni
  const wynik = martwyZapas(
    [
      poz({ id: "stary", quantity: 1, unitPrice: 1, lastMove: tuzPrzed }),
      poz({ id: "nowy", quantity: 1, unitPrice: 1, lastMove: tuzPo }),
    ],
    90,
    teraz
  );
  assert.deepEqual(
    wynik.map((i) => i.id),
    ["stary"]
  );
});

test("martwy zapas: sortowanie malejąco po wartości — najdroższy leżak na górze", () => {
  const wynik = martwyZapas(
    [
      poz({ id: "tani", quantity: 1, unitPrice: 5, lastMove: null }),
      poz({ id: "drogi", quantity: 1, unitPrice: 500, lastMove: null }),
    ],
    30
  );
  assert.deepEqual(
    wynik.map((i) => i.id),
    ["drogi", "tani"]
  );
});

test("trend: DNI BEZ RUCHU SĄ W WYNIKU z zerami — inaczej wykres skleiłby odległe daty", () => {
  const teraz = new Date("2026-06-10T12:00:00.000Z");
  const wynik = trendRuchow([{ delta: 5, createdAt: new Date("2026-06-10T08:00:00Z") }], 3, teraz);
  assert.deepEqual(wynik, [
    { date: "2026-06-08", in: 0, out: 0 },
    { date: "2026-06-09", in: 0, out: 0 },
    { date: "2026-06-10", in: 5, out: 0 },
  ]);
});

test("trend: przyjęcia i wydania rozdzielone po znaku, wydania jako liczba dodatnia", () => {
  const teraz = new Date("2026-06-10T12:00:00.000Z");
  const wynik = trendRuchow(
    [
      { delta: 7, createdAt: new Date("2026-06-10T08:00:00Z") },
      { delta: -3, createdAt: new Date("2026-06-10T09:00:00Z") },
    ],
    1,
    teraz
  );
  assert.deepEqual(wynik, [{ date: "2026-06-10", in: 7, out: 3 }]);
});

test("trend: ruch spoza okna jest pomijany, a nie doklejany do brzegu", () => {
  const teraz = new Date("2026-06-10T12:00:00.000Z");
  const wynik = trendRuchow([{ delta: 100, createdAt: new Date("2026-01-01T08:00:00Z") }], 3, teraz);
  assert.deepEqual(
    wynik.map((d) => d.in),
    [0, 0, 0]
  );
});

test("trend: ruch zerowy liczy się jako przyjęcie — zastane zachowanie (`delta >= 0`)", () => {
  const teraz = new Date("2026-06-10T12:00:00.000Z");
  const wynik = trendRuchow([{ delta: 0, createdAt: new Date("2026-06-10T08:00:00Z") }], 1, teraz);
  assert.deepEqual(wynik, [{ date: "2026-06-10", in: 0, out: 0 }]);
});
