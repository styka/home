#!/usr/bin/env node
/**
 * Guard spójności akcji „magicznej ikony".
 *
 * Agent (`agent/route.ts`) proponuje akcje wg ręcznie pisanego katalogu (string),
 * a executor (`execute/route.ts`) wykonuje je łańcuchem `if (type === "...")`.
 * Te dwie powierzchnie są utrzymywane osobno — łatwo o rozjazd: agent zaproponuje
 * akcję, której executor nie zna → użytkownik dostaje „Nieznany typ akcji" w runtime.
 *
 * Ten skrypt wyłuskuje nazwy akcji z katalogu (agent + petActions) i z executora,
 * po czym sprawdza, że KAŻDA akcja z katalogu ma obsługę w executorze. Odpala się
 * w pipelinie buildu (przed `next build`), więc rozjazd wywala build, nie produkcję.
 * Jest czysto statyczny (czyta pliki źródłowe) — nie dotyka bazy ani sieci.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const agentSrc = read("src/app/api/llm/home/agent/route.ts");
const petSrc = read("src/lib/ai/petActions.ts");

// Powierzchnia executora = route + wszystkie wyodrębnione handlery per-domena
// (src/lib/ai/executors/*.ts). Z-010 rozbija monolit execute/route.ts na moduły;
// check musi podążać za przeniesionymi `type === "..."`, więc skanujemy oba.
let execSrc = read("src/app/api/llm/home/execute/route.ts");
const execDir = path.join(root, "src/lib/ai/executors");
if (fs.existsSync(execDir)) {
  for (const f of fs.readdirSync(execDir)) {
    if (f.endsWith(".ts")) execSrc += "\n" + read(`src/lib/ai/executors/${f}`);
  }
}

// Katalog akcji: tylko segment ACTION_CATALOG (między deklaracją a NAVIGATION_CATALOG)
// + pełny katalog akcji zwierząt (petActions.ts).
const catStart = agentSrc.indexOf("const ACTION_CATALOG");
const catEnd = agentSrc.indexOf("const NAVIGATION_CATALOG");
const catalogText = agentSrc.slice(catStart, catEnd) + "\n" + petSrc;

// Usuwamy najpierw zawartość sygnatur `{ ... }` i nawiasów `( ... )` (tam żyją nazwy
// PARAMETRÓW i komentarze, nie akcje), a z reszty bierzemy tokeny snake_case — to są
// nazwy akcji (etykiety modułów są UPPERCASE, separatory to "·"/"-"). Dzięki temu
// łapiemy też pierwszą akcję w liniach "DODATKOWE AKCJE" (po "MODUŁ:") i pety.
const stripped = catalogText.replace(/\{[^{}]*\}/g, " ").replace(/\([^()]*\)/g, " ");
const catalog = new Set();
for (const m of stripped.matchAll(/\b([a-z]+_[a-z_]+)\b/g)) {
  catalog.add(m[1]);
}
// web_search to narzędzie ODCZYTU (nie akcja zapisu) — gdyby trafiło do tekstu, pomiń.
catalog.delete("web_search");

// Obsłużone w executorze: każde `type === "..."`.
const handled = new Set();
for (const m of execSrc.matchAll(/type === "([a-z_]+)"/g)) {
  handled.add(m[1]);
}

const missing = [...catalog].filter((t) => !handled.has(t)).sort();
const orphan = [...handled].filter((t) => !catalog.has(t)).sort();

if (missing.length > 0) {
  console.error("\n✖ Spójność akcji asystenta: katalog agenta proponuje akcje BEZ obsługi w executorze:");
  console.error("  " + missing.join(", "));
  console.error("\n  Dodaj obsługę w src/app/api/llm/home/execute/route.ts albo usuń je z katalogu w agent/route.ts.\n");
  process.exit(1);
}

if (orphan.length > 0) {
  // Niegroźne (executor obsługuje akcję, której agent nigdy nie zaproponuje),
  // ale zwykle to literówka/zapomniany wpis w katalogu — zgłaszamy jako ostrzeżenie.
  console.warn("⚠ Spójność akcji asystenta: executor obsługuje akcje spoza katalogu agenta (ostrzeżenie): " + orphan.join(", "));
}

console.log(`✓ Spójność akcji asystenta: ${catalog.size} akcji w katalogu, wszystkie obsługiwane przez executor.`);
