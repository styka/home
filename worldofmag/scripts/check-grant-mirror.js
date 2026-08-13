#!/usr/bin/env node
/**
 * Bramka LUSTRA NADAŃ (059, zadanie 12 / etap 1 z trzech).
 *
 * Problem, który rozwiązuje: przez okres przejściowy „kto ma dostęp do tego zasobu" mieszka
 * w dwóch miejscach — w dawnych tabelach (`TaskProjectMember`, `TaskShare`) i w `ResourceGrant`.
 * Tabele są źródłem prawdy, nadania lustrem. Pominięte uzgodnienie **nie objawia się niczym**,
 * bo nadań nikt jeszcze nie czyta; wyszłoby dopiero w etapie 2 — najpóźniej i najdrożej.
 *
 * To jest dokładnie ta sama sytuacja i ta sama odpowiedź, co przy lustrze przestrzeni w 051
 * (C-16). Reguła: KAŻDY plik mutujący `taskProjectMember` albo `taskShare` musi importować
 * `@/platform/sharing/grantMirror` — albo mieć świadomy wpis w manifeście z powodem.
 *
 * Wzorzec obejmuje `tx.` obok `prisma.`: w transakcji interaktywnej mutacja nazywa się
 * `tx.taskShare.deleteMany`, więc wzorzec szukający tylko `prisma.` przepuściłby ją bez słowa —
 * na tym potknęła się recenzja 051.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const manifestPath = path.join(root, "src/platform/sharing/grant-mirror-coverage.json");

const MUTACJE =
  /\b(prisma|tx)\.(taskProjectMember|taskShare)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/;
const UZGADNIA = /@\/platform\/sharing\/grantMirror/;

const SELF = new Set(["src/platform/sharing/grantMirror.ts"]);
for (const rel of SELF) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`✖ Bramka lustra nadań wskazuje na nieistniejący plik: ${rel}`);
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
const mutujace = [];

for (const abs of pliki(srcDir)) {
  const rel = path.relative(root, abs).split(path.sep).join("/");
  if (SELF.has(rel) || rel.includes("__tests__")) continue;
  const tresc = fs.readFileSync(abs, "utf8");
  if (!MUTACJE.test(tresc)) continue;
  mutujace.push(rel);
  if (UZGADNIA.test(tresc)) continue;
  if (wyjatki[rel]) {
    uzyte.add(rel);
    continue;
  }
  brakujace.push(rel);
}

const martwe = Object.keys(wyjatki).filter((rel) => !uzyte.has(rel));

if (brakujace.length || martwe.length) {
  console.error("\n✖ Lustro nadań — mutacja udostępnienia bez uzgodnienia nadania:\n");
  for (const rel of brakujace) {
    console.error(`  ✖ ${rel} mutuje TaskProjectMember/TaskShare, a nie importuje grantMirror.`);
    console.error("    Tabela jest źródłem prawdy, nadanie jej lustrem — po zmianie zawołaj");
    console.error("    `mirrorProjectMember`/`mirrorTaskShare` albo ich wariant `unmirror…`.");
    console.error(`    Jeśli mutacja lustra naprawdę nie dotyczy, dopisz powód do ${path.relative(root, manifestPath)}.\n`);
  }
  for (const rel of martwe) {
    console.error(`  ✖ Martwy wyjątek w manifeście: „${rel}" już nie mutuje tych tabel.`);
    console.error("    Usuń wpis — wyjątek bez powodu z czasem staje się furtką.\n");
  }
  process.exit(1);
}

console.log(
  `✓ Lustro nadań: ${mutujace.length} plików mutujących udostępnienia, każdy uzgadnia nadanie` +
    `${uzyte.size ? ` (${uzyte.size} świadomych wyjątków)` : ""}.`,
);
