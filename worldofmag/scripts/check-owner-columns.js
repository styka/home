#!/usr/bin/env node
/**
 * Bramka MARTWYCH KOLUMN WŁASNOŚCIOWYCH (095; rozdz. 8.10, etap 4 zadania 11).
 *
 * Migracja 0244 usunęła `ownerId`/`ownerTeamId` z 40 tabel; zostały na sześciu. Problem w tym, że
 * **`tsc` tego nie widzi**: warunki zapytań budujemy w tym repozytorium jako `Record<string,
 * unknown>` albo jako tablicę literałów przypisaną do zmiennej, więc odwołanie do skasowanej
 * kolumny kompiluje się bez słowa skargi i wywala się dopiero w czasie działania, komunikatem
 * Prismy „Unknown argument `ownerTeamId`".
 *
 * Tak przetrwały po 079 cztery takie miejsca, dwa na gorącej ścieżce (plan posiłków zawężony do
 * zespołu; rozstrzyganie projektu przez asystenta AI). Żadna z 24 bramek ich nie łapała, bo
 * wszystkie pilnowały KSZTAŁTU migracji, a nie tego, czy kod nadal pyta o to, co migracja
 * skasowała.
 *
 * ### Dlaczego to sprawdza akurat tyle, ile sprawdza
 *
 * Pierwsza wersja tej bramki liczyła każdy klucz `ownerId:` w kodzie serwerowym i zażądała
 * uzasadnienia dla **37 plików** — w większości dla argumentów funkcji (`enqueueJob({ownerId})`,
 * `createBudget({ownerTeamId})`), które z bazą nie mają nic wspólnego. Manifest z 37 wpisami nie
 * jest decyzją, tylko szumem, a bramka, która co drugi build oskarża niewinny plik, zostaje
 * wyłączona. Dlatego filtrujemy PO ZNACZENIU, nie po składni: interesuje nas wyłącznie klucz, który
 * faktycznie dojedzie do Prismy jako nazwa pola.
 *
 * Dwie drogi dojazdu, obie rozstrzygane pewnie:
 *   1. **Wprost** — klucz stoi w zbalansowanym argumencie `prisma.<model>.<operacja>( … )`.
 *      Model jest znany, więc `ownerId` w `itemHistory` przechodzi, a ten sam klucz w `recipe` pada.
 *   2. **Przez zmienną** — argument wskazuje identyfikator (`where: warunek`, `OR: ownershipFilter`,
 *      `...filtr`). Bramka odnajduje w tym samym pliku deklarację tego identyfikatora ORAZ
 *      wszystkie przypisania do jego pól (`warunek.OR = […]`) i sprawdza je tak samo. Tędy weszły
 *      wszystkie cztery błędy — filtr budowany kilka linijek wcześniej.
 *
 * ZNANA GRANICA, zapisana zamiast przemilczanej: rozwiązywanie identyfikatorów jest
 * JEDNOPOZIOMOWE i tylko w obrębie pliku. Filtr zbudowany w innym module i zaimportowany tu
 * przejdzie. Świadomie: w tym repozytorium filtry własnościowe pochodzą albo z literału na
 * miejscu, albo z `platform/workspaces/zapis.ts` (który jest otypowany), więc drugi poziom
 * kupowałby fałszywe alarmy zamiast pokrycia.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const KOLUMNY = ["ownerId", "ownerTeamId"];

// ── Które modele NADAL mają te kolumny (jedyne źródło prawdy: schemat) ──────
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const kolumnyModelu = new Map(); // `taskProject` → Set(["ownerId", …])
for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  const male = m[1][0].toLowerCase() + m[1].slice(1);
  const zbior = new Set();
  for (const k of KOLUMNY) if (new RegExp(`^\\s*${k}\\s`, "m").test(m[2])) zbior.add(k);
  kolumnyModelu.set(male, zbior);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "generated"].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Komentarze → spacje tej samej długości: treść znika, przesunięcia zostają (lekcja z 071). */
function bezKomentarzy(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

/** Czyta zbalansowany fragment zaczynając od znaku otwierającego pod indeksem `i`. */
function zbalansowany(t, i, otw, zam) {
  let g = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === otw) g++;
    else if (t[j] === zam) {
      g--;
      if (g === 0) return { tekst: t.slice(i, j + 1), koniec: j };
    }
  }
  return { tekst: t.slice(i), koniec: t.length - 1 };
}

const OPERACJE =
  "findMany|findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|update|updateMany|create|createMany|upsert|delete|deleteMany|count|aggregate|groupBy";

const bledy = [];
let sprawdzonych = 0;

for (const plik of walk(path.join(root, "src"))) {
  const rel = path.relative(root, plik).split(path.sep).join("/");
  const t = bezKomentarzy(fs.readFileSync(plik, "utf8"));
  if (!/\b(?:prisma|tx)\.\w+\./.test(t)) continue;

  const re = new RegExp(`\\b(?:prisma|tx)\\.(\\w+)\\.(?:${OPERACJE})\\s*\\(`, "g");
  for (const m of t.matchAll(re)) {
    const model = m[1];
    const ma = kolumnyModelu.get(model);
    if (!ma) continue; // nieznany model — nie zgadujemy
    sprawdzonych++;

    const { tekst: argument, koniec } = zbalansowany(t, m.index + m[0].length - 1, "(", ")");
    const linia = (off) => t.slice(0, off).split("\n").length;

    /** Fragmenty do przeszukania: sam argument + definicje identyfikatorów, które w nim stoją. */
    const fragmenty = [{ tekst: argument, offset: m.index }];

    /** Identyfikatory stojące w miejscu warunku — `where: warunek`, `OR: filtr`, `...filtr`, `{ where }`. */
    function identyfikatoryW(frag) {
      const zbior = new Set();
      for (const i of frag.matchAll(/(?:where|data|OR|AND|NOT|some|every|none)\s*:\s*([A-Za-z_$][\w$]*)/g)) zbior.add(i[1]);
      for (const i of frag.matchAll(/\.\.\.\(?\s*(?:await\s+)?([A-Za-z_$][\w$]*)\b/g)) zbior.add(i[1]);
      for (const i of frag.matchAll(/[{,]\s*(where|data)\s*[},]/g)) zbior.add(i[1]);
      return zbior;
    }

    /** Deklaracja identyfikatora i wszystkie przypisania do jego pól, sprzed tego wywołania. */
    function definicje(id) {
      const znalezione = [];
      const wzorce = [
        new RegExp(`\\b(?:const|let|var)\\s+${id}\\b[^=;]*=\\s*`, "g"),
        new RegExp(`\\b${id}\\.\\w+\\s*=\\s*`, "g"),
      ];
      for (const wzor of wzorce) {
        for (const d of t.matchAll(wzor)) {
          if (d.index > koniec) continue; // definicja po wywołaniu — inny byt
          const start = d.index + d[0].length;
          const znak = t[start];
          const frag =
            znak === "{" ? zbalansowany(t, start, "{", "}").tekst
            : znak === "[" ? zbalansowany(t, start, "[", "]").tekst
            : t.slice(start, t.indexOf(";", start) + 1);
          znalezione.push({ tekst: frag, offset: start });
        }
      }
      return znalezione;
    }

    /**
     * Rozwiązywanie do punktu stałego, nie jednopoziomowe. Mutacyjna próba pokazała, po co:
     * w `getRecipes` warunek stoi w zmiennej `where`, a filtr własnościowy — w drugiej zmiennej
     * wskazanej z niej przez `OR:`. Jeden poziom zatrzymywał się o krok za wcześnie i przepuszczał
     * dokładnie ten błąd, dla którego ta bramka powstała. Limit rund chroni przed cyklem.
     */
    const rozwiazane = new Set();
    let doRozwiazania = identyfikatoryW(argument);
    for (let runda = 0; runda < 4 && doRozwiazania.size > 0; runda++) {
      const nastepne = new Set();
      for (const id of doRozwiazania) {
        if (rozwiazane.has(id)) continue;
        rozwiazane.add(id);
        for (const def of definicje(id)) {
          fragmenty.push(def);
          for (const kolejny of identyfikatoryW(def.tekst)) if (!rozwiazane.has(kolejny)) nastepne.add(kolejny);
        }
      }
      doRozwiazania = nastepne;
    }

    for (const kolumna of KOLUMNY) {
      if (ma.has(kolumna)) continue;
      const kluczRe = new RegExp(`(?<![\\w$])${kolumna}\\s*:`, "g");
      for (const { tekst: frag, offset } of fragmenty) {
        const trafienie = kluczRe.exec(frag);
        kluczRe.lastIndex = 0;
        if (!trafienie) continue;
        bledy.push(
          `${rel}:${linia(offset + trafienie.index)} — \`${kolumna}\` trafia do zapytania o ` +
            `\`${model}\`, a ten model nie ma tej kolumny od migracji 0244. Własność wyraża ` +
            `\`workspaceId\` — użyj \`filtrMoichRekordow\` / \`ownedWhereAsync\` / ` +
            `\`przestrzenZespoluBezKontroliDostepu\` z \`platform/workspaces/zapis.ts\`.`,
        );
      }
    }
  }
}

if (bledy.length) {
  console.error("\n✖ Zapytania o skasowane kolumny własnościowe:\n");
  for (const b of [...new Set(bledy)]) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ Kolumny własnościowe: ${sprawdzonych} wywołań Prismy, żadne nie pyta o skasowane \`ownerId\`/\`ownerTeamId\`.`);
