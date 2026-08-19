#!/usr/bin/env node
/**
 * Bramka ZASIĘGU TAILWINDA (098).
 *
 * Tailwind generuje regułę tylko dla klasy, którą ZOBACZY w plikach z `content`. Do 098 lista
 * wyliczała trzy katalogi (`pages`, `components`, `app`) — a przebudowa 046 przeniosła interfejsy
 * wszystkich 21 modułów do `src/modules/`. Tego pliku nikt wtedy nie ruszył, więc klasy używane
 * TYLKO w modułach były wycinane z arkusza.
 *
 * **Dlaczego to jest groźniejsze, niż wygląda.** Objaw jest niejednorodny: klasa, która trafiła się
 * też gdzieś w `components/`, dalej działa. Nie widać więc „modułów bez stylów", tylko pojedyncze,
 * losowo wyglądające braki. Tak zniknęło `md:grid` w tygodniowym planie posiłków — `hidden md:grid`
 * zostało bez reguły przywracającej widoczność i **cała siatka planu była na desktopie
 * niewidoczna**, a strona wyglądała, jakby się jeszcze doczytywała.
 *
 * Reguła: każdy katalog pod `src/`, w którym są pliki `.tsx`, musi być objęty którymś globem
 * z `content`. Bramka nie wymaga jednego globu — wymaga POKRYCIA, bo o nie chodzi.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const konfiguracja = fs.readFileSync(path.join(root, "tailwind.config.ts"), "utf8");

const globy = [...konfiguracja.matchAll(/"\.\/([^"]+)"/g)].map((m) => m[1]);
if (globy.length === 0) {
  console.error("\n✖ Tailwind: nie udało się odczytać `content` z tailwind.config.ts.\n");
  process.exit(1);
}

/**
 * Zamienia glob Tailwinda na wyrażenie regularne — znak po znaku.
 *
 * Pierwsza wersja robiła to łańcuchem `replace`: najpierw globalne escapowanie, potem podmiana
 * `**` i `{a,b}`. Wynik był składniowo poprawny i **semantycznie fałszywy**: kreska alternatywy
 * z grupy rozszerzeń trafiała do wzorca NIEZASŁONIĘTA, więc całe wyrażenie stawało się alternatywą
 * najwyższego poziomu (`^src/components/…\.(?:js` ALBO `ts` ALBO …). Każda ścieżka zawierająca „ts"
 * pasowała do wszystkiego — czyli bramka świeciła na zielono także wtedy, gdy `src/modules`
 * naprawdę było poza zasięgiem. Próba mutacyjna to pokazała; bez niej bramka poszłaby do
 * repozytorium jako ozdoba.
 */
function naWyrazenie(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*" && glob[i + 2] === "/") { out += "(?:[^/]+/)*"; i += 2; }
      else if (glob[i + 1] === "*") { out += ".*"; i += 1; }
      else out += "[^/]*";
    } else if (c === "{") {
      const j = glob.indexOf("}", i);
      const warianty = glob.slice(i + 1, j).split(",").map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      out += `(?:${warianty.join("|")})`;
      i = j;
    } else if (".+?^$()|[]\\".includes(c)) {
      out += "\\" + c;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}
const wyrazenia = globy.map(naWyrazenie);

/** Katalogi z komponentami — reprezentowane przez jeden przykładowy plik `.tsx`. */
function katalogiZTsx(dir, out = new Map()) {
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) {
      if (["node_modules", "generated", "__tests__"].includes(w.name)) continue;
      katalogiZTsx(p, out);
    } else if (/\.tsx$/.test(w.name) && !/\.test\.tsx$/.test(w.name)) {
      const rel = path.relative(root, dir).split(path.sep).join("/");
      if (!out.has(rel)) out.set(rel, path.relative(root, p).split(path.sep).join("/"));
    }
  }
  return out;
}

const bledy = [];
const katalogi = katalogiZTsx(path.join(root, "src"));
for (const [katalog, przyklad] of katalogi) {
  if (!wyrazenia.some((re) => re.test(przyklad))) {
    bledy.push(
      `${katalog} — komponenty w tym katalogu są POZA \`content\` Tailwinda (np. ${przyklad}). ` +
        `Klasy używane tylko tutaj zostaną wycięte z arkusza, a braki wyjdą losowo, nie od razu.`,
    );
  }
}

if (bledy.length) {
  console.error("\n✖ Tailwind nie widzi części komponentów:\n");
  for (const b of bledy) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ Tailwind: ${katalogi.size} katalogów z komponentami, każdy objęty \`content\`.`);
