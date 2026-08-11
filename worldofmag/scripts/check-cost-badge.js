#!/usr/bin/env node
/**
 * Bramka WIDOCZNOŚCI KOSZTU wywołań modelu (037).
 *
 * Problem, który rozwiązuje: koszt treści generowanej przez AI jest widoczny tylko tam, gdzie ktoś
 * pamiętał, żeby przepuścić zużycie z `chatComplete` do odpowiedzi. Nic tego nie pilnowało, więc
 * pierwsza nowa funkcja z LLM po cichu wróciłaby do stanu „nie wiadomo, ile to kosztowało" — a
 * dokładnie tego dotyczyło zgłoszenie właściciela.
 *
 * Reguła: KAŻDY plik, który woła `chatComplete(` albo `chatStream(`, musi albo produkować zużycie
 * (import `usageFromChat` / `usageField` / `visibleUsage` / `accrueUsage`), albo mieć świadomy wpis
 * w `src/lib/ai/cost-badge-coverage.json` z powodem.
 *
 * Skrypt jest czysto statyczny — nie dotyka bazy ani sieci.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const manifestPath = path.join(root, "src/lib/ai/cost-badge-coverage.json");

// Import któregokolwiek z tych symboli oznacza, że plik zajmuje się zużyciem modelu.
const PRODUCERS = ["usageFromChat", "usageField", "visibleUsage", "accrueUsage", "readCostBadgeEnabled"];
// Plik, w którym `chatComplete` jest DEFINIOWANE, nie jest jego konsumentem.
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
      // `src/generated` to pliki budowane ze źródeł treści (książki audytu) — bywa, że zawierają
      // przykłady kodu w tekście rozdziału. To nie jest kod wykonawczy.
      if (entry.name === "generated" || entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const missing = [];
const stale = new Set(Object.keys(manifest));
let ok = 0;

for (const file of walk(srcDir)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (SELF.has(rel)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (!/\bchatComplete\s*\(|\bchatStream\s*\(/.test(text)) continue;

  stale.delete(rel);
  if (PRODUCERS.some((p) => text.includes(p))) {
    ok++;
    continue;
  }
  if (manifest[rel]) {
    if (!manifest[rel].reason) {
      missing.push(`${rel} — wpis w manifeście bez pola "reason"`);
    } else {
      ok++;
    }
    continue;
  }
  missing.push(rel);
}

if (missing.length > 0) {
  console.error("\n✖ Licznik kosztu AI: wywołania modelu BEZ przekazania zużycia:");
  for (const m of missing) console.error(`  ${m}`);
  console.error(
    "\n  Dopisz zużycie do odpowiedzi (`usageField(result)` w trasie, `usageFromChat` w akcji/handlerze),\n" +
      "  albo — jeśli to niemożliwe (np. czysty strumień) — dodaj wpis z powodem do\n" +
      "  src/lib/ai/cost-badge-coverage.json:  { \"<ścieżka>\": { \"reason\": \"…\" } }\n"
  );
  process.exit(1);
}

if (stale.size > 0) {
  console.error("\n✖ Licznik kosztu AI: wpisy w manifeście dla plików, które nie wołają już modelu:");
  for (const s of stale) console.error(`  ${s}`);
  console.error("\n  Usuń nieaktualne wpisy z src/lib/ai/cost-badge-coverage.json\n");
  process.exit(1);
}

console.log(`✓ Licznik kosztu AI: ${ok} plików wołających model, każdy przekazuje zużycie lub ma świadomy wyjątek.`);
