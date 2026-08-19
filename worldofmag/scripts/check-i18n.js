#!/usr/bin/env node
/**
 * Bramka TEKSTÓW ZASZYTYCH W KOMPONENTACH (089 → 097, zadanie 35; rozdz. 12.1).
 *
 * Rozdz. 12.1 stawia jeden sygnał kontrolny: **„jeśli dodanie języka to praca tłumacza, a nie
 * programisty — cel osiągnięty"**. Tłumacz pracuje na `messages/pl.json`; wszystko, co zostało
 * w komponencie, jest poza jego zasięgiem.
 *
 * **097 — to przestała być zapadka, a stała się regułą.** Do 097 bramka pilnowała tylko, żeby próg
 * (1416) nie rósł. To była uczciwa decyzja na tamten moment — koszt wyciągnięcia rośnie z każdym
 * tygodniem, więc zatrzymanie wzrostu było tańsze niż jednorazowy przebieg. Miała jednak wadę,
 * której nie widać z zewnątrz: **próg nie odpowiadał na pytanie kontrolne**. Przy 1416 literałach
 * odpowiedź brzmiała „nie" tak samo jak przy 1528.
 *
 * ### Co bramka liczy i dlaczego akurat to
 *
 * Tylko to, co użytkownik ZOBACZY: tekst między znacznikami oraz napisy w atrybutach trafiających
 * na ekran (`placeholder`, `title`, `aria-label`, `alt`, `label`). Rozpoznajemy je po polskich
 * znakach diakrytycznych — kryterium niedoskonałe („Zapisz", „Anuluj" ich nie mają), ale **stabilne
 * i bez fałszywych alarmów**. To jest cecha ważniejsza: bramka, która co drugi build oskarża
 * niewinny plik, zostaje wyłączona.
 *
 * ### Cztery odsiewy, każdy dopisany po fałszywym alarmie
 *
 * Pierwsza wersja detektora brała `>…<` i `atrybut\\s*=\\s*"…"` dosłownie i myliła się na cztery
 * sposoby, z których każdy zawyżał licznik o rzeczy niebędące tekstem interfejsu:
 *
 *   1. **Strzałka funkcji.** `=> (` wygląda jak zamknięcie znacznika. Odsiew: znak przed `>` nie
 *      może być `=` ani `-`.
 *   2. **Generyk TypeScriptu.** `useState<string>(item?.qty ?? "")` wygląda jak tekst między
 *      znacznikami. Odsiew: sygnatury kodu w treści (`"`, `` ` ``, `=>`, `??`, `?.`, `${`, `const`).
 *   3. **Literał tekstowy.** `"<strong>Lista zadań</strong> — …"` w tablicy propsów. Odsiew:
 *      nieparzysta liczba cudzysłowów przed trafieniem w tej samej linii.
 *   4. **Przypisanie do zmiennej.** `label = "Synchronizuję…"` to nie atrybut JSX. Odsiew: atrybut
 *      musi być pisany bez spacji wokół `=`, tak jak wymaga tego składnia JSX.
 *
 * ### Wyjątki
 *
 * `src/lib/ui/i18n-wyjatki.json` — per PLIK, z powodem. Dostaje go miejsce, w którym `t()` nie ma
 * jak zadziałać (wartość liczona na poziomie modułu, przed wejściem do komponentu) albo w którym
 * tekst jest **treścią przykładu**, a nie interfejsem produktu. Martwy wpis wywala build.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const wyjatkiPath = path.join(root, "src/lib/ui/i18n-wyjatki.json");
const POLSKIE = /[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/;
const ATRYBUTY = ["placeholder", "title", "aria-label", "alt", "label"];
/** Ślady kodu w treści — jeżeli jest którykolwiek, to nie jest zdanie z interfejsu. */
const SLADY_KODU = /["`]|=>|\?\?|\?\.|\$\{|\)\s*;|\]\s*=|\bconst\b|\breturn\b|\bfunction\b/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["generated", "node_modules", "__tests__"].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Usuwa komentarze, zachowując długość — inaczej liczylibyśmy uzasadnienia decyzji. */
function bezKomentarzy(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

/**
 * Mapa pozycji leżących WEWNĄTRZ literału tekstowego.
 *
 * Pierwsza wersja liczyła parzystość cudzysłowów od początku linii i myliła się na literale
 * szablonowym zawierającym cudzysłów — `` `Usunąć kontakt „${nazwa}"?` `` psuł parzystość dla całej
 * reszty linii, więc bramka przestawała widzieć teksty stojące dalej. Skaner jest dokładny: zna
 * trzy rodzaje ogranicznika i znaki ucieczki, a stan `"`/`'` zeruje na końcu linii, bo te literały
 * nie przechodzą przez nową linię (szablonowy przechodzi i dlatego jego stan jest niesiony dalej).
 */
function mapaStringow(kod) {
  const w = new Uint8Array(kod.length);
  let ogranicznik = null;
  for (let i = 0; i < kod.length; i++) {
    const c = kod[i];
    if (ogranicznik) {
      w[i] = 1;
      if (c === "\\") { i++; if (i < kod.length) w[i] = 1; continue; }
      if (c === ogranicznik) { ogranicznik = null; continue; }
      if (c === "\n" && ogranicznik !== "`") { ogranicznik = null; }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { ogranicznik = c; w[i] = 1; }
  }
  return w;
}

function znajdz(tresc) {
  const kod = bezKomentarzy(tresc);
  const wStringu = mapaStringow(kod);
  const out = [];

  for (const m of kod.matchAll(/>([^<>{}]{2,})<(\/|[A-Za-z])/g)) {
    const tekst = m[1];
    if (!POLSKIE.test(tekst) || !tekst.trim()) continue;
    if (SLADY_KODU.test(tekst)) continue;
    const przed = /(\S)\s*$/.exec(kod.slice(Math.max(0, m.index - 200), m.index));
    if (!przed || przed[1] === "=" || przed[1] === "-") continue;
    if (wStringu[m.index + 1]) continue;
    out.push({ linia: kod.slice(0, m.index).split("\n").length, tekst: tekst.trim() });
  }

  for (const atrybut of ATRYBUTY) {
    // `(?<![-\w])`, nie `\b`: w `aria-label` przed „label" stoi łącznik, który JEST granicą słowa,
    // więc wzorzec z `\b` liczył każdy `aria-label` dwa razy. BEZ spacji wokół `=` — tak wygląda
    // atrybut JSX; `label = "x"` to przypisanie do zmiennej i nie należy do tej listy.
    const re = new RegExp(`(?<![-\\w])${atrybut}="([^"]{2,})"`, "g");
    for (const m of kod.matchAll(re)) {
      if (!POLSKIE.test(m[1])) continue;
      if (wStringu[m.index]) continue;
      out.push({ linia: kod.slice(0, m.index).split("\n").length, tekst: m[1] });
    }
  }
  return out;
}

/**
 * KAŻDY KLUCZ MUSI ISTNIEĆ W SŁOWNIKU.
 *
 * Wyciągnięcie 1300 tekstów jednym przebiegiem ma jeden groźny tryb awarii: `t("klucz")` wskazujący
 * na klucz, którego w `messages/pl.json` nie ma. `tsc` tego nie widzi, build przechodzi, a użytkownik
 * dostaje w interfejsie surową nazwę klucza — i to zwykle na ekranie, na który nikt nie zajrzał.
 * Dlatego bramka rozwiązuje każde wywołanie: czyta przestrzeń z `const X = useTranslations("…")`
 * i sprawdza, czy `przestrzeń.klucz` istnieje.
 */
const komunikaty = JSON.parse(fs.readFileSync(path.join(root, "messages/pl.json"), "utf8"));
function maKlucz(sciezka) {
  let k = komunikaty;
  for (const czesc of sciezka.split(".")) {
    if (typeof k !== "object" || k === null || !(czesc in k)) return false;
    k = k[czesc];
  }
  return typeof k === "string";
}
function sprawdzKlucze(rel, tresc, bledy) {
  const kod = bezKomentarzy(tresc);
  // Deklaracje z POZYCJĄ, nie mapa nazwa→przestrzeń: w jednym pliku bywa kilka komponentów i każdy
  // ma własne `const t = useTranslations("…")` pod tą samą nazwą. Mapa zapamiętywała ostatnią
  // i sprawdzała klucze wcześniejszych komponentów w cudzej przestrzeni.
  const deklaracje = [...kod.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]*)"\s*\)/g)]
    .map((m) => ({ zmienna: m[1], ns: m[2], poz: m.index }));
  if (deklaracje.length === 0) return;
  const nazwy = [...new Set(deklaracje.map((d) => d.zmienna))];
  for (const zmienna of nazwy) {
    const re = new RegExp(`(?<![\\w$.])${zmienna}\\(\\s*"([^"]+)"`, "g");
    for (const m of kod.matchAll(re)) {
      const d = deklaracje.filter((d) => d.zmienna === zmienna && d.poz < m.index).pop();
      if (!d) continue;
      const pelny = d.ns ? `${d.ns}.${m[1]}` : m[1];
      if (!maKlucz(pelny)) {
        bledy.push(`${rel}:${kod.slice(0, m.index).split("\n").length} — brak klucza \`${pelny}\` w messages/pl.json.`);
      }
    }
  }
}

const wyjatki = fs.existsSync(wyjatkiPath) ? JSON.parse(fs.readFileSync(wyjatkiPath, "utf8")).pliki ?? {} : {};
const martwe = new Set(Object.keys(wyjatki));
const bledy = [];
let wWyjatkach = 0;

for (const file of walk(path.join(root, "src"))) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const tresc = fs.readFileSync(file, "utf8");
  sprawdzKlucze(rel, tresc, bledy);
  const trafienia = znajdz(tresc);
  if (!trafienia.length) continue;
  if (wyjatki[rel]) {
    martwe.delete(rel);
    wWyjatkach += trafienia.length;
    continue;
  }
  for (const t of trafienia) {
    bledy.push(`${rel}:${t.linia} — „${t.tekst.slice(0, 60)}” zaszyte w komponencie. Przenieś do messages/pl.json i wołaj przez t().`);
  }
}
for (const f of martwe) {
  bledy.push(`${f} — martwy wpis w ${path.relative(root, wyjatkiPath)}: plik nie ma już zaszytych tekstów. Usuń go.`);
}

if (bledy.length) {
  console.error("\n✖ i18n: teksty interfejsu zaszyte w komponentach.\n");
  for (const b of bledy.slice(0, 40)) console.error(`  • ${b}`);
  if (bledy.length > 40) console.error(`  … i ${bledy.length - 40} więcej`);
  console.error("");
  process.exit(1);
}

console.log(`✓ i18n: zero tekstów zaszytych w komponentach (${wWyjatkach} w plikach ze świadomym wyjątkiem).`);
