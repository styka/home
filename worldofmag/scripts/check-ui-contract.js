#!/usr/bin/env node
/**
 * Bramka KONTRAKTU WIDOKU (045).
 *
 * Problem, który rozwiązuje: rozdz. 10.4 architektury docelowej mówi wprost, że samo
 * istnienie wspólnego komponentu nie wystarcza — `components/ui/home` istniało i nie
 * wszędzie było używane. Bez bramki nowy moduł znów napisze własny nagłówek, a dług,
 * który właśnie spłacamy, odrośnie w kilka tygodni.
 *
 * Sprawdza trzy rzeczy:
 *
 *  1. KOMPLETNOŚĆ MANIFESTU — każdy katalog trasy modułu w `src/app/` ma klucz
 *     w manifeście. Manifest jest kluczowany MODUŁEM, nie nazwą pliku, bo konwencja
 *     `*Page.tsx` nie jest powszechna (Warsztaty mają `WorkshopsList.tsx`, Magazynowanie
 *     kilkanaście podtras). Nowy moduł bez wpisu = build pada.
 *
 *  2. KONTRAKT WIDOKU — plik wejściowy widoku renderuje `ModuleView` i przekazuje `state`.
 *     Moduł jeszcze niezmigrowany deklaruje `"status": "pending"` z powodem — to jest
 *     JAWNA lista długu, a nie cisza.
 *
 *  3. ZASZYTE KOLORY MOTYWU — literały `#rrggbb` w `src/components`. Skrypt nie potrafi
 *     odróżnić koloru MOTYWU od koloru będącego DANYMI (paleta tagów wybierana przez
 *     użytkownika, ilustracja w poradniku), więc — jak pozostałe bramki Omnii — żąda
 *     świadomej decyzji zamiast zgadywać.
 *
 * Skrypt jest czysto statyczny — nie dotyka bazy ani sieci.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const appDir = path.join(root, "src/app");
const componentsDir = path.join(root, "src/components");
const manifestPath = path.join(root, "src/lib/ui/view-contract.json");

/** Katalogi w `src/app`, które nie są modułami użytkownika. */
const NOT_MODULES = new Set(["api", "auth", "admin", "providers"]);

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    console.error(`✖ Brak manifestu ${path.relative(root, manifestPath)}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const manifest = readManifest();
const modules = manifest.modules || {};
const colorExceptions = manifest.colorExceptions || {};
const errors = [];
const warnings = [];

// ─── 1. Kompletność manifestu ────────────────────────────────────────────────

const routeDirs = fs
  .readdirSync(appDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("(") && !e.name.startsWith("_") && !NOT_MODULES.has(e.name))
  .map((e) => e.name);

for (const dir of routeDirs) {
  if (!(dir in modules)) {
    errors.push(
      `Trasa src/app/${dir} nie ma wpisu w manifeście kontraktu widoku.\n` +
        `    Dopisz do ${path.relative(root, manifestPath)}:\n` +
        `      "${dir}": { "status": "pending", "entries": ["src/components/${dir}/…Page.tsx"], "reason": "…" }`,
    );
  }
}

// ─── 2. Kontrakt widoku ──────────────────────────────────────────────────────

let migrated = 0;
let pending = 0;

for (const [name, def] of Object.entries(modules)) {
  const status = def.status || "pending";

  if (status === "pending") {
    pending++;
    if (!def.reason) errors.push(`Moduł "${name}" ma status "pending" bez pola "reason".`);
    continue;
  }
  if (status === "exempt") {
    if (!def.reason) errors.push(`Moduł "${name}" ma status "exempt" bez pola "reason".`);
    continue;
  }

  migrated++;
  for (const rel of def.entries || []) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      errors.push(`Moduł "${name}": plik ${rel} nie istnieje (nieaktualny manifest?).`);
      continue;
    }
    const src = fs.readFileSync(full, "utf8");
    if (!/<ModuleView[\s>]/.test(src)) {
      errors.push(`Moduł "${name}": ${rel} ma status "done", ale nie renderuje <ModuleView>.`);
    } else if (!/\sstate=/.test(src)) {
      errors.push(
        `Moduł "${name}": ${rel} renderuje <ModuleView> bez propa "state".\n` +
          `    Stany brzegowe (pusty / ładowanie / błąd / brak dostępu) są częścią kontraktu,\n` +
          `    a nie opcją — bez nich moduł znów będzie rysował je po swojemu.`,
      );
    }
  }
}

// ─── 3. Zaszyte kolory motywu ────────────────────────────────────────────────

const HEX_RE = /#[0-9a-fA-F]{6}\b/;
for (const file of walk(componentsDir)) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const src = fs.readFileSync(file, "utf8");
  if (!HEX_RE.test(src)) continue;

  const exception = colorExceptions[rel];
  if (!exception) {
    errors.push(
      `${rel} zawiera zaszyty kolor (#rrggbb), a nie ma wpisu w "colorExceptions".\n` +
        `    Kolor MOTYWU zamień na zmienną (var(--accent-…), var(--on-accent)) — inaczej skórka go nie obejmie.\n` +
        `    Kolor będący DANYMI (paleta tagów, ilustracja) zadeklaruj:\n` +
        `      "${rel}": { "kind": "paleta-danych" | "ilustracja" | "do-poprawy", "reason": "…" }`,
    );
  } else if (!exception.reason) {
    errors.push(`${rel}: wpis w "colorExceptions" bez pola "reason".`);
  } else if (exception.kind === "do-poprawy") {
    warnings.push(`${rel} — ${exception.reason}`);
  }
}

// Wpisy, które przestały być potrzebne — manifest ma opisywać stan faktyczny.
for (const rel of Object.keys(colorExceptions)) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    errors.push(`"colorExceptions" wskazuje nieistniejący plik: ${rel} — usuń wpis.`);
  } else if (!HEX_RE.test(fs.readFileSync(full, "utf8"))) {
    errors.push(`${rel} nie ma już zaszytych kolorów — usuń wpis z "colorExceptions".`);
  }
}

// ─── Wynik ───────────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error("\n✖ Kontrakt widoku:\n");
  for (const e of errors) console.error(`  ${e}\n`);
  process.exit(1);
}

const total = migrated + pending;
console.log(
  `✓ Kontrakt widoku: ${migrated}/${total} modułów na ModuleView` +
    (pending > 0 ? `, ${pending} do migracji (jawnie odnotowane w manifeście)` : "") +
    `; ${Object.keys(colorExceptions).length} plików z zadeklarowanymi kolorami.`,
);

if (warnings.length > 0) {
  console.log(`\n  Dług do spłaty — kolory motywu oznaczone jako "do-poprawy" (${warnings.length}):`);
  for (const w of warnings) console.log(`    · ${w}`);
}
