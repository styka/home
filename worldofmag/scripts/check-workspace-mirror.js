#!/usr/bin/env node
/**
 * Bramka LUSTRA PRZESTRZENI (051, Faza 2 / zadanie 9).
 *
 * Problem, który rozwiązuje: przez okres przejściowy ta sama informacja („kto należy do zespołu")
 * mieszka w dwóch miejscach — w `Team`/`TeamMember` i w przestrzeni. Zespół jest źródłem prawdy,
 * przestrzeń lustrem, więc **każda** mutacja zespołu musi lustro uzgodnić. Dziś takich miejsc są
 * dokładnie dwa i są wpięte; ta bramka istnieje dla trzeciego, które kiedyś powstanie.
 *
 * Dlaczego to nie może zostać w gestii pamięci: nic przestrzeni jeszcze nie czyta, więc pominięte
 * uzgodnienie **nie objawia się niczym**. Wyszłoby dopiero przy zadaniu 11, gdy odczyty przełączą
 * się na `workspaceId` — czyli najpóźniej jak się da i najdrożej.
 *
 * Reguła: KAŻDY plik, który mutuje `Team` albo `TeamMember`, musi importować
 * `@/platform/workspaces/sync` — albo mieć świadomy wpis w manifeście z powodem.
 *
 * Skrypt jest czysto statyczny — nie dotyka bazy ani sieci.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const manifestPath = path.join(root, "src/platform/workspaces/mirror-coverage.json");

/**
 * Mutacje Prismy na zespole i jego składzie. Odczyty (`findMany`, `count`) nie ruszają lustra.
 *
 * `tx` obok `prisma` nie jest ozdobą: w transakcji interaktywnej
 * (`prisma.$transaction(async (tx) => …)`) mutacja nazywa się `tx.team.update`, więc wzorzec
 * szukający wyłącznie `prisma.` przepuściłby ją bez słowa.
 */
const MUTACJE = /\b(prisma|tx)\.(team|teamMember)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/;
/** Import, który dowodzi, że plik o lustrze pamięta. */
const UZGADNIA = /@\/platform\/workspaces\/sync/;

// Plik, w którym lustro jest DEFINIOWANE, nie jest jego konsumentem. Ścieżkę sprawdzamy przy
// starcie — inaczej przenosiny zamieniłyby wyłączenie w martwy wpis po cichu (lekcja z 049).
const SELF = new Set(["src/platform/workspaces/sync.ts"]);
for (const rel of SELF) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`\n✖ ${path.basename(__filename)}: wyłączenie wskazuje nieistniejący plik „${rel}".`);
    console.error("  Ścieżka definicji lustra się zmieniła — zaktualizuj SELF, nie usuwaj go.\n");
    process.exit(1);
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const wyjatki = manifest.wyjatki ?? {};

const brakujace = [];
const uzyteWyjatki = new Set();
const mutujace = [];

for (const plik of walk(srcDir)) {
  const rel = path.relative(root, plik).split(path.sep).join("/");
  if (SELF.has(rel)) continue;
  // Testy wolno mutować zespoły wprost — one właśnie sprawdzają, czy lustro nadąża.
  if (rel.includes("__tests__") || rel.endsWith(".test.ts")) continue;

  const tresc = fs.readFileSync(plik, "utf8");
  if (!MUTACJE.test(tresc)) continue;
  mutujace.push(rel);

  if (UZGADNIA.test(tresc)) continue;
  if (wyjatki[rel]) {
    uzyteWyjatki.add(rel);
    continue;
  }
  brakujace.push(rel);
}

const martwe = Object.keys(wyjatki).filter((rel) => !uzyteWyjatki.has(rel));

if (brakujace.length || martwe.length) {
  console.error("\n✖ Lustro przestrzeni — mutacja zespołu bez uzgodnienia przestrzeni:\n");
  for (const rel of brakujace) {
    console.error(`  ✖ ${rel} mutuje Team/TeamMember, a nie importuje @/platform/workspaces/sync.`);
    console.error("    Zespół jest źródłem prawdy, przestrzeń jego lustrem — po zmianie składu, nazwy");
    console.error("    albo właściciela zawołaj `syncTeamWorkspace(teamId)`. Jeśli ta mutacja lustra");
    console.error(`    naprawdę nie dotyczy, dopisz powód do ${path.relative(root, manifestPath)}.\n`);
  }
  for (const rel of martwe) {
    console.error(`  ✖ Martwy wyjątek w manifeście: „${rel}" już nie mutuje Team/TeamMember.`);
    console.error("    Usuń wpis — wyjątek bez powodu z czasem staje się furtką.\n");
  }
  process.exit(1);
}

console.log(
  `✓ Lustro przestrzeni: ${mutujace.length} plików mutujących zespół, każdy uzgadnia przestrzeń` +
    `${uzyteWyjatki.size ? ` (${uzyteWyjatki.size} świadomych wyjątków)` : ""}.`,
);
