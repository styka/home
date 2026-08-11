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

// 049: katalog akcji NIE jest już mapą w jednym pliku — każdy moduł wnosi swój blok, a całość
// składa się z deklaracji (rozdz. 9.6). Bramka pilnuje przez to własności MOCNIEJSZEJ niż dotąd:
// nie „czy ręczna lista jest kompletna", lecz „czy każdy moduł zadeklarował swoje akcje i czy
// każda ma egzekutor". Modułu nie da się zapomnieć, bo moduł bez deklaracji nie istnieje.
const agentSrc = read("src/lib/ai/agentPrompt.ts");

// W katalogu `ai/` modułu pliki mają role: `executor.ts` wykonuje, `readTools.ts` czyta,
// `index.ts` składa wkład — a WSZYSTKO POZOSTAŁE to tekst katalogu akcji (dziś `catalog.ts`,
// w module Zwierzęta dodatkowo `petActions.ts`). Rola wynika z nazwy, więc nowy plik z katalogiem
// zostanie znaleziony bez dopisywania go tutaj.
const ROLE_EXECUTOR = "executor.ts";
const ROLE_POZOSTALE = new Set([ROLE_EXECUTOR, "readTools.ts", "index.ts"]);

// Powierzchnia executora = route + wszystkie wyodrębnione handlery per-domena
// (src/lib/ai/executors/*.ts). Z-010 rozbija monolit execute/route.ts na moduły;
// check musi podążać za przeniesionymi `type === "..."`, więc skanujemy oba.
let execSrc = read("src/app/api/llm/home/execute/route.ts");

// Moduły są WYPROWADZANE Z SYSTEMU PLIKÓW, a nie z listy nazw: bramka ma znaleźć moduł,
// o którym nikt jej nie powiedział.
const modulesDir = path.join(root, "src/modules");
let modulowyKatalog = "";
const bezDeklaracji = [];
for (const m of fs.existsSync(modulesDir) ? fs.readdirSync(modulesDir) : []) {
  const aiDir = path.join(modulesDir, m, "ai");
  if (!fs.existsSync(aiDir)) continue;
  let maKatalog = false;
  for (const f of fs.readdirSync(aiDir)) {
    if (!f.endsWith(".ts")) continue;
    const tresc = fs.readFileSync(path.join(aiDir, f), "utf8");
    if (f === ROLE_EXECUTOR) execSrc += "\n" + tresc;
    else if (!ROLE_POZOSTALE.has(f)) { modulowyKatalog += "\n" + tresc; maKatalog = true; }
  }
  // Moduł, który wnosi katalog akcji, MUSI deklarować pole `ai` — inaczej jego akcje istnieją
  // w kodzie i nie istnieją dla asystenta, a to jest gorsze niż ich brak.
  const decl = path.join(modulesDir, m, "module.ts");
  if (maKatalog && fs.existsSync(decl) && !/\bai:\s*\(\)\s*=>/.test(fs.readFileSync(decl, "utf8"))) {
    bezDeklaracji.push(m);
  }
}

if (bezDeklaracji.length > 0) {
  console.error("\n✖ Spójność akcji asystenta: moduły z katalogiem akcji BEZ pola `ai` w deklaracji:");
  console.error("  " + bezDeklaracji.join(", "));
  console.error("\n  Ich akcje istnieją w kodzie, ale asystent ich nie zobaczy — katalog składa się");
  console.error("  wyłącznie z deklaracji. Dopisz `ai: () => import(\"./ai\")` w module.ts.\n");
  process.exit(1);
}

// Katalog akcji: tylko segment ACTION_CATALOG (między deklaracją a NAVIGATION_CATALOG)
// + pełny katalog akcji zwierząt (petActions.ts).
const catStart = agentSrc.indexOf("const ACTION_CATALOG_HEADER");
const catEnd = agentSrc.indexOf("const NAVIGATION_CATALOG");
const catalogText = agentSrc.slice(catStart, catEnd) + modulowyKatalog;

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

// 031: KONTRAKT AKCJI — każdy typ akcji musi mieć wpis w `src/lib/ai/actionContract.ts`.
// Bez wpisu panel „Przejrzyj / popraw" pokazałby użytkownikowi techniczną nazwę akcji i surowe
// wartości parametrów (id, enumy), a walidacja serwerowa nie miałaby reguł do sprawdzenia.
// Skan jest statyczny: bierzemy klucze najwyższego poziomu z obiektu ACTION_CONTRACTS.
const contractSrc = read("src/lib/ai/actionContract.ts");
const cStart = contractSrc.indexOf("export const ACTION_CONTRACTS");
const cEnd = contractSrc.indexOf("\n};", cStart);
const contracted = new Set();
if (cStart !== -1 && cEnd !== -1) {
  for (const m of contractSrc.slice(cStart, cEnd).matchAll(/^ {2}([a-z][a-z0-9_]*):/gm)) {
    contracted.add(m[1]);
  }
}

const noContract = [...new Set([...catalog, ...handled])].filter((t) => !contracted.has(t)).sort();
if (noContract.length > 0) {
  console.error("\n✖ Kontrakt akcji: akcje BEZ wpisu w src/lib/ai/actionContract.ts:");
  console.error("  " + noContract.join(", "));
  console.error(
    "\n  Dopisz do ACTION_CONTRACTS wpis `<typ>: { label: \"<polska nazwa akcji>\", fields: { … } }`.\n" +
      "  `label` jest obowiązkowy (widzi go użytkownik zamiast technicznej nazwy); `fields` opisuj tylko\n" +
      "  tam, gdzie pole potrzebuje innej kontrolki niż tekst (wybór wartości / data / liczba / tak-nie).\n"
  );
  process.exit(1);
}

// 034: KOMPLETNOŚĆ ETYKIET PARAMETRÓW — użytkownik nie może zobaczyć w panelu „Przejrzyj / popraw"
// technicznej nazwy pola (zgłoszenie: parametr `groupName` zamiast „Grupa notatek"). Wyciągamy nazwy
// parametrów z sygnatur katalogu (`- akcja { p1, p2?, p3:"A"|"B" }`) i żądamy, by każda miała opis
// po polsku: albo w `PARAM_LABELS`, albo w `fields` kontraktu SWOJEJ akcji.
// Wyjątki: `…Id` (i tak ukrywane), `openAfter`/`searchQuery` (metaparametry opisane osobno).
const PARAM_EXEMPT = new Set(["openAfter", "searchQuery"]);

const paramsByAction = new Map();
for (const m of catalogText.matchAll(/^\s*-\s+([a-z][a-z0-9_]*)\s*\{([^}]*)\}/gm)) {
  const [, action, body] = m;
  const names = paramsByAction.get(action) ?? new Set();
  for (const part of body.split(",")) {
    const nm = part.trim().match(/^([a-zA-Z][a-zA-Z0-9_]*)/);
    if (nm) names.add(nm[1]);
  }
  paramsByAction.set(action, names);
}

// Wspólny słownik etykiet.
const paramLabels = new Set();
const plStart = contractSrc.indexOf("export const PARAM_LABELS");
const plEnd = contractSrc.indexOf("\n};", plStart);
if (plStart !== -1 && plEnd !== -1) {
  for (const m of contractSrc.slice(plStart, plEnd).matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9_]*):/gm)) {
    paramLabels.add(m[1]);
  }
}

// Etykiety per akcja: blok `<akcja>: { label: "…", fields: { <pole>: … } }` w ACTION_CONTRACTS.
const fieldsByAction = new Map();
if (cStart !== -1 && cEnd !== -1) {
  const body = contractSrc.slice(cStart, cEnd);
  for (const m of body.matchAll(/^ {2}([a-z][a-z0-9_]*):\s*\{([\s\S]*?)\n {2}\},?$/gm)) {
    const [, action, entry] = m;
    const fieldsIdx = entry.indexOf("fields:");
    if (fieldsIdx === -1) continue;
    const names = new Set();
    for (const f of entry.slice(fieldsIdx).matchAll(/([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*(?:f|sel|num|bool|day|dt|longText)\(/g)) {
      names.add(f[1]);
    }
    fieldsByAction.set(action, names);
  }
}

const unlabelled = [];
for (const [action, names] of paramsByAction) {
  for (const name of names) {
    if (/Id$/.test(name) || PARAM_EXEMPT.has(name)) continue;
    if (paramLabels.has(name)) continue;
    if (fieldsByAction.get(action)?.has(name)) continue;
    unlabelled.push(`${action}.${name}`);
  }
}

if (unlabelled.length > 0) {
  console.error("\n✖ Kontrakt akcji: parametry BEZ polskiej etykiety (użytkownik zobaczyłby nazwę z kodu):");
  console.error("  " + unlabelled.sort().join(", "));
  console.error(
    "\n  Dopisz etykietę do `PARAM_LABELS` w src/lib/ai/actionContract.ts (gdy nazwa znaczy to samo\n" +
      "  w wielu akcjach) albo do `fields` konkretnej akcji (gdy potrzebuje własnej etykiety/kontrolki).\n"
  );
  process.exit(1);
}

console.log(
  `✓ Spójność akcji asystenta: ${catalog.size} akcji w katalogu, wszystkie obsługiwane przez executor ` +
    `i opisane w kontrakcie (${contracted.size} wpisów); ` +
    `${[...paramsByAction.values()].reduce((n, s) => n + s.size, 0)} parametrów z etykietami po polsku.`
);
