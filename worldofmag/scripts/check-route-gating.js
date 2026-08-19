#!/usr/bin/env node
/**
 * Bramka KONTROLI UPRAWNIENIA NA TRASIE MODUŁU (098; rozdz. 12.2).
 *
 * Nawigacja wygasza pozycje, do których użytkownik nie ma uprawnienia — ale to jest **wyłącznie
 * wygląd**. Adres wpisany z ręki omija menu, więc kontrola musi stać na trasie.
 *
 * Do 098 stała na piętnastu z dziewiętnastu tras modułowych. `/kitchen`, `/notes`, `/shopping`
 * i `/tasks` — cztery najczęściej używane moduły — sprawdzały wyłącznie ZALOGOWANIE. Klikacz
 * mówił o tym wprost (`[scenario-direct-url-blocked]`), tylko że padał wśród sześćdziesięciu
 * innych czerwonych i przez to nie niósł żadnej informacji.
 *
 * Reguła: moduł, który zadeklarował `permission` i `href`, musi mieć na tej trasie wywołanie
 * `wymagajDostepuDoModulu(...)` albo `hasPermission(...)` — w `layout.tsx` (lepiej, bo obejmuje
 * podtrasy) albo w `page.tsx`.
 *
 * Wyjątek dostaje moduł, którego trasa jest **z założenia** dostępna dla każdego zalogowanego
 * (Raporty) — z powodem w `src/lib/ui/gating-wyjatki.json`. Martwy wpis wywala build.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const wyjatkiPath = path.join(root, "src/lib/ui/gating-wyjatki.json");
/**
 * Wzorzec musi trafiać w WYWOŁANIE, nie w import. Pierwsza wersja szukała samej nazwy — próba
 * mutacyjna (usunięcie wywołania przy zostawionym imporcie) przeszła przez bramkę, czyli bramka
 * pilnowała obecności linijki `import`, a nie kontroli dostępu.
 */
const WZORZEC = /(?:wymagajDostepuDoModulu|hasPermission|isPathLocked)\s*\(/;
/** Treść pliku bez linii importu — patrz wyżej. */
function bezImportow(t) {
  return t
    .split("\n")
    .filter((l) => !/^\s*import\b/.test(l))
    .join("\n");
}

const wyjatki = fs.existsSync(wyjatkiPath) ? JSON.parse(fs.readFileSync(wyjatkiPath, "utf8")).moduly ?? {} : {};
const martwe = new Set(Object.keys(wyjatki));
const bledy = [];
let sprawdzonych = 0;

for (const m of fs.readdirSync(path.join(root, "src/modules"))) {
  const deklaracja = path.join(root, "src/modules", m, "module.ts");
  if (!fs.existsSync(deklaracja)) continue;
  const tresc = fs.readFileSync(deklaracja, "utf8");
  const permission = (tresc.match(/permission:\s*"([^"]+)"/) || [])[1];
  const href = (tresc.match(/href:\s*"([^"]+)"/) || [])[1];
  // Strona główna (`/`) jest korzeniem powłoki — jej bramką jest samo zalogowanie.
  if (!permission || !href || href === "/") continue;

  if (wyjatki[m]) {
    martwe.delete(m);
    if (!wyjatki[m] || String(wyjatki[m]).length < 25) bledy.push(`${m} — wyjątek bez sensownego powodu.`);
    continue;
  }

  sprawdzonych++;
  const katalog = path.join(root, "src/app", href.replace(/^\//, ""));
  const kandydaci = ["layout.tsx", "page.tsx"].map((f) => path.join(katalog, f)).filter((f) => fs.existsSync(f));
  if (kandydaci.length === 0) {
    bledy.push(`${m} — deklaruje \`href: "${href}"\`, a pod \`src/app${href}\` nie ma ani layoutu, ani strony.`);
    continue;
  }
  if (!kandydaci.some((f) => WZORZEC.test(bezImportow(fs.readFileSync(f, "utf8"))))) {
    bledy.push(
      `${m} — trasa \`${href}\` nie sprawdza uprawnienia \`${permission}\`. Dodaj ` +
        `\`await wymagajDostepuDoModulu(${m}Module.permission)\` w \`src/app${href}/layout.tsx\` ` +
        `(layout obejmuje też podtrasy).`,
    );
  }
}

for (const m of martwe) bledy.push(`${m} — martwy wpis w ${path.relative(root, wyjatkiPath)}. Usuń go.`);

if (bledy.length) {
  console.error("\n✖ Trasy modułów bez kontroli uprawnienia:\n");
  for (const b of bledy) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ Gating tras: ${sprawdzonych} tras modułowych sprawdza uprawnienie (${Object.keys(wyjatki).length} świadomych wyjątków).`);
