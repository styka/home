#!/usr/bin/env node
/**
 * Bramka ZAPADKI NIEOGRANICZONYCH ZAPYTAŃ (068, zadanie 20; rozdz. 11.4).
 *
 * Rozdz. 11.4 wymaga „paginacji kursorowej we wszystkich widokach listowych". W chwili pisania
 * tej bramki w akcjach modułów jest **122** wywołań `findMany` bez `take` — przepisanie ich
 * jednym przebiegiem to 122 niesprawdzone zmiany w zapytaniach, czyli dokładnie ten rodzaj
 * roboty, którego ta przebudowa unika.
 *
 * Ta bramka nie naprawia zastanego stanu. Robi coś, co można zrobić **dziś i tanio**:
 * **nie pozwala mu urosnąć**. Liczba nieograniczonych zapytań może maleć albo stać w miejscu;
 * każde nowe wywołanie `findMany` bez `take` wywala build.
 *
 * Dlaczego to ma sens mimo braku pełnego rozwiązania: zapytanie bez `take` zwraca **wszystko**,
 * a „wszystko" rośnie razem z kontem. Lista zadań po trzech latach używania to nie jest ten sam
 * obiekt, co lista z pierwszego tygodnia. Nowy kod nie ma powodu tego długu powiększać.
 *
 * Wzorzec jest zgrubny (tekstowy, nie AST) i **celowo**: ma być tani i przewidywalny. Fałszywy
 * alarm rozwiązuje się dopisaniem `take`, co i tak jest właściwym ruchem.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "src/platform/pagination-baseline.json");

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

/** Zgrubne wycięcie wywołania `findMany({ … })` i sprawdzenie, czy ma `take`. */
function policzBezTake(tresc) {
  let ile = 0;
  const re = /\.findMany\(\{/g;
  let m;
  while ((m = re.exec(tresc))) {
    const od = m.index;
    // Domknięcie szukamy po nawiasach klamrowych, licząc zagnieżdżenia — `where` z `OR` potrafi
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
    const frag = tresc.slice(od, koniec + 1);
    if (!/\btake\s*:/.test(frag)) ile++;
  }
  return ile;
}

/**
 * 093 (zadanie 20): PLIKI, KTÓRYCH ZAPYTANIA MUSZĄ BYĆ KOMPLETNE.
 *
 * Zapadka liczyła wszystko jednakowo i przez to mierzyła dwie różne rzeczy jedną liczbą. Eksport
 * danych z RODO **musi** zwrócić wszystko — to nie jest widok listowy, który da się doładować, i nie
 * jest dług do spłacenia. 55 z 261 zapytań w liczniku pochodziło stąd, więc próg mówił „mamy 261
 * list bez paginacji", co po prostu nie było prawdą; a spłata prawdziwego długu wyglądałaby na wolniejszą,
 * niż jest.
 *
 * Wyjątek jest per PLIK i wymaga powodu. Martwy wpis też wywala build — inaczej lista wyjątków
 * rosłaby jako wygodniejsza alternatywa dla paginacji.
 */
const wyjatkiPath = path.join(root, "src/platform/pagination-wyjatki.json");
const wyjatki = fs.existsSync(wyjatkiPath) ? JSON.parse(fs.readFileSync(wyjatkiPath, "utf8")).pliki ?? {} : {};

const katalogi = [path.join(root, "src/modules"), path.join(root, "src/actions"), path.join(root, "src/lib")];
let biezace = 0;
const rozklad = {};
const zwolnione = {};
const martweWyjatki = new Set(Object.keys(wyjatki));
for (const dir of katalogi) {
  if (!fs.existsSync(dir)) continue;
  for (const abs of pliki(dir)) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    const n = policzBezTake(fs.readFileSync(abs, "utf8"));
    if (n === 0) continue;
    if (wyjatki[rel]) {
      martweWyjatki.delete(rel);
      zwolnione[rel] = n;
      continue;
    }
    biezace += n;
    rozklad[rel] = n;
  }
}

if (martweWyjatki.size > 0) {
  console.error("\n✖ Paginacja: wyjątki dla plików, które nie mają już nieograniczonych zapytań:");
  for (const f of martweWyjatki) console.error(`  ${f}`);
  console.error(`\n  Usuń je z ${path.relative(root, wyjatkiPath)} — martwy wyjątek to zaproszenie do dopisania nowego.\n`);
  process.exit(1);
}

const baseline = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : null;

if (!baseline) {
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        _opis:
          "068 (zadanie 20): ZAPADKA. Liczba wywołań `findMany` bez `take` w akcjach modułów. Może MALEĆ, nigdy rosnąć. Nowe zapytanie listowe ma używać `platform/pagination.ts`. Gdy licznik spadnie, ZMNIEJSZ tę liczbę — inaczej zapadka przestaje trzymać.",
        maks: biezace,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`• Paginacja: zapisano punkt wyjścia zapadki (${biezace} zapytań bez \`take\`).`);
  process.exit(0);
}

if (biezace > baseline.maks) {
  const najwieksze = Object.entries(rozklad)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  console.error("\n✖ Paginacja: przybyło zapytań listowych BEZ `take`.\n");
  console.error(`  Było najwyżej ${baseline.maks}, jest ${biezace}.`);
  console.error("  Zapytanie bez `take` zwraca WSZYSTKO, a to rośnie razem z kontem.");
  console.error("  Nowa lista ma używać `@/platform/pagination` — kursor, `take` i doładowanie.\n");
  console.error("  Najwięcej nieograniczonych zapytań mają dziś:");
  for (const [f, n] of najwieksze) console.error(`    ${n}× ${f}`);
  console.error("");
  process.exit(1);
}

if (biezace < baseline.maks) {
  console.error(`\n✖ Paginacja: licznik SPADŁ (${baseline.maks} → ${biezace}) — i to dobrze.`);
  console.error(`  Zmniejsz \`maks\` w ${path.relative(root, manifestPath)} do ${biezace},`);
  console.error("  inaczej zapadka trzyma na starym poziomie i pozwoli dołożyć z powrotem.\n");
  process.exit(1);
}

const iloscZwolnionych = Object.values(zwolnione).reduce((a, b) => a + b, 0);
console.log(
  `✓ Paginacja: ${biezace} zapytań bez \`take\` — zapadka trzyma (bez wzrostu)` +
    (iloscZwolnionych > 0 ? `; ${iloscZwolnionych} w ${Object.keys(zwolnione).length} plikach ze świadomym wyjątkiem.` : "."),
);
