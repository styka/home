import { test } from "node:test";
import assert from "node:assert/strict";
import {
  poraRoku,
  terminCykliczny,
  terminPodlewania,
  PROG_OPADU_MM,
  PROG_PRZYMROZKU_C,
  PROG_UPALU_C,
  type PrognozaDobowa,
} from "../harmonogram";
import type { WymaganiaWodne } from "../../lib/typy";

const WYMAGANIA: WymaganiaWodne = { winter: 16, spring: 8, summer: 4, autumn: 12 };

const dzien = (over: Partial<PrognozaDobowa> = {}): PrognozaDobowa => ({
  date: "2026-07-01",
  precipSum: 0,
  tMin: 14,
  tMax: 22,
  ...over,
});

/** Ile pełnych dni dzieli dwie daty. */
const odstep = (od: Date, do_: Date) => Math.round((do_.getTime() - od.getTime()) / 86_400_000);

// ─── Pora roku ───────────────────────────────────────────────────────────────

test("pora roku liczona z daty, z grudniem po stronie zimy", () => {
  assert.equal(poraRoku(new Date("2026-01-15")), "winter");
  assert.equal(poraRoku(new Date("2026-04-15")), "spring");
  assert.equal(poraRoku(new Date("2026-07-15")), "summer");
  assert.equal(poraRoku(new Date("2026-10-15")), "autumn");
  assert.equal(poraRoku(new Date("2026-12-15")), "winter");
});

// ─── Cztery pory roku dają cztery różne odstępy ──────────────────────────────

test("odstęp podlewania wynika z pory roku, nie z jednej stałej gatunku", () => {
  const zima = terminPodlewania({ od: new Date("2026-01-10"), wymagania: WYMAGANIA });
  const wiosna = terminPodlewania({ od: new Date("2026-04-10"), wymagania: WYMAGANIA });
  const lato = terminPodlewania({ od: new Date("2026-07-10"), wymagania: WYMAGANIA });
  const jesien = terminPodlewania({ od: new Date("2026-10-10"), wymagania: WYMAGANIA });

  assert.equal(odstep(new Date("2026-01-10"), zima.termin), 16);
  assert.equal(odstep(new Date("2026-04-10"), wiosna.termin), 8);
  assert.equal(odstep(new Date("2026-07-10"), lato.termin), 4);
  assert.equal(odstep(new Date("2026-10-10"), jesien.termin), 12);
});

test("brak wymagań gatunku nie wywraca reguły — wchodzą wartości domyślne", () => {
  const wynik = terminPodlewania({ od: new Date("2026-07-10"), wymagania: null });
  assert.ok(odstep(new Date("2026-07-10"), wynik.termin) > 0);
  assert.match(wynik.uzasadnienie, /lato/);
});

// ─── Nasłonecznienie miejsca ─────────────────────────────────────────────────

test("stanowisko słoneczne skraca odstęp, zacienione wydłuża, półcień nie zmienia", () => {
  const od = new Date("2026-04-10");
  const slonce = terminPodlewania({ od, wymagania: WYMAGANIA, naslonecznienie: "full" });
  const polcien = terminPodlewania({ od, wymagania: WYMAGANIA, naslonecznienie: "partial" });
  const cien = terminPodlewania({ od, wymagania: WYMAGANIA, naslonecznienie: "shade" });

  assert.equal(odstep(od, slonce.termin), 6); // 8 × 0,8
  assert.equal(odstep(od, polcien.termin), 8);
  assert.equal(odstep(od, cien.termin), 10); // 8 × 1,25
  assert.match(slonce.uzasadnienie, /słoneczne/);
  assert.match(cien.uzasadnienie, /zacienione/);
});

test("nieznane nasłonecznienie zachowuje się jak półcień, a nie jak brak reguły", () => {
  const od = new Date("2026-04-10");
  const nieznane = terminPodlewania({ od, wymagania: WYMAGANIA, naslonecznienie: "unknown" });
  assert.equal(odstep(od, nieznane.termin), 8);
});

// ─── Pogoda: deszcz i upał ───────────────────────────────────────────────────

test("zapowiadany opad odsuwa termin i mówi o tym w uzasadnieniu", () => {
  const od = new Date("2026-04-10");
  const bez = terminPodlewania({ od, wymagania: WYMAGANIA });
  const zDeszczem = terminPodlewania({
    od,
    wymagania: WYMAGANIA,
    prognoza: [dzien({ precipSum: PROG_OPADU_MM + 3 })],
  });

  assert.ok(zDeszczem.termin.getTime() > bez.termin.getTime());
  assert.match(zDeszczem.uzasadnienie, /opad/);
});

test("mżawka poniżej progu NIE odsuwa terminu — zwilża liście, nie glebę", () => {
  const od = new Date("2026-04-10");
  const bez = terminPodlewania({ od, wymagania: WYMAGANIA });
  const mzawka = terminPodlewania({
    od,
    wymagania: WYMAGANIA,
    prognoza: [dzien({ precipSum: PROG_OPADU_MM - 1 })],
  });
  assert.equal(mzawka.termin.getTime(), bez.termin.getTime());
});

test("deszcz nie podleje rośliny stojącej pod dachem", () => {
  const od = new Date("2026-04-10");
  const bez = terminPodlewania({ od, wymagania: WYMAGANIA });
  const wMieszkaniu = terminPodlewania({
    od,
    wymagania: WYMAGANIA,
    podDachem: true,
    prognoza: [dzien({ precipSum: 30 })],
  });
  assert.equal(wMieszkaniu.termin.getTime(), bez.termin.getTime());
  assert.doesNotMatch(wMieszkaniu.uzasadnienie, /opad/);
});

test("dwa dni upału skracają odstęp; jeden dzień to za mało, żeby zmieniać plan", () => {
  const od = new Date("2026-07-10");
  const goraco = dzien({ tMax: PROG_UPALU_C + 4 });
  const chlodno = dzien({ tMax: 20 });

  const bez = terminPodlewania({ od, wymagania: WYMAGANIA, prognoza: [goraco, chlodno, chlodno, chlodno] });
  const upal = terminPodlewania({ od, wymagania: WYMAGANIA, prognoza: [goraco, goraco, goraco, goraco] });

  assert.equal(odstep(od, bez.termin), 4);
  assert.equal(odstep(od, upal.termin), 3); // 4 × 0,75
  assert.match(upal.uzasadnienie, /upał/);
});

// ─── Ostrzeżenie o przymrozku ────────────────────────────────────────────────

test("przymrozek w prognozie daje ostrzeżenie, ale nie zmienia terminu", () => {
  const od = new Date("2026-04-10");
  const bez = terminPodlewania({ od, wymagania: WYMAGANIA });
  const mroz = terminPodlewania({
    od,
    wymagania: WYMAGANIA,
    prognoza: [dzien({ date: "2026-04-12", tMin: PROG_PRZYMROZKU_C - 3 })],
  });

  assert.equal(mroz.termin.getTime(), bez.termin.getTime());
  assert.equal(bez.ostrzezenie, null);
  assert.match(String(mroz.ostrzezenie), /Przymrozek 2026-04-12/);
});

// ─── Uzasadnienie ────────────────────────────────────────────────────────────

test("uzasadnienie zawsze istnieje i nie podaje powodu, który nie zadziałał", () => {
  const od = new Date("2026-01-10");
  const wynik = terminPodlewania({ od, wymagania: WYMAGANIA });
  assert.ok(wynik.uzasadnienie.length > 0);
  // Bez prognozy uzasadnienie nie ma prawa mówić o pogodzie — zdanie z nieprawdziwym powodem
  // jest gorsze niż brak zdania.
  assert.doesNotMatch(wynik.uzasadnienie, /opad|upał/);
});

// ─── Zabieg cykliczny ────────────────────────────────────────────────────────

test("zabieg cykliczny liczy się od faktycznego wykonania i nie skraca się od pogody", () => {
  const od = new Date("2026-07-10");
  const wynik = terminCykliczny(od, 14, { prognoza: [dzien({ tMax: 35 }), dzien({ tMax: 35 })] });
  assert.equal(odstep(od, wynik.termin), 14);
  assert.match(wynik.uzasadnienie, /co 14 dni/);
});

test("zabieg cykliczny zachowuje ostrzeżenie o przymrozku", () => {
  const wynik = terminCykliczny(new Date("2026-04-10"), 14, {
    prognoza: [dzien({ date: "2026-04-11", tMin: -2 })],
  });
  assert.match(String(wynik.ostrzezenie), /Przymrozek/);
});

test("odstęp nigdy nie schodzi do zera ani poniżej", () => {
  const od = new Date("2026-07-10");
  const wynik = terminPodlewania({
    od,
    wymagania: { winter: 1, spring: 1, summer: 1, autumn: 1 },
    naslonecznienie: "full",
    prognoza: [dzien({ tMax: 40 }), dzien({ tMax: 40 })],
  });
  assert.ok(wynik.termin.getTime() > od.getTime());
  assert.equal(odstep(od, terminCykliczny(od, 0).termin), 1);
});
