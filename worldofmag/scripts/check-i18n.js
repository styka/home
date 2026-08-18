#!/usr/bin/env node
/**
 * Bramka WYCIĄGANIA TEKSTÓW (089, zadanie 35, Faza 7).
 *
 * Rozdz. 12.1 mówi o tej pracy dwie rzeczy naraz: że jest **mechaniczna** i że jej koszt rośnie
 * z każdym tygodniem rozwoju, bo nowy kod wprowadza literały z powrotem. Jednorazowy przebieg
 * „wyciągnijmy wszystko" rozwiązuje pierwszą połowę i przegrywa drugą.
 *
 * Dlatego to jest **zapadka**, dokładnie jak przy paginacji (068): liczymy literały widoczne dla
 * użytkownika, zamrażamy wynik i nie pozwalamy mu rosnąć. Spadek też czerwieni — poprawę trzeba
 * zapisać w progu, inaczej zapas ukryje następny regres.
 *
 * **Co liczymy.** Tylko to, co użytkownik ZOBACZY: tekst między znacznikami JSX oraz napisy
 * w atrybutach, które trafiają na ekran (`placeholder`, `title`, `aria-label`, `label`, `alt`).
 * Rozpoznajemy je po polskich znakach diakrytycznych — kryterium niedoskonałe („Zapisz", „Anuluj"
 * ich nie mają), ale **stabilne i bez fałszywych alarmów**, a to jest cecha ważniejsza: zapadka,
 * która co drugi build oskarża niewinny plik, zostanie wyłączona.
 *
 * **Czego nie liczymy i dlaczego.** Komentarzy (są dla programisty), testów, `src/generated`
 * (treść książek), plików `.json` i tekstów serwerowych, które nie trafiają do interfejsu — np.
 * komunikatów w `throw new Error(...)`. Te ostatnie to osobna decyzja produktowa: dziś część z nich
 * użytkownik widzi w dymku błędu, więc docelowo też pójdą przez `t()`, ale wciągnięcie ich do tej
 * samej liczby zamazałoby postęp w warstwie widoku.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const baselinePath = path.join(root, "src/lib/ui/i18n-baseline.json");

const POLSKIE = /[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/;
const ATRYBUTY = ["placeholder", "title", "aria-label", "alt", "label"];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Usuwa komentarze — inaczej liczylibyśmy uzasadnienia decyzji, których w tym repo jest sporo. */
function bezKomentarzy(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function policzWPliku(text) {
  const czysty = bezKomentarzy(text);
  let n = 0;

  // Tekst między znacznikami: `>Zapisz zmiany<`. Wykluczamy fragmenty z `{`, bo to wyrażenie,
  // a nie literał, i wykluczamy same białe znaki.
  for (const m of czysty.matchAll(/>([^<>{}]{2,})</g)) {
    if (POLSKIE.test(m[1])) n++;
  }

  // Atrybuty widoczne dla użytkownika.
  for (const atrybut of ATRYBUTY) {
    // `(?<![-\w])` zamiast `\b`: w `aria-label` przed „label" stoi łącznik, który JEST granicą słowa,
    // więc wzorzec z `\b` liczył każdy `aria-label` dwa razy — raz jako `aria-label`, raz jako `label`.
    // Zapadka na zawyżonym liczniku pokazywałaby postęp tam, gdzie go nie ma.
    const re = new RegExp(`(?<![-\\w])${atrybut}\\s*=\\s*"([^"]{2,})"`, "g");
    for (const m of czysty.matchAll(re)) {
      if (POLSKIE.test(m[1])) n++;
    }
  }
  return n;
}

const perPlik = new Map();
let suma = 0;
for (const file of walk(srcDir)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const n = policzWPliku(fs.readFileSync(file, "utf8"));
  if (n > 0) {
    perPlik.set(rel, n);
    suma += n;
  }
}

if (!fs.existsSync(baselinePath)) {
  console.error(`\n✖ i18n: brak progu ${path.relative(root, baselinePath)} (zmierzono ${suma}).\n`);
  process.exit(1);
}
const prog = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

if (suma > prog.maks) {
  console.error("\n✖ i18n: przybyło tekstów zaszytych w komponentach.");
  console.error(`\n  Było najwyżej ${prog.maks}, jest ${suma}.`);
  console.error("  Nowy tekst UI ma iść przez `t()` z messages/pl.json, nie literałem w JSX.");
  console.error("\n  Najwięcej zaszytych tekstów mają dziś:");
  for (const [plik, n] of [...perPlik.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.error(`    ${String(n).padStart(4)}× ${plik}`);
  }
  console.error("");
  process.exit(1);
}

if (suma < prog.maks) {
  console.error(`\n✖ i18n: licznik SPADŁ (${prog.maks} → ${suma}) — i to dobrze.`);
  console.error(`  Obniż "maks" w ${path.relative(root, baselinePath)} do ${suma}, żeby zapas nie ukrył następnego regresu.\n`);
  process.exit(1);
}

console.log(`✓ i18n: ${suma} tekstów zaszytych w komponentach — zapadka trzyma (bez wzrostu).`);
