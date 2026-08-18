#!/usr/bin/env node
/**
 * Bramka ZAPYTAŃ LISTOWYCH BEZ GRANICY (068 → 095, zadanie 20; rozdz. 11.4).
 *
 * Rozdz. 11.4 wymaga „paginacji kursorowej we wszystkich widokach listowych". Powód jest prostszy
 * niż wydajność zapytania: **zapytanie bez `take` zwraca wszystko**, a „wszystko" rośnie razem
 * z kontem. Lista zadań osoby, która używa Omnii od trzech lat, to nie jest ten sam obiekt, co
 * lista z pierwszego tygodnia.
 *
 * **095 — to przestała być zapadka, a stała się regułą.** Do 095 bramka tylko nie pozwalała długowi
 * rosnąć (próg 207) i to była uczciwa decyzja na tamten moment: przepisanie dwustu zapytań jednym
 * przebiegiem to dwieście niesprawdzonych zmian. Zapadka miała jednak dwie wady, które ujawniły się
 * dopiero przy sprawdzaniu specyfikacją:
 *
 *   1. **Nie odróżniała długu od rzeczy z natury ograniczonych.** Zapytanie o wiersze jednego
 *      rodzica albo o jeden miesiąc nie jest „widokiem listowym bez paginacji" — a w liczniku
 *      wyglądało tak samo jak lista zadań konta z trzyletnią historią.
 *   2. **Nie widziała spłaty.** Zapytanie spaginowane przez `zapytanieKursorowe(...)` wnosi `take`
 *      spreadem, więc wzorzec `take:` go nie wykrywał i poprawnie spaginowana lista dalej liczyła
 *      się jako dług. Trudno o gorszą zachętę.
 *
 * Dziś każde `findMany` musi mieć **jawną granicę** — jedną z trzech:
 *
 *   • `take: …` — sufit albo rozmiar strony;
 *   • `...zapytanieKursorowe({ kursor, rozmiar })` — prawdziwa paginacja kursorowa;
 *   • **znacznik `paginacja: kompletny — <powód>`** w komentarzu tuż nad wywołaniem — dla zapytań,
 *     w których niepełny wynik byłby BŁĘDEM, a nie wolniejszym ekranem: sumy, statystyki, stany
 *     magazynowe liczone z partii, wartości decydujące o dostępie.
 *
 * **Dlaczego znacznik w kodzie, a nie wpis w manifeście.** Manifest jest per PLIK, a pliki bywają
 * mieszane: `portfelReports.ts` ma i listę do pokazania, i sumę do policzenia. Poza tym powód
 * czytany przy zapytaniu jest powodem widocznym w diffie; powód w osobnym pliku to powód, którego
 * recenzent nie zobaczy. Manifest zostaje dla dwóch plików RODO, gdzie kompletny musi być **każdy**
 * odczyt w pliku i wyliczanie ich pojedynczo byłoby szumem.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const wyjatkiPath = path.join(root, "src/platform/pagination-wyjatki.json");
const ZNACZNIK = /paginacja:\s*kompletny\s*[—-]\s*\S/;

function pliki(dir, out = []) {
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) {
      if (w.name === "node_modules" || w.name === "generated" || w.name === "__tests__") continue;
      pliki(p, out);
    } else if (/\.ts$/.test(w.name)) out.push(p);
  }
  return out;
}

/**
 * Komentarze → spacje tej samej długości. Treść znika, przesunięcia zostają, więc numery linii
 * i granice nawiasów dalej się zgadzają. Bez tego bramka żądała granicy dla `findMany` stojącego
 * w PRZYKŁADZIE UŻYCIA w komentarzu (`platform/auth/ownership.ts`) — czyli oskarżała dokumentację.
 * Znacznik „kompletny" czytamy z treści ORYGINALNEJ, bo on z definicji jest komentarzem.
 */
function bezKomentarzy(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

/** Wywołania `findMany({ … })` w pliku: pozycja, treść argumentu, numer linii. */
function wywolania(tresc) {
  const out = [];
  const re = /\.findMany\(\{/g;
  let m;
  while ((m = re.exec(tresc))) {
    const od = m.index;
    // Domknięcia szukamy po nawiasach klamrowych, licząc zagnieżdżenia — `where` z `OR` potrafi
    // mieć ich kilka poziomów, a szukanie pierwszego „});" ucięłoby wywołanie w połowie.
    let poziom = 0;
    let koniec = od;
    for (let i = od + ".findMany(".length; i < tresc.length; i++) {
      const c = tresc[i];
      if (c === "{") poziom++;
      else if (c === "}") {
        poziom--;
        if (poziom === 0) {
          koniec = i;
          break;
        }
      }
    }
    out.push({ od, frag: tresc.slice(od, koniec + 1), linia: tresc.slice(0, od).split("\n").length });
  }
  return out;
}

/** Czy nad wywołaniem stoi znacznik „wynik musi być kompletny" (do 4 linii wyżej). */
function maZnacznik(linie, nrLinii) {
  for (let i = Math.max(0, nrLinii - 5); i < nrLinii; i++) {
    if (ZNACZNIK.test(linie[i] ?? "")) return true;
  }
  return false;
}

const wyjatki = fs.existsSync(wyjatkiPath) ? JSON.parse(fs.readFileSync(wyjatkiPath, "utf8")).pliki ?? {} : {};
const katalogi = [path.join(root, "src/modules"), path.join(root, "src/actions"), path.join(root, "src/lib"), path.join(root, "src/platform")];

const bledy = [];
const martweWyjatki = new Set(Object.keys(wyjatki));
let zTake = 0;
let zKursorem = 0;
let kompletnych = 0;
let wPlikachRODO = 0;

for (const dir of katalogi) {
  if (!fs.existsSync(dir)) continue;
  for (const abs of pliki(dir)) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    const tresc = fs.readFileSync(abs, "utf8");
    const linie = tresc.split("\n");
    const lista = wywolania(bezKomentarzy(tresc));
    if (lista.length === 0) continue;

    if (wyjatki[rel]) {
      martweWyjatki.delete(rel);
      wPlikachRODO += lista.length;
      continue;
    }

    for (const { frag, linia } of lista) {
      if (/zapytanieKursorowe\s*\(/.test(frag)) {
        zKursorem++;
      } else if (/\btake\s*:/.test(frag)) {
        zTake++;
      } else if (maZnacznik(linie, linia - 1)) {
        kompletnych++;
      } else {
        bledy.push(
          `${rel}:${linia} — \`findMany\` bez granicy. Dodaj \`take\` (sufit \`SUFIT_LISTY\`), ` +
            `\`...zapytanieKursorowe({ kursor, rozmiar })\` albo — jeśli niepełny wynik byłby BŁĘDEM ` +
            `(suma, statystyka, decyzja o dostępie) — komentarz \`paginacja: kompletny — <powód>\`.`,
        );
      }
    }
  }
}

if (martweWyjatki.size > 0) {
  for (const f of martweWyjatki) {
    bledy.push(`${f} — martwy wpis w ${path.relative(root, wyjatkiPath)}: plik nie ma już zapytań listowych. Usuń go.`);
  }
}

if (bledy.length) {
  console.error("\n✖ Paginacja: zapytania listowe bez jawnej granicy.\n");
  for (const b of bledy) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Paginacja: każde \`findMany\` ma granicę — ${zKursorem} kursorowych, ${zTake} z sufitem, ` +
    `${kompletnych} świadomie kompletnych, ${wPlikachRODO} w 2 plikach RODO.`,
);
