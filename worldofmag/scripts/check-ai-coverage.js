#!/usr/bin/env node
/**
 * Bramka POKRYCIA akcji użytkownika przez asystenta AI.
 *
 * Problem, który rozwiązuje: możliwości asystenta (katalog w prompt'cie + egzekutory)
 * są utrzymywane RĘCZNIE i osobno od Server Actions (`src/actions/*`), którymi
 * użytkownik dysponuje ręcznie w UI. `check-action-coverage.js` pilnuje tylko
 * spójności katalog↔egzekutor. NIC nie pilnowało, czy KAŻDA akcja użytkownika jest
 * w ogóle wystawiona dla AI — dlatego np. „otaguj zadanie" (updateTaskTags) długo
 * nie istniało po stronie asystenta.
 *
 * Ten skrypt wymusza świadomą decyzję dla KAŻDEJ mutującej Server Action:
 *   - "ai"       → wystawiona dla asystenta (jest egzekutor + wpis w katalogu),
 *   - "pending"  → powinna być wystawiona, ale jeszcze nie jest (lista luk / roadmapa),
 *   - "excluded" → świadomie NIE dla AI (z powodem: admin/settings/internal/…).
 *
 * Źródło prawdy klasyfikacji: `src/lib/ai/action-coverage.json`.
 * Gdy ktoś doda NOWĄ mutującą Server Action i jej NIE sklasyfikuje — build PADA,
 * więc nowa możliwość użytkownika nie „prześlizgnie się" bez rozważenia dla AI.
 *
 * Skrypt jest czysto statyczny (czyta pliki źródłowe) — nie dotyka bazy ani sieci.
 * Flaga `--report` dopisuje/aktualizuje czytelny raport luk w docs/ai/pokrycie-akcji.md.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const actionsDir = path.join(root, "src/actions");
const manifestPath = path.join(root, "src/lib/ai/action-coverage.json");

// Prefiksy nazw = ODCZYT lub wewnętrzny helper (nie akcja użytkownika do wystawienia).
const READ = /^(get|list|assert|ensure|find|preview|describe|has|is|count|resolve|read|search)/;
const SKIP_EXTRA = new Set(["healthAiAllowed", "evaluateWatchers", "getOrCreateInbox"]);
const VALID = new Set(["ai", "pending", "excluded"]);

// Zbierz mutujące Server Actions (kandydatów do pokrycia AI) jako klucze `plik:funkcja`.
function collectCandidates() {
  const out = [];
  for (const f of fs.readdirSync(actionsDir)) {
    if (!f.endsWith(".ts")) continue;
    const mod = f.replace(/\.ts$/, "");
    const src = fs.readFileSync(path.join(actionsDir, f), "utf8");
    for (const m of src.matchAll(/export async function ([a-zA-Z0-9_]+)/g)) {
      const fn = m[1];
      if (READ.test(fn) || SKIP_EXTRA.has(fn)) continue;
      out.push(`${mod}:${fn}`);
    }
  }
  return out.sort();
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const candidates = collectCandidates();
const candidateSet = new Set(candidates);

// 1) Każdy kandydat MUSI mieć wpis o poprawnym statusie.
const unclassified = [];
const badStatus = [];
for (const key of candidates) {
  const entry = manifest[key];
  if (!entry) { unclassified.push(key); continue; }
  if (!VALID.has(entry.status)) badStatus.push(`${key} (status="${entry.status}")`);
}

// 2) Wpisy w manifeście, które nie odpowiadają już żadnej akcji (przestarzałe) — ostrzeżenie.
const stale = Object.keys(manifest).filter((k) => !k.startsWith("__") && !candidateSet.has(k)).sort();

const counts = { ai: 0, pending: 0, excluded: 0 };
for (const key of candidates) {
  const s = manifest[key]?.status;
  if (counts[s] !== undefined) counts[s]++;
}
const pending = candidates.filter((k) => manifest[k]?.status === "pending");

// --report: zapisz czytelny raport luk (roadmapa integracji z AI).
if (process.argv.includes("--report")) {
  const byModule = {};
  for (const key of candidates) {
    const [mod, fn] = key.split(":");
    const st = manifest[key]?.status ?? "?";
    (byModule[mod] ??= []).push({ fn, st, reason: manifest[key]?.reason, action: manifest[key]?.action });
  }
  let md = `# Pokrycie akcji użytkownika przez asystenta AI\n\n`;
  md += `> Plik generowany przez \`scripts/check-ai-coverage.js --report\`. Nie edytuj ręcznie.\n\n`;
  md += `Stan: **${counts.ai} wystawionych (ai)**, **${counts.pending} do zrobienia (pending)**, `;
  md += `**${counts.excluded} świadomie wykluczonych (excluded)** — razem ${candidates.length} mutujących akcji.\n\n`;
  md += `Legenda statusów: \`ai\` = asystent to potrafi · \`pending\` = luka do domknięcia · \`excluded\` = nie dla AI (admin/ustawienia/wewnętrzne/interaktywne).\n\n`;
  for (const mod of Object.keys(byModule).sort()) {
    const rows = byModule[mod];
    const ai = rows.filter((r) => r.st === "ai").length;
    md += `## ${mod} — ${ai}/${rows.length} wystawionych\n\n`;
    md += `| Akcja | Status | Uwaga |\n|---|---|---|\n`;
    for (const r of rows.sort((a, b) => a.fn.localeCompare(b.fn))) {
      const tag = r.st === "ai" ? "✅ ai" : r.st === "pending" ? "🕓 pending" : "⛔ excluded";
      md += `| \`${r.fn}\` | ${tag} | ${r.action ? "→ " + r.action : r.reason ?? ""} |\n`;
    }
    md += `\n`;
  }
  const outDir = path.join(root, "docs/ai");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "pokrycie-akcji.md"), md);
  console.log("✓ Zapisano raport: docs/ai/pokrycie-akcji.md");
}

if (badStatus.length) {
  console.error("\n✖ Pokrycie AI: wpisy z nieprawidłowym statusem (dozwolone: ai|pending|excluded):");
  console.error("  " + badStatus.join("\n  "));
}
if (unclassified.length) {
  console.error("\n✖ Pokrycie AI: nowe mutujące Server Actions BEZ klasyfikacji w src/lib/ai/action-coverage.json:");
  console.error("  " + unclassified.join("\n  "));
  console.error("\n  Dodaj wpis {\"status\":\"ai|pending|excluded\", ...} dla każdej z nich.");
  console.error("  → \"ai\": wystaw akcję dla asystenta (egzekutor + katalog). \"pending\": luka do zrobienia.");
  console.error("  → \"excluded\": nie dla AI — podaj \"reason\" (admin/settings/internal/interactive/teams/account).\n");
}
if (badStatus.length || unclassified.length) process.exit(1);

if (stale.length) {
  console.warn("⚠ Pokrycie AI: przestarzałe wpisy w manifeście (akcja już nie istnieje): " + stale.join(", "));
}

console.log(
  `✓ Pokrycie AI: ${candidates.length} mutujących akcji sklasyfikowanych — ` +
    `${counts.ai} ai, ${counts.pending} pending, ${counts.excluded} excluded.`
);
