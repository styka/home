#!/usr/bin/env node
/**
 * Bramka OCZEKIWANIA NA BEZCZYNNĄ SIEĆ W KLIKACZU (098).
 *
 * Od 072 aplikacja trzyma otwarty strumień zdarzeń (`/api/events`, SSE) — z założenia, bo to on
 * zastąpił odpytywanie co 45 s. Skutek uboczny dotyczy testów: **sieć nigdy nie jest bezczynna**,
 * więc `page.waitForLoadState("networkidle")` nie doczeka się nigdy i test kończy się limitem
 * czasu. Nie „czasem", nie „na wolnej maszynie" — nigdy.
 *
 * Tak przestało działać 35 oczekiwań w siedmiu specach. Objaw był mylący: testy padały
 * z „Test timeout of 60000ms exceeded" w miejscu, które z ich treścią nie miało nic wspólnego,
 * więc wyglądały na wolne, a nie na niemożliwe do spełnienia.
 *
 * Zamiast `networkidle` używaj `"load"` albo — lepiej — poczekaj na konkretny element
 * (`expect(locator).toBeVisible()`), bo to jest to, o co testowi naprawdę chodzi.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const bledy = [];

function pliki(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) {
      if (["node_modules", "test-results", "playwright-report"].includes(w.name)) continue;
      pliki(p, out);
    } else if (/\.ts$/.test(w.name)) out.push(p);
  }
  return out;
}

for (const abs of pliki(path.join(root, "e2e"))) {
  const rel = path.relative(root, abs).split(path.sep).join("/");
  const tresc = fs
    .readFileSync(abs, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
  for (const m of tresc.matchAll(/["']networkidle["']/g)) {
    bledy.push(
      `${rel}:${tresc.slice(0, m.index).split("\n").length} — \`networkidle\` nigdy nie nastąpi: ` +
        `aplikacja trzyma otwarty strumień SSE. Użyj \`"load"\` albo poczekaj na konkretny element.`,
    );
  }
}

if (bledy.length) {
  console.error("\n✖ Klikacz czeka na bezczynną sieć, która nigdy nie nastąpi:\n");
  for (const b of bledy) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}
console.log("✓ Klikacz: żaden test nie czeka na `networkidle` (strumień SSE nigdy go nie dopuści).");
