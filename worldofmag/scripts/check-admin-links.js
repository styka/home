#!/usr/bin/env node
/**
 * Bramka KOMPLETNOŚCI ODNOŚNIKÓW W PANELU ADMINISTRATORA (110).
 *
 * Panel jest wyrzutnią — jego jedyne zadanie to prowadzić do narzędzi. Lista prowadzona ręcznie
 * rozjeżdża się po cichu i **już się rozjechała**: przed 110 `/admin/llm` (dostawcy i modele LLM)
 * nie miało odnośnika z żadnego miejsca w aplikacji, a `/admin/qa` wyłącznie z modułu QA. Objaw
 * jest żaden — strona działa, tylko nikt do niej nie trafia — więc pilnuje tego bramka, a nie
 * dyscyplina.
 *
 * Reguła, sprawdzana **w obie strony**:
 *   1. każdy katalog PIERWSZEGO POZIOMU pod `src/app/admin/` mający `page.tsx` ma wpis w rejestrze
 *      (`src/lib/admin/narzedzia.ts`) — inaczej powstała strona, do której nie da się dojść;
 *   2. każdy wpis rejestru wskazujący na `/admin/<id>` ma swój katalog na dysku — inaczej panel
 *      prowadzi donikąd.
 *
 * Pierwszy poziom, bo `/admin/qa/epic` i `/admin/qa/story` to podstrony narzędzia, nie osobne
 * narzędzia.
 *
 * Świadome wyjątki (strona celowo nielinkowana) idą do `src/lib/admin/linki-wyjatki.json`
 * z powodem; martwy wyjątek też wywala build — wzorzec `gating-wyjatki.json`.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const katalogTras = path.join(root, "src/app/admin");
const rejestrPath = path.join(root, "src/lib/admin/narzedzia.ts");
const wyjatkiPath = path.join(root, "src/lib/admin/linki-wyjatki.json");

/**
 * Wpisy czytamy z TEKSTU rejestru, tak samo jak robią to pozostałe bramki — skrypt jest zwykłym
 * node'em i nie ma czym wykonać TypeScriptu.
 *
 * Wzorzec obejmuje CAŁE wywołanie `n(...)` razem z opcjami, bo dopiero one mówią, czy pozycja
 * odpowiada katalogowi pod `/admin`: własny `href` (moderacja usług) i `akcja` (tryb wskazywania
 * elementu) wypadają ze zbioru porównywanego z dyskiem. Dopasowanie samego pierwszego argumentu
 * dawałoby fałszywe alarmy o katalogi, których z założenia nie ma.
 */
function wpisyRejestru(tresc) {
  const wpisy = [];
  const wzorzec = /\bn\(\s*"([a-z0-9-]+)"\s*,\s*[A-Za-z0-9_]+\s*(,\s*\{([^}]*)\})?\s*\)/g;
  for (const m of tresc.matchAll(wzorzec)) {
    const id = m[1];
    const opcje = m[3] ?? "";
    const maWlasnyHref = /href\s*:/.test(opcje);
    const maAkcje = /akcja\s*:/.test(opcje);
    wpisy.push({ id, podAdmin: !maWlasnyHref && !maAkcje });
  }
  return wpisy;
}

if (!fs.existsSync(rejestrPath)) {
  console.error(`\n✖ Odnośniki panelu: brak rejestru ${path.relative(root, rejestrPath)}.\n`);
  process.exit(1);
}

const wpisy = wpisyRejestru(fs.readFileSync(rejestrPath, "utf8"));
const wRejestrze = new Set(wpisy.filter((w) => w.podAdmin).map((w) => w.id));

const naDysku = fs
  .readdirSync(katalogTras, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("(") && !e.name.startsWith("_"))
  .filter((e) => fs.existsSync(path.join(katalogTras, e.name, "page.tsx")))
  .map((e) => e.name);

/**
 * Bramka, która przechodzi, bo NICZEGO nie znalazła, jest gorsza niż jej brak: ogłasza regułę,
 * której nikt nie egzekwuje. Zero tras albo zero wpisów to zawsze błąd konfiguracji skryptu.
 */
if (naDysku.length === 0 || wRejestrze.size === 0) {
  console.error(
    `\n✖ Odnośniki panelu: nic do porównania (tras na dysku: ${naDysku.length}, wpisów w rejestrze: ${wRejestrze.size}).` +
      `\n  To błąd bramki albo przeniesienie plików — nie zielone światło.\n`,
  );
  process.exit(1);
}

const wyjatki = fs.existsSync(wyjatkiPath) ? JSON.parse(fs.readFileSync(wyjatkiPath, "utf8")).trasy ?? {} : {};
const martweWyjatki = new Set(Object.keys(wyjatki));
const bledy = [];

for (const trasa of naDysku) {
  if (wRejestrze.has(trasa)) continue;
  if (wyjatki[trasa]) {
    martweWyjatki.delete(trasa);
    if (String(wyjatki[trasa]).length < 25) {
      bledy.push(`/admin/${trasa} — wyjątek bez sensownego powodu.`);
    }
    continue;
  }
  bledy.push(
    `/admin/${trasa} — strona panelu BEZ ODNOŚNIKA. Dopisz ją do GRUPY_NARZEDZI ` +
      `w src/lib/admin/narzedzia.ts (albo, jeśli ma być nielinkowana, do ${path.relative(root, wyjatkiPath)} z powodem).`,
  );
}

for (const id of wRejestrze) {
  if (!naDysku.includes(id)) {
    bledy.push(`/admin/${id} — rejestr prowadzi do trasy, której nie ma na dysku (martwy odnośnik).`);
  }
}

for (const martwy of martweWyjatki) {
  bledy.push(`${martwy} — wyjątek bez trasy; usuń go z ${path.relative(root, wyjatkiPath)}.`);
}

if (bledy.length > 0) {
  console.error("\n✖ Odnośniki panelu administratora:");
  for (const b of bledy) console.error(`  ${b}`);
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Odnośniki panelu: ${naDysku.length} tras /admin/* — każda ma wejście z panelu ` +
    `(${wpisy.length} pozycji w rejestrze, w tym ${wpisy.length - wRejestrze.size} spoza /admin).`,
);
