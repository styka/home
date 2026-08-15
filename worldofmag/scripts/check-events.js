#!/usr/bin/env node
/**
 * Bramka ZDARZEŃ DOMENOWYCH (070, zadanie 21; rozdz. 9.4).
 *
 * Rozdz. 9.4.2 nazywa zapis zdarzenia poza transakcją **najczęstszym błędem przy wdrażaniu
 * outboxu** — i jest to błąd, który **nie daje żadnego objawu**: przy awarii między zapisem stanu
 * a zapisem zdarzenia jedno i drugie się rozjeżdża, a jedynym śladem jest reakcja, która nigdy nie
 * nastąpiła. Nie ma wyjątku, nie ma logu, nie ma czerwonego testu.
 *
 * Sygnatura `emitDomainEvent(tx, …)` odrzuca globalnego klienta już na etapie kompilacji
 * (`Prisma.TransactionClient & { $transaction?: never }` — sprawdzone sondą w obie strony), ale
 * typ da się obejść rzutowaniem albo zapisem wprost do tabeli, a przede wszystkim **nie widzi**
 * rzeczy, które ta bramka widzi: czy emisja leży w TEJ SAMEJ transakcji co mutacja i czy nie
 * siedzi w pętli tam, gdzie zadeklarowano jedno zdarzenie na operację.
 *
 * Pięć kontroli:
 *   1. EMISJA TYLKO Z TRANSAKCJI — wewnątrz `$transaction(async (tx) => …)`, z tym samym `tx`.
 *   2. ZAPIS TYLKO PRZEZ EMISJĘ — `domainEvent.create` poza `platform/events/emit.ts` = błąd.
 *   3. REJESTR RODZAJÓW KOMPLETNY — każdy emitowany `type` jest w unii `DomainEventType`.
 *   4. MANIFEST W OBIE STRONY — producent bez wpisu i wpis bez producenta.
 *   5. ŁADUNEK ZGODNY Z DEKLARACJĄ — producent `zbiorczy` nie emituje z wnętrza pętli.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "src/lib/events-coverage.json");
const emitPath = "src/platform/events/emit.ts";
const typesPath = path.join(root, "src/platform/events/types.ts");

const bledy = [];

function plikiTs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) {
      if (w.name === "node_modules" || w.name === "generated") continue;
      plikiTs(p, out);
    } else if (/\.tsx?$/.test(w.name)) out.push(p);
  }
  return out;
}

/** Domknięcie bloku od `otwarcie` (indeks znaku `{`), liczone po zagnieżdżeniu klamr. */
function koniecBloku(tresc, otwarcie) {
  let glebokosc = 1;
  let i = otwarcie + 1;
  while (i < tresc.length && glebokosc > 0) {
    const ch = tresc[i];
    if (ch === "{") glebokosc += 1;
    else if (ch === "}") glebokosc -= 1;
    i += 1;
  }
  return i;
}

/**
 * Nazwa klienta transakcyjnego, jeśli pozycja `idx` leży wewnątrz `$transaction(async (tx) => …)`.
 * Zgrubnie i tekstowo, jak `check-pagination.js` — ma być tanie i przewidywalne.
 */
function wewnatrzTransakcji(tresc, idx) {
  const re = /\$transaction\(\s*async\s*\(\s*(\w+)\s*\)\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(tresc))) {
    const otwarcie = m.index + m[0].length - 1;
    if (otwarcie > idx) break;
    if (idx < koniecBloku(tresc, otwarcie)) return m[1];
  }
  return null;
}

/** Czy pozycja `idx` leży wewnątrz pętli (`for` / `while` / `.map(` / `.forEach(`). */
function wewnatrzPetli(tresc, idx) {
  const re = /\b(for|while)\s*\(|\.(map|forEach)\(/g;
  let m;
  while ((m = re.exec(tresc))) {
    const otwarcie = tresc.indexOf("{", m.index);
    if (otwarcie === -1 || otwarcie > idx) continue;
    if (idx < koniecBloku(tresc, otwarcie)) return true;
  }
  return false;
}

const wszystkie = plikiTs(path.join(root, "src"));

// ─── Kontrole 1, 3 i 5: emisja ──────────────────────────────────────────────

const producenci = new Set();
const uzyteRodzaje = new Set();
const emitujeWPetli = new Set();

for (const plik of wszystkie) {
  const wzgl = path.relative(root, plik).split(path.sep).join("/");
  if (wzgl === emitPath) continue;
  const tresc = fs.readFileSync(plik, "utf8");
  if (!tresc.includes("emitDomainEvent(")) continue;

  const re = /emitDomainEvent\(\s*(\w+)/g;
  let m;
  while ((m = re.exec(tresc))) {
    const klient = m[1];
    const txNazwa = wewnatrzTransakcji(tresc, m.index);
    const linia = tresc.slice(0, m.index).split("\n").length;

    if (!txNazwa) {
      bledy.push(
        `${wzgl}:${linia}: emisja POZA transakcją. Zdarzenie zapisane osobno od mutacji rozjedzie ` +
          `się z nią przy pierwszej awarii — i nikt się o tym nie dowie. Przenieś wywołanie do ` +
          `\`prisma.$transaction(async (tx) => { … })\` razem z zapisem stanu.`
      );
    } else if (klient !== txNazwa) {
      bledy.push(
        `${wzgl}:${linia}: emisja bierze \`${klient}\`, a klient transakcji nazywa się \`${txNazwa}\`. ` +
          `Zapis globalnym klientem wychodzi poza transakcję, mimo że wygląda na wewnątrz.`
      );
    }

    if (!wzgl.includes("__tests__")) {
      producenci.add(wzgl);
      if (wewnatrzPetli(tresc, m.index)) emitujeWPetli.add(wzgl);
    }

    // Rodzaj czytamy WYŁĄCZNIE z wnętrza tego wywołania, nie z całego pliku. Skan całego pliku
    // brałby `type: "shopping.list"` z `requireModuleAccess` — czyli identyfikator ZASOBU, nie
    // rodzaj zdarzenia. Bramka za szeroka daje fałszywy alarm równie skutecznie, jak za wąska
    // daje ciszę (lekcja z 065).
    const domkniecie = tresc.indexOf("});", m.index);
    const wywolanie = domkniecie === -1 ? "" : tresc.slice(m.index, domkniecie);
    for (const t of wywolanie.matchAll(/\btype:\s*"([a-z]+\.[a-z.]+)"/g)) uzyteRodzaje.add(t[1]);
  }
}

// ─── Kontrola 2: zapis do dziennika tylko przez emisję ──────────────────────

for (const plik of wszystkie) {
  const wzgl = path.relative(root, plik).split(path.sep).join("/");
  if (wzgl === emitPath || wzgl.includes("__tests__")) continue;
  const tresc = fs.readFileSync(plik, "utf8");
  if (/\.domainEvent\.(create|createMany|upsert)\b/.test(tresc)) {
    bledy.push(
      `${wzgl}: zapis do dziennika zdarzeń z pominięciem \`emitDomainEvent\`. Mechanizm ma JEDNO ` +
        `wejście — inaczej niezmiennik „tylko w transakcji" obchodzi się jedną linijką.`
    );
  }
}

// ─── Kontrola 3 (cd.): rejestr rodzajów ─────────────────────────────────────

if (!fs.existsSync(typesPath)) {
  bledy.push("brak src/platform/events/types.ts — rejestru rodzajów zdarzeń");
} else {
  const tresc = fs.readFileSync(typesPath, "utf8");
  const zadeklarowane = new Set([...tresc.matchAll(/\|\s*"([a-z]+\.[a-z.]+)"/g)].map((m) => m[1]));
  for (const rodzaj of uzyteRodzaje) {
    if (!zadeklarowane.has(rodzaj)) {
      bledy.push(
        `rodzaj zdarzenia "${rodzaj}" jest emitowany, ale nie ma go w unii \`DomainEventType\`. ` +
          `Dopisz go do src/platform/events/types.ts.`
      );
    }
  }
}

// ─── Kontrole 4 i 5: manifest ───────────────────────────────────────────────

if (!fs.existsSync(manifestPath)) {
  console.error(`✗ Brak manifestu ${path.relative(root, manifestPath)}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const wpisy = manifest.producenci ?? {};

for (const p of producenci) {
  const wpis = wpisy[p];
  if (!wpis) {
    bledy.push(
      `${p} emituje zdarzenie, ale nie ma wpisu w events-coverage.json. Nazwij PRZYSZŁEGO ODBIORCĘ ` +
        `— zdarzenie, na które nikt nie zareaguje, to zapis do tabeli, którego nikt nie przeczyta.`
    );
    continue;
  }
  for (const pole of ["zdarzenie", "powod", "przyszly-odbiorca"]) {
    if (!wpis[pole] || String(wpis[pole]).trim().length < 10) {
      bledy.push(`${p}: brak sensownej wartości w polu "${pole}"`);
    }
  }
  if (wpis.ladunek !== "pojedynczy" && wpis.ladunek !== "zbiorczy") {
    bledy.push(
      `${p}: pole "ladunek" musi być "pojedynczy" albo "zbiorczy". Bramka nie zgadnie, czy operacja ` +
        `na wielu wierszach ma dać jedno zdarzenie, czy N — to jest decyzja produktowa.`
    );
  } else if (wpis.ladunek === "zbiorczy" && emitujeWPetli.has(p)) {
    bledy.push(
      `${p}: zadeklarowany ładunek "zbiorczy", ale emisja leży WEWNĄTRZ PĘTLI — to daje jedno ` +
        `zdarzenie na wiersz. Spis stu pozycji jest dla użytkownika JEDNĄ czynnością; sto zdarzeń ` +
        `zamieni się u odbiorcy (zadanie 25) w lawinę powiadomień. Wyemituj raz, po pętli.`
    );
  }
}

for (const p of Object.keys(wpisy)) {
  if (!producenci.has(p)) {
    bledy.push(`manifest opisuje producenta ${p}, który niczego nie emituje — usuń nieaktualny wpis`);
  }
}

// ─── Wynik ──────────────────────────────────────────────────────────────────

if (bledy.length > 0) {
  console.error("✗ Zdarzenia domenowe (zadanie 21):\n");
  for (const b of bledy) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Zdarzenia domenowe: ${producenci.size} producentów, każdy emituje z transakcji i ma ` +
    `nazwanego odbiorcę · ${uzyteRodzaje.size} rodzajów w rejestrze.`
);
