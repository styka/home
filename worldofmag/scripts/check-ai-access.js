#!/usr/bin/env node
/**
 * Bramka DOSTĘPU W NARZĘDZIACH ODCZYTU ASYSTENTA (065, zadanie 18; rozdz. 12.2.1).
 *
 * Dokument nazywa to **realnym zagrożeniem**: *„Read-toole asystenta muszą przechodzić przez
 * `requireAccess`, a nie przez `where: { ownerId }`. Inaczej użytkownik z dostępem `viewer` do
 * projektu mógłby poprosić asystenta o zmianę zadania — i asystent by ją wykonał, bo działa
 * »w imieniu użytkownika« bez sprawdzenia roli."* I dodaje: *„Przy 160 akcjach AI nie da się tego
 * zweryfikować ręcznie."*
 *
 * Asystent jest najgorszym możliwym miejscem na lukę: czyta wszystkie moduły, nie przechodzi przez
 * UI i dostaje identyfikatory **wprost z rozmowy** — więc podanie cudzego identyfikatora nic go
 * nie kosztuje.
 *
 * Reguła: KAŻDY plik `src/modules/*​/ai/readTools.ts` musi mieć widoczny mechanizm zawężenia —
 * sprawdzanie dostępu, wspólny helper zakresu albo jawne `ownerId: userId`. Czego bramka **nie
 * umie** rozstrzygnąć (np. zawężenie schowane w funkcji kontraktu, która bierze użytkownika
 * z sesji), wymaga wpisu w manifeście z opisem mechanizmu — bo to jest decyzja recenzenta,
 * nie wzorca tekstowego.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const modulesDir = path.join(root, "src/modules");
const manifestPath = path.join(root, "src/lib/ai/read-access-coverage.json");

/** Mechanizmy zawężenia, które da się rozpoznać z tekstu. */
const MECHANIZMY = [
  /require[A-Za-z]*(Module)?Access\s*\(/, // sprawdzanie dostępu przez platformę
  /assert[A-Za-z]*Access\s*\(/, // guard modułu
  /ownedWhereAsync\s*\(|ownedOrAsync\s*\(|ownedWhere\s*\(|ownedOr\s*\(/, // wspólny zakres (057/058)
  /ownerId:\s*(userId|user\.id)/, // jawne zawężenie do właściciela
  // 078 (etap 4 część 2): zakres po PRZESTRZENI OSOBISTEJ. To następca `ownerId: userId` na tabelach
  // bez współwłasności zespołowej i jest ZAWĘŻENIEM ŚCIŚLEJSZYM niż `ownedOrAsync` (jedna przestrzeń
  // zamiast wszystkich moich). Bez tego wpisu konwersja etapu 4 wyglądała dla bramki jak USUNIĘCIE
  // zawężenia — i słusznie wywróciła build, bo bramka nie zna nazw, których jej nie podano.
  /filtrMoichRekordow\s*\(/,
  /[A-Za-z]*[Ss]cope\s*\(\s*userId/, // lokalny helper zakresu (np. `ownerScope(userId)`)
  /accessible[A-Za-z]*\s*\(\s*userId/, // lokalny helper „co widzę"
  // 114: zakres Roślin — „moje przestrzenie + nadane mi" (lib/sharingGuard). To jest zawężenie
  // SZERSZE o nadania niż `ownedWhereAsync`, ale wciąż zawężenie do tego, co użytkownik widzi
  // w widokach — asystent ma odpowiadać na pytanie o dostęp tak samo jak agenda i kalendarz.
  /zakresPrzestrzeni\s*\(\s*userId/,
];

/**
 * 078 — dopasowujemy wzorce do KODU, nie do komentarzy.
 *
 * To lekcja już zapisana w `doświadczenia.md`: bramka czytająca tekst pliku czyta też zdania
 * o kodzie. Plik, który w komentarzu wyjaśnia „nie używamy tu `ownerId: userId`", przechodziłby
 * dzięki temu wyjaśnieniu — czyli bramka mierzyłaby opis zamiast rzeczy opisywanej. Przy
 * zawężeniu dostępu w asystencie to najgorsze możliwe miejsce na taki fałszywy zielony.
 */
function bezKomentarzy(tresc) {
  return tresc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const wyjatki = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).wyjatki || {}
  : {};

const uzyte = new Set();
const brakujace = [];
let sprawdzone = 0;

for (const m of fs.readdirSync(modulesDir, { withFileTypes: true })) {
  if (!m.isDirectory()) continue;
  const abs = path.join(modulesDir, m.name, "ai/readTools.ts");
  if (!fs.existsSync(abs)) continue;
  const rel = path.relative(root, abs).split(path.sep).join("/");
  sprawdzone++;
  const tresc = bezKomentarzy(fs.readFileSync(abs, "utf8"));
  if (MECHANIZMY.some((re) => re.test(tresc))) continue;
  if (wyjatki[rel]) {
    uzyte.add(rel);
    continue;
  }
  brakujace.push(rel);
}

const martwe = Object.keys(wyjatki).filter((rel) => !uzyte.has(rel));

if (brakujace.length || martwe.length) {
  console.error("\n✖ Narzędzia odczytu asystenta bez widocznego zawężenia dostępu:\n");
  for (const rel of brakujace.sort()) {
    console.error(`  ✖ ${rel} nie pokazuje, jak zawęża wynik do tego, co użytkownik może zobaczyć.`);
    console.error("    Asystent dostaje identyfikatory wprost z rozmowy, więc niezawężone zapytanie");
    console.error("    oddaje cudze dane każdemu, kto poda cudzy identyfikator (rozdz. 12.2.1).");
    console.error(`    Jeśli zawężenie jest, ale schowane (np. w funkcji kontraktu biorącej użytkownika`);
    console.error(`    z sesji) — opisz mechanizm w ${path.relative(root, manifestPath)}.\n`);
  }
  for (const rel of martwe) {
    console.error(`  ✖ Martwy wyjątek w manifeście: „${rel}" pokazuje już mechanizm wprost.\n`);
  }
  process.exit(1);
}

console.log(
  `✓ Dostęp w narzędziach odczytu AI: ${sprawdzone} modułów z narzędziami, każdy zawęża wynik` +
    `${uzyte.size ? ` (${uzyte.size} świadomych wyjątków)` : ""}.`,
);
