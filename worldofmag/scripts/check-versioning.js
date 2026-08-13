#!/usr/bin/env node
/**
 * Bramka WERSJONOWANIA (062, zadanie 15).
 *
 * Problem, który rozwiązuje: kolumna `version` chroni przed cichą utratą pracy **tylko wtedy, gdy
 * wszystkie zapisy przez nią przechodzą**. Jeden zwykły `prisma.task.update(...)` obok mechanizmu
 * nie objawia się niczym — po prostu nadpisuje, tak jak przed 062, a wersja przestaje mieć
 * znaczenie, bo nie odzwierciedla już liczby zmian.
 *
 * Reguła: model, który **ma kolumnę `version`** w `schema.prisma`, wolno zapisywać wyłącznie przez
 * `updateWithVersion` z `@/platform/concurrency/version`. Każdy plik robiący na nim `update`/
 * `updateMany`/`upsert` musi importować ten helper — albo mieć wpis w manifeście z powodem.
 *
 * Zbiór modeli wyprowadzamy ze SCHEMATU, nie z listy w skrypcie: rozszerzenie wersjonowania na
 * kolejny model ma automatycznie objąć go bramką, a nie wymagać pamiętania o dwóch miejscach.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const schemaPath = path.join(root, "prisma/schema.prisma");
const manifestPath = path.join(root, "src/platform/concurrency/versioning-coverage.json");

/** Modele z kolumną `version` → nazwa delegata Prismy (`Task` → `task`). */
function wersjonowaneDelegaty() {
  const s = fs.readFileSync(schemaPath, "utf8");
  const out = [];
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(s))) {
    if (!/^\s*version\s+Int\b/m.test(m[2])) continue;
    out.push(m[1][0].toLowerCase() + m[1].slice(1));
  }
  return out;
}

const delegaty = wersjonowaneDelegaty();
if (delegaty.length === 0) {
  console.log("• Wersjonowanie: pominięte (żaden model nie ma kolumny `version`).");
  process.exit(0);
}

const ZAPIS = new RegExp(
  `\\b(prisma|tx)\\.(${delegaty.join("|")})\\.(update|updateMany|upsert)\\b`,
);
const UZYWA_HELPERA = /@\/platform\/concurrency\/version/;

const SELF = new Set(["src/platform/concurrency/version.ts"]);
for (const rel of SELF) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`✖ Bramka wersjonowania wskazuje na nieistniejący plik: ${rel}`);
    process.exit(1);
  }
}

function pliki(dir) {
  const out = [];
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) {
      if (w.name === "node_modules" || w.name === "generated") continue;
      out.push(...pliki(p));
    } else if (/\.tsx?$/.test(w.name)) out.push(p);
  }
  return out;
}

const wyjatki = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).wyjatki || {}
  : {};

const uzyte = new Set();
const brakujace = [];
let zapisujace = 0;

for (const abs of pliki(srcDir)) {
  const rel = path.relative(root, abs).split(path.sep).join("/");
  if (SELF.has(rel) || rel.includes("__tests__")) continue;
  const tresc = fs.readFileSync(abs, "utf8");
  if (!ZAPIS.test(tresc)) continue;
  zapisujace++;
  if (UZYWA_HELPERA.test(tresc)) continue;
  if (wyjatki[rel]) {
    uzyte.add(rel);
    continue;
  }
  brakujace.push(rel);
}

const martwe = Object.keys(wyjatki).filter((rel) => !uzyte.has(rel));

if (brakujace.length || martwe.length) {
  console.error("\n✖ Wersjonowanie — zapis modelu z wersją z pominięciem mechanizmu:\n");
  for (const rel of brakujace.sort()) {
    console.error(`  ✖ ${rel} zapisuje model z kolumną \`version\`, a nie używa \`updateWithVersion\`.`);
    console.error("    Zwykły `update` nadpisuje po cichu — dokładnie to, co ten mechanizm ma");
    console.error("    kończyć — i psuje licznik wersji, więc kontrola przestaje cokolwiek znaczyć.");
    console.error(`    Świadomy wyjątek (np. zapis pola, o które nikt się nie ściga): ${path.relative(root, manifestPath)}.\n`);
  }
  for (const rel of martwe) {
    console.error(`  ✖ Martwy wyjątek w manifeście: „${rel}" już nie zapisuje modelu z wersją.\n`);
  }
  process.exit(1);
}

console.log(
  `✓ Wersjonowanie: ${delegaty.length} modeli z wersją, ${zapisujace} plików zapisujących` +
    `${uzyte.size ? ` (${uzyte.size} świadomych wyjątków)` : ""}.`,
);
