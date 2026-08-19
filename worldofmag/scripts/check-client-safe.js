#!/usr/bin/env node
/**
 * Bramka KODU, KTÓRY WYWRACA SIĘ PRZY IMPORCIE W PRZEGLĄDARCE (098).
 *
 * `next.config.mjs` podmienia `async_hooks` na **pusty moduł** w grafie klienta — bo moduł ten trafia
 * tam nie przez użycie, tylko przez barierę barelową (klient importuje Server Action z kontraktu,
 * a kontrakt jest rozwiązywany w całości). Podmiana jest poprawna: zakres operacji w przeglądarce
 * nie ma sensu i ta gałąź nigdy tam nie biegnie.
 *
 * Ale „nie biegnie" dotyczy WYWOŁANIA, nie IMPORTU. `const x = new AsyncLocalStorage()` w zasięgu
 * modułu wykonuje się w chwili zaimportowania pliku — także wtedy, gdy nikt tej zmiennej nie użyje.
 * W przeglądarce klasa jest wtedy `undefined`, więc leci „AsyncLocalStorage is not a constructor".
 *
 * **Skutek jest nieproporcjonalny do przyczyny.** Wyjątek przy starcie modułu przerywa hydrację
 * CAŁEJ strony: użytkownik dostaje pustą stronę, a nie zepsuty widżet. W produkcji ratuje nas
 * wytrząsanie martwego kodu, ale w trybie deweloperskim wytrząsania nie ma — i to w nim chodzi
 * klikacz e2e. Przez to **61 ze 120 testów e2e padało bez związku ze swoją treścią**, a „czerwony"
 * przestał znaczyć „regresja". Siatka bezpieczeństwa z Fazy 0 przestała istnieć, nie przestając
 * istnieć na papierze.
 *
 * Reguła: konstrukcja obiektów z modułów wbudowanych Node **musi być leniwa** — w funkcji, nie
 * w zasięgu modułu. Brak takiego obiektu ma być poprawnym stanem („brak memoizacji", „log bez pól
 * żądania"), a nie wyjątkiem.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
/** Klasy z modułów wbudowanych Node, których konstrukcja przy imporcie wywraca graf klienta. */
const KLASY = ["AsyncLocalStorage", "AsyncResource"];

function pliki(dir, out = []) {
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) {
      if (["node_modules", "generated", "__tests__"].includes(w.name)) continue;
      pliki(p, out);
    } else if (/\.tsx?$/.test(w.name) && !/\.test\.tsx?$/.test(w.name)) out.push(p);
  }
  return out;
}

function bezKomentarzy(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

/** Poziom zagnieżdżenia w klamrach w danym miejscu — 0 znaczy „zasięg modułu". */
function poziomKlamr(kod, poz) {
  let poziom = 0;
  for (let i = 0; i < poz; i++) {
    const c = kod[i];
    if (c === "{") poziom++;
    else if (c === "}") poziom--;
  }
  return poziom;
}

const bledy = [];
for (const abs of pliki(path.join(root, "src"))) {
  const rel = path.relative(root, abs).split(path.sep).join("/");
  const kod = bezKomentarzy(fs.readFileSync(abs, "utf8"));
  for (const klasa of KLASY) {
    const re = new RegExp(`new\\s+${klasa}\\s*[<(]`, "g");
    for (const m of kod.matchAll(re)) {
      if (poziomKlamr(kod, m.index) > 0) continue; // wewnątrz funkcji — w porządku
      bledy.push(
        `${rel}:${kod.slice(0, m.index).split("\n").length} — \`new ${klasa}()\` w zasięgu modułu. ` +
          `Wykona się przy IMPORCIE, także w przeglądarce, gdzie \`async_hooks\` jest pustym modułem ` +
          `— i przerwie hydrację całej strony. Utwórz leniwie w funkcji i potraktuj brak jako ` +
          `poprawny stan (patrz platform/sharing/cache.ts).`,
      );
    }
  }
}

if (bledy.length) {
  console.error("\n✖ Konstrukcja modułu wbudowanego Node przy imporcie:\n");
  for (const b of bledy) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}
console.log("✓ Bezpieczeństwo grafu klienta: żaden moduł nie tworzy obiektu `async_hooks` przy imporcie.");
