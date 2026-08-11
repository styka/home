#!/usr/bin/env node
/**
 * Bramka PAMIĘCI TREŚCI generowanych przez AI (038).
 *
 * Problem, który rozwiązuje: właściciel poprosił, żeby treść wygenerowana przez model była
 * PAMIĘTANA, a nowa powstawała wyłącznie na wyraźne kliknięcie. Bez bramki pierwsza nowa funkcja
 * z LLM po cichu wróciłaby do generowania przy każdym wejściu na stronę — czyli do płacenia
 * wielokrotnie za to samo.
 *
 * Czego bramka NIE potrafi i dlatego nie próbuje: nie da się statycznie rozstrzygnąć, czy dane
 * wywołanie modelu produkuje TREŚĆ DO CZYTANIA (ma być pamiętana), czy jest NARZĘDZIEM NA ŻĄDANIE
 * (podpowiedz tagi, sparsuj tekst — tam kliknięcie już jest wyraźną akcją, a pamięć zwracałaby
 * nieaktualny wynik dla zmienionego wejścia). Dlatego wymagamy JAWNEJ klasyfikacji każdego pliku
 * w manifeście — dokładnie jak `action-coverage.json`. Bramka pilnuje kompletności, nie zgaduje
 * intencji.
 *
 * Skrypt jest czysto statyczny — nie dotyka bazy ani sieci.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const manifestPath = path.join(root, "src/lib/ai/content-memory-coverage.json");

/** Import któregokolwiek z tych symboli = plik faktycznie korzysta z pamięci treści. */
const MEMORY_MARKERS = ["rememberedContent", "forgetContent"];
/** Plik, w którym `chatComplete` jest DEFINIOWANE, nie jest jego konsumentem. */
// 049: warstwa LLM przeniosła się do platformy. Ścieżka jest sprawdzana przy starcie — bez tego
// przenosiny zamieniłyby wyłączenie w martwy wpis po cichu, a bramka zaczęłaby zgłaszać własną
// definicję jako brak (trzeci taki przypadek w tej przebudowie).
const SELF = new Set(["src/platform/llm/chat.ts"]);
for (const rel of SELF) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`\n✖ ${path.basename(__filename)}: wyłączenie wskazuje nieistniejący plik „${rel}".`);
    console.error("  Ścieżka definicji `chatComplete` się zmieniła — zaktualizuj SELF, nie usuwaj go.\n");
    process.exit(1);
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

if (!fs.existsSync(manifestPath)) {
  console.error(`\n✖ Pamięć treści AI: brak manifestu ${path.relative(root, manifestPath)}\n`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const missing = [];
const wrong = [];
const stale = new Set(Object.keys(manifest));
let remembered = 0;
let onDemand = 0;

for (const file of walk(srcDir)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (SELF.has(rel)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (!/\bchatComplete\s*\(|\bchatStream\s*\(/.test(text)) continue;

  stale.delete(rel);
  const entry = manifest[rel];
  if (!entry) {
    missing.push(rel);
    continue;
  }
  if (entry.mode !== "remembered" && entry.mode !== "on-demand") {
    wrong.push(`${rel} — "mode" musi być "remembered" albo "on-demand"`);
    continue;
  }
  if (!entry.reason) {
    wrong.push(`${rel} — brak pola "reason" (dlaczego taka klasyfikacja)`);
    continue;
  }
  if (entry.mode === "remembered") {
    if (!MEMORY_MARKERS.some((m) => text.includes(m))) {
      wrong.push(`${rel} — sklasyfikowany jako "remembered", ale nie używa rememberedContent`);
      continue;
    }
    remembered++;
  } else {
    onDemand++;
  }
}

if (missing.length > 0 || wrong.length > 0) {
  console.error("\n✖ Pamięć treści AI:");
  for (const m of missing) console.error(`  ${m} — brak klasyfikacji w manifeście`);
  for (const w of wrong) console.error(`  ${w}`);
  console.error(
    '\n  Dopisz do src/lib/ai/content-memory-coverage.json:\n' +
      '    "<ścieżka>": { "mode": "remembered" | "on-demand", "reason": "…" }\n' +
      '  → "remembered": treść DO CZYTANIA — owiń wywołanie w rememberedContent(...).\n' +
      '  → "on-demand": narzędzie odpalane kliknięciem, gdzie pamięć zwracałaby nieaktualny wynik.\n'
  );
  process.exit(1);
}

if (stale.size > 0) {
  console.error("\n✖ Pamięć treści AI: wpisy w manifeście dla plików, które nie wołają już modelu:");
  for (const s of stale) console.error(`  ${s}`);
  console.error("\n  Usuń nieaktualne wpisy z src/lib/ai/content-memory-coverage.json\n");
  process.exit(1);
}

console.log(
  `✓ Pamięć treści AI: ${remembered + onDemand} plików sklasyfikowanych ` +
    `(${remembered} z pamięcią treści, ${onDemand} narzędzi na żądanie).`
);
