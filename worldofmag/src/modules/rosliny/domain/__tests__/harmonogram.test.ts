import { test } from "node:test";
import assert from "node:assert/strict";
import {
  poraRoku,
  terminDoZapisu,
  terminCykliczny,
  terminPodlewania,
  PROG_OPADU_MM,
  PROG_PRZYMROZKU_C,
  PROG_UPALU_C,
  type PrognozaDobowa,
} from "../harmonogram";
import fs from "node:fs";
import path from "node:path";
import { czytajWymaganiaWodne } from "../agenda";
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

// ─── Zero w wymaganiach wodnych = pora bez cyklu podlewania ──────────────────

test("gatunek z zerem w tej porze dostaje datę WZNOWIENIA, a nie odstęp z zapasu", () => {
  // Pomidor w styczniu. Wcześniej dostawał tu „podlej za 14 dni” — odstęp wzięty z wartości
  // domyślnych, bo zero traktowano jak brak danych.
  const od = new Date("2026-01-10");
  const wynik = terminPodlewania({ od, wymagania: { winter: 0, spring: 4, summer: 3, autumn: 5 } });

  // NIE pomijamy: data jest prawdziwa, więc zadanie ma powstać i po prostu czekać do marca.
  // Pomijanie w tym miejscu sprawiało, że 125 ze 182 wpisów katalogu nie dostawało zadania nigdy.
  assert.equal(wynik.pomijac, false);
  // Wznawiamy z początkiem wiosny, a nie „za 14 dni”.
  assert.equal(wynik.termin.getFullYear(), 2026);
  assert.equal(wynik.termin.getMonth(), 2);
  assert.match(wynik.uzasadnienie, /nie jest teraz podlewany/);
  assert.match(wynik.uzasadnienie, /wiosn/);
});

test("po jesieni z zerem wznowienie przechodzi na wiosnę NASTĘPNEGO roku", () => {
  const wynik = terminPodlewania({
    od: new Date("2026-10-05"),
    wymagania: { winter: 0, spring: 4, summer: 3, autumn: 0 },
  });
  assert.equal(wynik.pomijac, false);
  assert.equal(wynik.termin.getFullYear(), 2027);
  assert.equal(wynik.termin.getMonth(), 2);
});

test("gatunek bez cyklu w żadnej porze mówi to wprost, zamiast wskazywać pustą porę", () => {
  // Zboża i uprawy polowe: 20 wpisów katalogu ma zera we wszystkich czterech porach.
  const wynik = terminPodlewania({
    od: new Date("2026-05-10"),
    wymagania: { winter: 0, spring: 0, summer: 0, autumn: 0 },
  });
  assert.equal(wynik.pomijac, true);
  assert.match(wynik.uzasadnienie, /decyzją agrotechniczną/);
});

test("normalny odstęp nie jest oznaczany do pominięcia", () => {
  assert.equal(terminPodlewania({ od: new Date("2026-07-10"), wymagania: WYMAGANIA }).pomijac, false);
  assert.equal(terminCykliczny(new Date("2026-07-10"), 14).pomijac, false);
});

test("ostrzeżenie o przymrozku przechodzi także wtedy, gdy w tej porze nie podlewamy", () => {
  const wynik = terminPodlewania({
    od: new Date("2026-01-10"),
    wymagania: { winter: 0, spring: 4, summer: 3, autumn: 5 },
    prognoza: [dzien({ date: "2026-01-11", tMin: -6 })],
  });
  assert.match(String(wynik.ostrzezenie), /Przymrozek/);
});

test("każdy wpis katalogu z zerem W CZĘŚCI pór ma prawdziwą datę, a nie pominięcie", () => {
  // Rozdzielenie dwóch przypadków: pomijamy WYŁĄCZNIE gatunek bez cyklu w żadnej porze.
  const warzywo = { winter: 0, spring: 4, summer: 3, autumn: 5 };
  for (const miesiac of [0, 4, 6, 9]) {
    const od = new Date(2026, miesiac, 10);
    const w = terminPodlewania({ od, wymagania: warzywo });
    assert.equal(w.pomijac, false, `miesiąc ${miesiac}: warzywo nie może być pomijane`);
    assert.ok(w.termin.getTime() > od.getTime());
  }
});

// ─── Reguła kontra dane z migracji ───────────────────────────────────────────

test("każdy wpis katalogu z migracji 0273 daje albo dodatni odstęp, albo jawne pominięcie", () => {
  // Test celowo czyta DANE Z MIGRACJI zamiast powtarzać je w stałej: gdyby ktoś dopisał do katalogu
  // gatunek z zerem, a reguła wróciła do podstawiania wartości domyślnej, ten test padnie — a wersja
  // z własną tablicą przypadków przeszłaby, bo sprawdzałaby wyłącznie samą siebie.
  const sql = fs.readFileSync(
    path.join(process.cwd(), "prisma/migrations/0273_katalog_gatunkow/migration.sql"),
    "utf8",
  );
  const wpisy = sql.match(/\{"winter":[^}]*\}/g) ?? [];
  assert.ok(wpisy.length > 100, `katalog powinien mieć komplet wpisów, znaleziono ${wpisy.length}`);

  let pominiete = 0;
  for (const wpis of wpisy) {
    const wymagania = czytajWymaganiaWodne(wpis);
    for (const miesiac of [0, 4, 6, 9]) {
      const od = new Date(2026, miesiac, 10);
      const wynik = terminPodlewania({ od, wymagania });
      if (wynik.pomijac) {
        pominiete++;
        // Nawet pomijając, oddajemy datę w przyszłości — inaczej agenda pokazałaby zaległość.
        assert.ok(wynik.termin.getTime() > od.getTime(), `${wpis}: termin wznowienia musi być w przyszłości`);
      } else {
        assert.ok(wynik.termin.getTime() > od.getTime(), `${wpis}: termin musi być w przyszłości`);
      }
    }
  }

  // Pominięte to WYŁĄCZNIE gatunki bez cyklu w żadnej porze (zboża, uprawy polowe — 20 wpisów).
  // Gdyby ich zabrakło, ten test straciłby sens; gdyby było ich dużo więcej, znaczyłoby to, że
  // rozdzielenie dwóch przypadków znów się zlało w jeden.
  assert.ok(pominiete > 0, "katalog powinien zawierać gatunki bez cyklu podlewania w ogóle");
  assert.ok(pominiete < wpisy.length * 4 * 0.3, "za dużo pominięć — zero w JEDNEJ porze nie jest brakiem cyklu");
});

// ─── Co trafia do zadania opieki ─────────────────────────────────────────────

test("gatunek bez cyklu nie dostaje daty ani przy zakładaniu zadania, ani przy odhaczeniu", () => {
  // Trzy miejsca piszą `nextDueAt` i warunek zdążył się już raz zgubić w jednym z nich: po
  // odhaczeniu podlewania pszenicy zadanie dostawało z powrotem „dziś + 30 dni" z uzasadnieniem
  // „ten gatunek nie ma cyklu podlewania". Reguła zapisu ma więc własny test.
  const bezCyklu = terminPodlewania({
    od: new Date("2026-05-10"),
    wymagania: { winter: 0, spring: 0, summer: 0, autumn: 0 },
  });
  const zapis = terminDoZapisu(bezCyklu);
  assert.equal(zapis.nextDueAt, null);
  // Uzasadnienie zapisujemy ZAWSZE — bez terminu jest jedyną odpowiedzią na „czemu bez daty".
  assert.match(zapis.reason, /decyzją agrotechniczną/);
});

test("zwykły termin zapisuje się razem ze swoim uzasadnieniem", () => {
  const wynik = terminPodlewania({ od: new Date("2026-07-10"), wymagania: WYMAGANIA });
  const zapis = terminDoZapisu(wynik);
  assert.equal(zapis.nextDueAt?.getTime(), wynik.termin.getTime());
  assert.equal(zapis.reason, wynik.uzasadnienie);
});

test("zero w JEDNEJ porze to nadal data do zapisania, a nie brak terminu", () => {
  const zapis = terminDoZapisu(
    terminPodlewania({ od: new Date("2026-01-10"), wymagania: { winter: 0, spring: 4, summer: 3, autumn: 5 } }),
  );
  assert.ok(zapis.nextDueAt instanceof Date, "pomidor w styczniu musi dostać datę wznowienia");
  assert.match(zapis.reason, /wiosnę/);
});
