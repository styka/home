#!/usr/bin/env node
/**
 * Bramka ZAKRESU WŁASNOŚCI (057, Faza 2 / zadanie 11, etap 3B krok 1).
 *
 * Problem, który rozwiązuje: warunek „zasoby, które widzę" był wpisany ręcznie w 79 miejscach
 * w 52 plikach, w czterech różnych zapisach tego samego znaczenia. Etap 3B ma go zamienić na
 * zakres po przestrzeniach (rozdz. 8.2) — a to da się zrobić JEDNĄ zmianą tylko wtedy, gdy warunek
 * mieszka w jednym miejscu. Ta bramka pilnuje, żeby nie wrócił do rozsypki.
 *
 * Reguła: **`ownerTeamId: { in: … }` nie może pojawić się w kodzie modułów ani w `src/lib`,
 * `src/actions`, `src/app`.** Zakres własności bierze się z `ownedWhere`/`ownedOr`
 * (`@/platform/auth/serverUtils`). Świadome wyjątki mają wpis z powodem w manifeście, a wpis
 * **martwy** — dotyczący miejsca, które już warunku nie zawiera — też wywala bramkę, żeby wyjątek
 * z czasem nie stał się furtką (wzorzec `mirror-coverage.json`).
 *
 * Bramka jest statyczna — nie dotyka bazy ani sieci.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const manifestPath = path.join(root, "src/platform/auth/ownership-scope-coverage.json");

/** Ręcznie pisana gałąź zespołowa. To jest dokładnie ta rzecz, którą ma zastąpić helper. */
const RECZNY_ZAKRES = /ownerTeamId:\s*\{\s*in:/;

/** Plik, w którym helper jest DEFINIOWANY, nie jest jego konsumentem. */
const SELF = new Set(["src/platform/auth/serverUtils.ts"]);
for (const rel of SELF) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`✖ Bramka zakresu własności wskazuje na nieistniejący plik: ${rel}`);
    console.error("  Po przenosinach popraw listę SELF — inaczej wyłączenie stanie się martwe po cichu.");
    process.exit(1);
  }
}

function pliki(dir) {
  const out = [];
  for (const wpis of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, wpis.name);
    if (wpis.isDirectory()) {
      if (wpis.name === "node_modules" || wpis.name === "generated") continue;
      out.push(...pliki(p));
    } else if (/\.tsx?$/.test(wpis.name)) {
      out.push(p);
    }
  }
  return out;
}

const wyjatki = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).wyjatki || {}
  : {};

const uzyte = new Set();
const naruszenia = [];
let sprawdzone = 0;

for (const abs of pliki(srcDir)) {
  const rel = path.relative(root, abs).split(path.sep).join("/");
  if (SELF.has(rel)) continue;
  // Testy wolno pisać wprost — one MAJĄ prawo konstruować surowe zapytania, żeby porównać je
  // z tym, co produkuje helper. Gdyby bramka ich zabraniała, nie dałoby się napisać dowodu.
  if (rel.includes("__tests__")) continue;

  const tresc = fs.readFileSync(abs, "utf8");
  if (!RECZNY_ZAKRES.test(tresc)) continue;
  sprawdzone++;
  if (wyjatki[rel]) {
    uzyte.add(rel);
    continue;
  }
  naruszenia.push(rel);
}

const martwe = Object.keys(wyjatki).filter((rel) => !uzyte.has(rel));

if (naruszenia.length || martwe.length) {
  console.error("\n✖ Zakres własności pisany ręcznie zamiast wspólnym helperem:\n");
  for (const rel of naruszenia.sort()) {
    console.error(`  ✖ ${rel} zawiera \`ownerTeamId: { in: … }\`.`);
    console.error("    Użyj `ownedWhere(userId, teamIds)` (cały `where`) albo `ownedOr(...)`");
    console.error("    (same alternatywy) z `@/platform/auth/serverUtils`. Etap 3B przełączy ten");
    console.error("    warunek na przestrzenie JEDNĄ zmianą — ręczny zapis wypadłby z tej zmiany");
    console.error(`    i został przy starej regule. Świadomy wyjątek: wpis z powodem w ${path.relative(root, manifestPath)}.\n`);
  }
  for (const rel of martwe) {
    console.error(`  ✖ Martwy wyjątek w manifeście: „${rel}" już nie zawiera ręcznego zakresu.`);
    console.error("    Usuń wpis — wyjątek bez powodu z czasem staje się furtką.\n");
  }
  process.exit(1);
}

console.log(
  `✓ Zakres własności: warunek w jednym miejscu` +
    (uzyte.size ? ` (${uzyte.size} świadomych wyjątków).` : "."),
);
