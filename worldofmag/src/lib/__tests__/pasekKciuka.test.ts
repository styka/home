import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULES, defaultMenuPrefs, pozycjePaska, stronyPaska, MAKS_MODULOW_W_PASKU, type MenuPrefs } from "@/lib/modules";

/**
 * 103 — SKŁAD dolnego paska. Test pilnuje rzeczy, których kontrola typów nie złapie, a które
 * objawiłyby się dopiero na telefonie: że kotwic nie da się wypchnąć modułami, że kolejność jest
 * ta, o którą prosił właściciel, i że konto o wąskich uprawnieniach nadal ma czym nawigować.
 */

/** Wszystkie uprawnienia modułowe — konto bez ograniczeń. */
const WSZYSTKIE = MODULES.map((m) => m.permission).filter((p): p is string => p !== null);

function prefs(patch: Partial<MenuPrefs> = {}): MenuPrefs {
  return { ...defaultMenuPrefs(), ...patch };
}

test("pełne uprawnienia: dom + moduły po stronie dalszej, ulubione i historia pod kciukiem", () => {
  const { dalekie, bliskie } = pozycjePaska(WSZYSTKIE, prefs(), true);

  assert.equal(dalekie[0]?.rodzaj, "dom", "dom jest kotwicą najdalszą od kciuka");
  assert.deepEqual(
    dalekie.slice(1).map((p) => p.rodzaj),
    ["modul", "modul"],
    "po domu idą wyłącznie moduły",
  );
  assert.deepEqual(bliskie.map((p) => p.rodzaj), ["ulubione", "historia"]);
});

/**
 * Testy lustrzenia sprawdzają **kolejność WYRENDEROWANĄ**, a nie listę wejściową. To jest poprawka
 * po weryfikacji: poprzednia wersja sprawdzała wynik `pozycjePaska`, czyli stan PRZED odwróceniem
 * tablic w komponencie — przechodziła, twierdząc, że historia stoi w rogu, podczas gdy w rogu
 * stała gwiazdka. Test mierzący coś innego, niż widzi użytkownik, jest częścią usterki.
 *
 * Pojemniki renderują od lewej do prawej, więc róg ekranu to `lewa[0]` albo `prawa[ostatni]`.
 */
function rogi(reka: "left" | "right", domDostepny = true) {
  const { dalekie, bliskie } = pozycjePaska(WSZYSTKIE, prefs(), domDostepny);
  const { lewa, prawa } = stronyPaska(dalekie, bliskie, reka);
  return {
    lewa,
    prawa,
    rogKciuka: reka === "left" ? lewa[0] : prawa[prawa.length - 1],
    rogPrzeciwny: reka === "left" ? prawa[prawa.length - 1] : lewa[0],
  };
}

test("ręka prawa: historia w PRAWYM rogu, dom w lewym — tak jak wymienił właściciel", () => {
  const { rogKciuka, rogPrzeciwny, prawa } = rogi("right");
  assert.equal(rogKciuka?.rodzaj, "historia", "róg pod kciukiem należy do historii");
  assert.equal(rogPrzeciwny?.rodzaj, "dom", "najdalej od kciuka stoi Strona główna");
  // „ulubione | historia" — dokładnie w kolejności ze zgłoszenia, licząc od środka na zewnątrz.
  assert.deepEqual(prawa.map((p) => p.rodzaj), ["ulubione", "historia"]);
});

test("ręka lewa: ten sam układ, odbity — historia w LEWYM rogu", () => {
  const { rogKciuka, rogPrzeciwny, lewa } = rogi("left");
  assert.equal(rogKciuka?.rodzaj, "historia");
  assert.equal(rogPrzeciwny?.rodzaj, "dom");
  assert.deepEqual(lewa.map((p) => p.rodzaj), ["historia", "ulubione"]);
});

test("obie ręce dają lustrzane odbicie tej samej listy", () => {
  // Układ widziany na ekranie to lewy pojemnik, a po nim prawy (magiczna ikona stoi między nimi
  // i jest neutralna względem ręki, więc w tym porównaniu nie bierze udziału).
  const naEkranie = (r: "left" | "right") => {
    const { lewa, prawa } = rogi(r);
    return [...lewa, ...prawa].map((x) => x.rodzaj);
  };
  assert.deepEqual(
    naEkranie("left"),
    [...naEkranie("right")].reverse(),
    "przełączenie ręki ma ODBIJAĆ układ, a nie układać go od nowa",
  );
});

test("pasek ma pięć pozycji — sufit wyliczony z 360 px (C-31)", () => {
  const { dalekie, bliskie } = pozycjePaska(WSZYSTKIE, prefs(), true);
  assert.equal(dalekie.length + bliskie.length, 5);
});

test("moduły nie wypchną kotwic, choćby użytkownik wybrał ich pięć", () => {
  const { dalekie, bliskie } = pozycjePaska(
    WSZYSTKIE,
    prefs({ tabBar: ["tasks", "shopping", "notes", "kitchen", "pets"] }),
    true,
  );
  const moduly = dalekie.filter((p) => p.rodzaj === "modul");
  assert.equal(moduly.length, MAKS_MODULOW_W_PASKU, "nadmiar preferencji jest PRZYCINANY, nie renderowany");
  assert.equal(dalekie.length + bliskie.length, 5);
});

test("zamknięta Strona główna: kotwica domu znika, a jej miejsce przechodzi na moduł", () => {
  const { dalekie, bliskie } = pozycjePaska(
    WSZYSTKIE,
    prefs({ tabBar: ["tasks", "shopping", "notes"] }),
    false,
  );
  assert.ok(!dalekie.some((p) => p.rodzaj === "dom"), "domu nie pokazujemy, gdy jest zamknięty");
  assert.equal(dalekie.filter((p) => p.rodzaj === "modul").length, MAKS_MODULOW_W_PASKU + 1);
  assert.equal(dalekie.length + bliskie.length, 5, "pasek nie traci celu dotyku — miejsce przechodzi dalej");
});

test("konto BEZ uprawnień modułowych: kotwice zostają, a modułem może być tylko taki bez sluga (AC-5)", () => {
  const { dalekie, bliskie } = pozycjePaska([], prefs(), true);

  assert.equal(dalekie[0]?.rodzaj, "dom");
  assert.deepEqual(bliskie.map((p) => p.rodzaj), ["ulubione", "historia"]);
  // Pusta lista uprawnień NIE znaczy „zero modułów": Raporty mają `permission: null` (dostępne
  // każdemu zalogowanemu), więc awaryjne uzupełnienie paska słusznie po nie sięga. Testujemy
  // regułę, a nie liczbę: w pasku nie może stanąć moduł, do którego konto nie ma dostępu.
  for (const pozycja of dalekie) {
    if (pozycja.rodzaj !== "modul") continue;
    assert.equal(pozycja.modul.permission, null, `moduł ${pozycja.modul.id} wymaga uprawnienia, którego konto nie ma`);
  }
});

test("`home` zapisany w preferencjach NIE produkuje drugiej ikony domu", () => {
  // Tak wyglądał domyślny pasek do run 100 włącznie, więc taką preferencję ma dziś zapisaną
  // każde konto, które nigdy nie ruszało ustawień.
  const { dalekie } = pozycjePaska(WSZYSTKIE, prefs({ tabBar: ["home", "tasks", "shopping"] }), true);
  assert.equal(dalekie.filter((p) => p.rodzaj === "dom").length, 1);
  assert.ok(
    !dalekie.some((p) => p.rodzaj === "modul" && p.modul.id === "home"),
    "Strona główna jest kotwicą, więc nie może wystąpić także jako pozycja modułowa",
  );
});

test("moduł bez uprawnienia nie trafia do paska, nawet gdy jest w preferencjach", () => {
  const bezZakupow = WSZYSTKIE.filter((p) => p !== "module.shopping");
  const { dalekie } = pozycjePaska(bezZakupow, prefs({ tabBar: ["shopping", "tasks", "notes"] }), true);
  assert.ok(!dalekie.some((p) => p.rodzaj === "modul" && p.modul.id === "shopping"));
});
