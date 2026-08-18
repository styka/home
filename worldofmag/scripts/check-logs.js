#!/usr/bin/env node
/**
 * Bramka LOGÓW STRUKTURALNYCH (086, zadanie 31).
 *
 * Rozdz. 11.7 wymaga logów w JSON-ie z ustalonym składem pól. Warstwa `platform/observability/log.ts`
 * to zapewnia — ale tylko dla tych, którzy z niej korzystają. Jedno `console.warn` w kodzie
 * serwerowym psuje więcej, niż widać: strumień przestaje być w połowie parsowalny, a agregator nie
 * umie już odpowiedzieć na pytanie „ile błędów w module X", bo część zdarzeń nie ma modułu.
 *
 * Bramka pilnuje więc jednej rzeczy: **w kodzie serwerowym nie ma surowego `console.*`**.
 *
 * Czego świadomie NIE obejmuje:
 *  - komponenty klienckie (`"use client"`) — tam `console` jest narzędziem diagnostycznym
 *    przeglądarki, a nie strumieniem logów serwera; ich błędy idą przez `reportClientError`;
 *  - testy — log w teście czyta człowiek, nie agregator;
 *  - sam `log.ts`, który `console` **definiuje**; ścieżka jest sprawdzana, żeby przenosiny pliku
 *    nie zamieniły wyłączenia w martwy wpis (trzeci taki przypadek w tej przebudowie — patrz
 *    `check-cost-badge.js`).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");

const SELF = new Set(["src/platform/observability/log.ts"]);
for (const rel of SELF) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`\n✖ ${path.basename(__filename)}: wyłączenie wskazuje nieistniejący plik „${rel}".`);
    console.error("  Ścieżka warstwy logów się zmieniła — zaktualizuj SELF, nie usuwaj go.\n");
    process.exit(1);
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// `console.` w treści tekstu (np. „console.groq.com" w podpowiedzi dla administratora) nie jest
// wywołaniem. Wzorzec wymaga nawiasu tuż po nazwie metody — filtr po ZNACZENIU, nie po napisie.
const WYWOLANIE = /\bconsole\.(log|info|warn|error|debug|trace|table|dir)\s*\(/;

const znalezione = [];
let sprawdzonych = 0;

for (const file of walk(srcDir)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (SELF.has(rel)) continue;
  const text = fs.readFileSync(file, "utf8");
  // Komponent kliencki działa w przeglądarce — to nie jest strumień logów serwera.
  if (/^\s*["']use client["']/m.test(text.split("\n").slice(0, 3).join("\n"))) continue;
  sprawdzonych++;
  const linie = text.split("\n");
  for (let i = 0; i < linie.length; i++) {
    if (WYWOLANIE.test(linie[i])) znalezione.push(`${rel}:${i + 1}  ${linie[i].trim().slice(0, 100)}`);
  }
}

if (znalezione.length > 0) {
  console.error("\n✖ Logi strukturalne: surowe `console.*` w kodzie serwerowym:");
  for (const z of znalezione) console.error(`  ${z}`);
  console.error(
    "\n  Użyj `logEvent(level, event, pola)` z @/platform/observability/log — rekord dostaje wtedy\n" +
      "  znacznik czasu, kontekst (requestId/userId/workspaceId/module) i ochronę przed PII.\n" +
      "  Dla wyjątków: `reportServerError`. Dla operacji mierzonych w czasie: `timed`.\n"
  );
  process.exit(1);
}

console.log(`✓ Logi strukturalne: ${sprawdzonych} plików serwerowych bez surowego \`console.*\`.`);
