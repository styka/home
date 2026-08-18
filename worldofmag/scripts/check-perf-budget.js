#!/usr/bin/env node
/**
 * BUDŻET WYDAJNOŚCIOWY (091, zadanie 43, Faza 8; rozdz. 13.F8).
 *
 * **Dlaczego bramka buildu, a nie osobny krok CI.** W tym repozytorium nie ma GitHub Actions —
 * „CI" to `npm run build`, uruchamiany lokalnie i przez Render przy każdym wdrożeniu. Dołożenie
 * osobnego workflow oznaczałoby drugie miejsce, w którym trzeba pamiętać o nowej bramce, i pierwszą
 * okazję, żeby oba się rozjechały. Budżet jedzie więc tam, gdzie jadą wszystkie pozostałe bramki.
 *
 * **Co mierzymy: rozmiar JS-a, który przeglądarka musi pobrać dla trasy.** Nie czas renderu i nie
 * Lighthouse — jedno i drugie wymaga uruchomionej przeglądarki i zwraca liczbę zależną od maszyny,
 * więc jako próg w buildzie dawałoby fałszywe alarmy. Rozmiar paczki jest deterministyczny, liczy się
 * z manifestu i **jest przyczyną**, a nie objawem: to on decyduje o czasie pierwszego wejścia na
 * telefonie w LTE.
 *
 * **Dlaczego tolerancja, a nie równość.** Pozostałe zapadki w tym repo (paginacja, N+1, i18n) padają
 * także przy SPADKU, bo liczą rzeczy, które zmieniają się wyłącznie od naszych decyzji. Rozmiar
 * paczki zmienia się też przy aktualizacji zależności i przy zmianie wersji Next-a — próg „co do
 * bajta" byłby wyłączony po pierwszym `npm update`. Stąd pasmo: wzrost powyżej progu tolerancji
 * czerwieni, a spadek poniżej tego pasma **też** czerwieni, żeby poprawa została zapisana i nie
 * zrobiła zapasu na następny regres.
 *
 * Uruchamiany PO `next build` — wcześniej nie ma czego mierzyć.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const nextDir = path.join(root, ".next");
const baselinePath = path.join(root, "src/lib/ui/perf-baseline.json");

/** Ile procent wzrostu wolno bez decyzji. 5 % ≈ szum aktualizacji zależności, nie nowa funkcja. */
const TOLERANCJA = 0.05;

const manifestPath = path.join(nextDir, "app-build-manifest.json");
if (!fs.existsSync(manifestPath)) {
  // Bramka nie może wymuszać buildu — uruchomiona osobno (np. `npm run check:perf`) po prostu
  // mówi, czego jej brakuje. Milczące przejście byłoby gorsze: budżet, który „przechodzi", bo nie
  // ma danych, przestaje cokolwiek pilnować.
  console.error("\n✖ Budżet wydajnościowy: brak .next/app-build-manifest.json — uruchom najpierw `next build`.\n");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function rozmiarPliku(rel) {
  try {
    return fs.statSync(path.join(nextDir, rel)).size;
  } catch {
    return 0;
  }
}

/** Bajty JS-a dla trasy — suma UNIKALNYCH plików (część jest wspólna dla wszystkich tras). */
const perTrasa = {};
for (const [trasa, pliki] of Object.entries(manifest.pages ?? {})) {
  const unikalne = new Set(pliki.filter((p) => p.endsWith(".js")));
  let bajty = 0;
  for (const p of unikalne) bajty += rozmiarPliku(p);
  perTrasa[trasa] = bajty;
}

const trasy = Object.keys(perTrasa);
if (trasy.length === 0) {
  console.error("\n✖ Budżet wydajnościowy: manifest nie zawiera ani jednej trasy.\n");
  process.exit(1);
}
const najwieksza = trasy.reduce((a, b) => (perTrasa[a] >= perTrasa[b] ? a : b));
const suma = trasy.reduce((s, t) => s + perTrasa[t], 0);

const kB = (b) => Math.round(b / 1024);

if (!fs.existsSync(baselinePath)) {
  console.error(`\n✖ Budżet wydajnościowy: brak progu ${path.relative(root, baselinePath)}.`);
  console.error(`  Zmierzono: najcięższa trasa ${najwieksza} = ${kB(perTrasa[najwieksza])} kB, suma ${kB(suma)} kB.\n`);
  process.exit(1);
}
const prog = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

const problemy = [];
const gornaGranica = (v) => Math.round(v * (1 + TOLERANCJA));
const dolnaGranica = (v) => Math.round(v * (1 - TOLERANCJA));

if (perTrasa[najwieksza] > gornaGranica(prog.najciezszaTrasaB)) {
  problemy.push(
    `najcięższa trasa: ${kB(perTrasa[najwieksza])} kB (${najwieksza}), próg ${kB(prog.najciezszaTrasaB)} kB ` +
      `+${Math.round(TOLERANCJA * 100)}% — sprawdź, co nowego weszło do jej grafu`,
  );
}
if (suma > gornaGranica(prog.sumaB)) {
  problemy.push(`suma JS wszystkich tras: ${kB(suma)} kB, próg ${kB(prog.sumaB)} kB +${Math.round(TOLERANCJA * 100)}%`);
}
if (suma < dolnaGranica(prog.sumaB)) {
  problemy.push(
    `suma JS SPADŁA do ${kB(suma)} kB (próg ${kB(prog.sumaB)} kB) — obniż "sumaB" w ` +
      `${path.relative(root, baselinePath)}, inaczej zapas ukryje następny regres`,
  );
}

if (problemy.length > 0) {
  console.error("\n✖ Budżet wydajnościowy:");
  for (const p of problemy) console.error(`  ${p}`);
  console.error("\n  Najcięższe trasy w tym buildzie:");
  for (const t of trasy.sort((a, b) => perTrasa[b] - perTrasa[a]).slice(0, 6)) {
    console.error(`    ${String(kB(perTrasa[t])).padStart(5)} kB  ${t}`);
  }
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Budżet wydajnościowy: najcięższa trasa ${kB(perTrasa[najwieksza])} kB (${najwieksza}), ` +
    `suma ${kB(suma)} kB — w pasmie ±${Math.round(TOLERANCJA * 100)}%.`,
);
