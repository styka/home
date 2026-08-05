#!/usr/bin/env node
/**
 * Bramka GRANIC MIĘDZY MODUŁAMI (046, Faza 1 przebudowy architektury).
 *
 * Rozdz. 14 dokumentu „Omnia 🧐 — architektura docelowa" mówi wprost: reguła blokująca import
 * przez granicę NIE JEST OPCJONALNA, bo granice bez egzekwowania erodują w tygodnie. Sama reguła
 * w `.eslintrc.json` to jednak za mało — i to nie jest teoretyczne zmartwienie:
 *
 *   Sprawdzone doświadczalnie przy pisaniu tej fazy: gdy `.eslintrc.json` jest niepoprawny
 *   (np. wymyślony klucz w `overrides`), `next lint` wypisuje „ESLint configuration … is invalid",
 *   ale KOŃCZY SIĘ KODEM 0. Reguła granic przestaje działać, a build jest zielony.
 *
 * Ta bramka nie czyta konfiguracji — ona ją WYWOŁUJE. Tworzy tymczasowe pliki łamiące każdą
 * z reguł i wymaga, żeby ESLint faktycznie zgłosił błąd; osobno sprawdza przypadki, które
 * MUSZĄ przechodzić (import kontraktu obcego modułu, import własnego wnętrza ścieżką względną),
 * bo reguła zbyt szeroka jest tak samo zła jak reguła nieaktywna — tyle że objawia się obchodzeniem.
 *
 * Pliki testowe żyją krócej niż jedno uruchomienie i są usuwane w `finally`.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const modulesDir = path.join(root, "src/modules");
const platformDir = path.join(root, "src/platform");

/** Nazwa z prefiksem `__`, żeby nikt jej nie wziął za prawdziwy plik modułu. */
const PROBE = "__granice-bramka.probe.ts";

function firstModule() {
  const dirs = fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  if (dirs.length < 2) {
    console.error(
      "✖ Bramka granic potrzebuje co najmniej dwóch modułów w src/modules/, żeby mieć „swój\" i „cudzy\".",
    );
    process.exit(1);
  }
  return dirs;
}

function eslint(file) {
  const r = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/eslint/bin/eslint.js"), file, "--format", "json"],
    { cwd: root, encoding: "utf8" },
  );
  // Niepoprawna konfiguracja = ESLint nie zwraca JSON-a. To jest właśnie ten przypadek,
  // który `next lint` przepuszcza z kodem 0 — tutaj musi być twardym błędem.
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    console.error("✖ ESLint nie zwrócił wyniku — najpewniej `.eslintrc.json` jest niepoprawny.\n");
    console.error((r.stderr || r.stdout || "").trim());
    process.exit(1);
  }
  const messages = parsed.flatMap((f) => f.messages);
  return messages.filter((m) => m.ruleId === "no-restricted-imports");
}

const cases = [];
const created = [];

try {
  const [modA, modB] = firstModule();

  // 1. NEGATYWNY: moduł sięga do wnętrza obcego modułu.
  const p1 = path.join(modulesDir, modA, PROBE);
  fs.writeFileSync(p1, `import "@/modules/${modB}/actions/nieistotne";\n`);
  created.push(p1);
  cases.push({
    file: p1,
    expect: "error",
    what: `import wnętrza obcego modułu (@/modules/${modB}/…) z modułu ${modA}`,
  });

  // 2. POZYTYWNY: moduł sięga do KONTRAKTU obcego modułu.
  const p2 = path.join(modulesDir, modA, PROBE.replace(".ts", ".ok.ts"));
  fs.writeFileSync(p2, `import "@/modules/${modB}/contract";\n`);
  created.push(p2);
  cases.push({ file: p2, expect: "clean", what: `import kontraktu obcego modułu (${modB}/contract)` });

  // 3. POZYTYWNY: moduł importuje własne wnętrze ścieżką względną.
  const p3 = path.join(modulesDir, modA, PROBE.replace(".ts", ".self.ts"));
  fs.writeFileSync(p3, `import "./contract";\n`);
  created.push(p3);
  cases.push({ file: p3, expect: "clean", what: "import własnego wnętrza ścieżką względną" });

  // 4. NEGATYWNY: platforma sięga do modułu (asymetria z rozdz. 7.1).
  const p4 = path.join(platformDir, PROBE);
  fs.writeFileSync(p4, `import "@/modules/${modA}/contract";\n`);
  created.push(p4);
  cases.push({
    file: p4,
    expect: "error",
    what: "import modułu z platformy (nawet przez kontrakt — platforma nie zna modułów)",
  });

  const failures = [];
  for (const c of cases) {
    const found = eslint(c.file);
    if (c.expect === "error" && found.length === 0) {
      failures.push(`  ✖ ${c.what}\n      oczekiwano BŁĘDU, reguła milczy — granica nie jest egzekwowana.`);
    }
    if (c.expect === "clean" && found.length > 0) {
      failures.push(
        `  ✖ ${c.what}\n      oczekiwano PRZEJŚCIA, reguła zgłasza błąd — reguła jest za szeroka:\n      ${found[0].message}`,
      );
    }
  }

  if (failures.length) {
    console.error("\n✖ Bramka granic modułów — reguła nie zachowuje się tak, jak deklaruje:\n");
    console.error(failures.join("\n"));
    console.error(
      "\n  Reguły siedzą w `.eslintrc.json` (overrides dla src/modules/** i src/platform/**).\n" +
        "  Uwaga: przy niepoprawnej konfiguracji `next lint` kończy się kodem 0 — sprawdź jej składnię.\n",
    );
    process.exit(1);
  }

  console.log(
    `✓ Granice modułów: ${cases.length} przypadków — import przez granicę blokowany, ` +
      "kontrakt i własne wnętrze przechodzą.",
  );
} finally {
  for (const f of created) fs.rmSync(f, { force: true });
}
