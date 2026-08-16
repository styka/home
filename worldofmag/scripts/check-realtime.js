#!/usr/bin/env node
/**
 * Bramka KANAŁU CZASU RZECZYWISTEGO (072, zadania 23–24; rozdz. 11.1).
 *
 * Pilnuje czterech rzeczy, z których **dwie pierwsze są niezmiennikami bezpieczeństwa**, a nie stylu.
 *
 *   1. TRASA NIE CZYTA KANAŁÓW Z ŻĄDANIA. Gdyby przyjmowała identyfikator przestrzeni od klienta,
 *      wpisanie cudzego byłoby podsłuchem cudzego strumienia. Kanały muszą być liczone z sesji.
 *   2. TRASA JEST ZA SESJĄ. Strumień niesie informację o zmianach w danych użytkownika.
 *   3. AWARYJNE ODPYTYWANIE NIE CZĘŚCIEJ NIŻ CO 5 MINUT. Bez tej kontroli ktoś „na chwilę" wróci
 *      do 45 sekund i nikt tego nie zauważy — a to jest dokładnie ten koszt, który zadanie 24
 *      miało usunąć (diagnoza 5.2).
 *   4. SZYNA ZWRACA ODSUBSKRYBOWANIE. Bez niego każda zamknięta karta zostawia słuchacza.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const trasaPath = path.join(root, "src/app/api/events/route.ts");
const klientPath = path.join(root, "src/components/shell/DataFreshness.tsx");
const szynaPath = path.join(root, "src/platform/events/bus.ts");

const MIN_INTERWAL_MS = 300_000;
const bledy = [];

/** Treść pliku bez komentarzy — bramka ma czytać kod, nie to, co o nim napisaliśmy (lekcja z 071). */
function bezKomentarzy(p) {
  if (!fs.existsSync(p)) return null;
  return fs
    .readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// ─── 1 i 2: trasa strumienia ────────────────────────────────────────────────

const trasa = bezKomentarzy(trasaPath);
if (trasa === null) {
  bledy.push("brak src/app/api/events/route.ts — trasy strumienia zdarzeń");
} else {
  if (/searchParams|params\.|req\.url|request\.url/.test(trasa)) {
    bledy.push(
      "src/app/api/events/route.ts czyta coś z ŻĄDANIA. Kanały muszą być liczone na serwerze " +
        "z sesji — przyjęcie identyfikatora przestrzeni od klienta pozwoliłoby podsłuchać cudzy " +
        "strumień, wpisując cudzy identyfikator (C-21)."
    );
  }
  if (!/\bauth\(\)/.test(trasa)) {
    bledy.push(
      "src/app/api/events/route.ts nie sprawdza sesji. Strumień niesie informację o zmianach " +
        "w danych użytkownika i musi być za sesją."
    );
  }
  if (!/kanalyDla\(/.test(trasa)) {
    bledy.push(
      "src/app/api/events/route.ts nie używa `kanalyDla` — kanały mają powstawać w jednym miejscu, " +
        "z sesji, a nie być składane ad hoc w trasie."
    );
  }
}

// ─── 3: interwał awaryjny ───────────────────────────────────────────────────

const klient = bezKomentarzy(klientPath);
if (klient === null) {
  bledy.push("brak src/components/shell/DataFreshness.tsx");
} else {
  const interwaly = [...klient.matchAll(/setInterval\([\s\S]{0,200}?,\s*([A-Z_0-9]+|\d[\d_]*)\s*\)/g)].map(
    (m) => m[1]
  );
  if (interwaly.length === 0) {
    bledy.push("DataFreshness nie ma żadnego odpytywania awaryjnego — brak siatki bezpieczeństwa " +
      "na wypadek zerwanego strumienia albo wielu instancji serwera.");
  }
  for (const nazwa of interwaly) {
    const wartosc = /^\d/.test(nazwa)
      ? Number(nazwa.replace(/_/g, ""))
      : Number((klient.match(new RegExp(`${nazwa}\\s*=\\s*(\\d[\\d_]*)`)) ?? [])[1]?.replace(/_/g, ""));
    if (!Number.isFinite(wartosc)) {
      bledy.push(`DataFreshness: nie udało się odczytać wartości interwału "${nazwa}"`);
    } else if (wartosc < MIN_INTERWAL_MS) {
      bledy.push(
        `DataFreshness odpytuje co ${Math.round(wartosc / 1000)} s, a minimum to ` +
          `${MIN_INTERWAL_MS / 1000} s. Odpytywanie jest SIATKĄ BEZPIECZEŃSTWA, nie głównym ` +
          `mechanizmem — od zmian jest strumień. Powrót do krótkiego interwału przywraca koszt, ` +
          `który zadanie 24 usunęło (diagnoza 5.2).`
      );
    }
  }
}

// ─── 4: szyna zwraca odsubskrybowanie ───────────────────────────────────────

const szyna = bezKomentarzy(szynaPath);
if (szyna === null) {
  bledy.push("brak src/platform/events/bus.ts");
} else if (!/export function subskrybuj\([\s\S]*?\):\s*\(\)\s*=>\s*void/.test(szyna)) {
  bledy.push(
    "`subskrybuj` w bus.ts musi zwracać funkcję odsubskrybowania (`() => void`). Bez niej każda " +
      "zamknięta karta zostawia słuchacza, a serwer po dobie rozgłasza do martwych połączeń."
  );
}

// ─── Wynik ──────────────────────────────────────────────────────────────────

if (bledy.length > 0) {
  console.error("✗ Kanał czasu rzeczywistego (zadania 23–24):\n");
  for (const b of bledy) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Kanał czasu rzeczywistego: trasa za sesją, kanały z sesji (nie z żądania), ` +
    `odpytywanie awaryjne ≥ ${MIN_INTERWAL_MS / 1000} s, szyna sprząta słuchaczy.`
);
