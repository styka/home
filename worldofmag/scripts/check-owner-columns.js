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
 * ### 082 — trzecia droga dojazdu: SKRÓCONY ZAPIS POLA
 *
 * Do 082 obie drogi wyżej szukały klucza wyłącznie w postaci `ownerId:` — z dwukropkiem. Tymczasem
 * JavaScript ma drugi, równoważny zapis tego samego pola: `{ ownerId, sourceId: x }`. Prisma widzi
 * je identycznie, bramka nie widziała go wcale — i to **w każdym kształcie**, także w najprostszym
 * (`createMany({ data: { ownerId, url } })`), nie tylko w łańcuchu `.map()`.
 *
 * Tędy przeszedł na produkcję zapis do puli artykułów Wiadomości (`newsRefresh.ts`): po migracji
 * 0244 KAŻDE odświeżanie modułu kończyło się błędem Prismy, a moduł stał pusty. Bramka powstała
 * dokładnie po to, żeby takich miejsc nie było, i była zielona.
 *
 * Lekcja wpisana wprost w kod: **wykrywanie po składni musi objąć wszystkie warianty składni tej
 * samej rzeczy**, inaczej mierzy nie „czy pole trafia do Prismy", tylko „czy autor napisał je
 * akurat tak, jak pomyślał autor bramki".
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
/**
 * 098: doszła `workspaceId` — ten sam błąd, tylko w drugą stronę. Pięć tabel (`Job`, `Skin`, `Tag`,
 * `ItemHistory`, `NoteGroup`) zostało przy `ownerId` i przestrzeni NIE MA; `filtrMoichRekordow`
 * zwraca `{ workspaceId }`, więc wstawiony tam odruchowo dawał „Unknown argument workspaceId".
 * Tak przestał działać stan odświeżania Wiadomości — zapytanie padało przy każdym wejściu na moduł.
 */
const KOLUMNY = ["ownerId", "ownerTeamId", "workspaceId"];

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
      if (["node_modules", "generated", "test-results", "playwright-report", "migrations"].includes(e.name)) continue;
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

/**
 * Klucze „przezroczyste" — takie, które NIE zmieniają modelu, o który pytamy. Wszystko inne
 * (`project:`, `topic:`, `workspace:`) to zejście do INNEJ tabeli, więc pole pod spodem należy już
 * do niej. Bez tego rozróżnienia `select: { project: { select: { workspaceId: true } } }` wyglądało
 * jak pytanie o `Task.workspaceId` — czyli bramka oskarżała cztery poprawne zapytania.
 */
const PRZEZROCZYSTE = new Set([
  "where", "data", "select", "include", "AND", "OR", "NOT", "some", "every", "none",
  "is", "isNot", "create", "update", "upsert", "connect", "connectOrCreate", "orderBy", "_count",
]);

/** Łańcuch kluczy obejmujących pozycję — od najbliższego w górę. */
function przodkowie(tekst, poz) {
  const out = [];
  let glebokosc = 0;
  for (let i = poz - 1; i >= 0; i--) {
    const c = tekst[i];
    if (c === "}" || c === "]") glebokosc++;
    else if (c === "{" || c === "[") {
      if (glebokosc === 0) {
        const m = /([A-Za-z_$][\w$]*)\s*:\s*$/.exec(tekst.slice(Math.max(0, i - 80), i));
        if (m) out.push(m[1]);
      } else glebokosc--;
    }
  }
  return out;
}

/**
 * Pomocniki, które WNOSZĄ `workspaceId` do zapytania. Bramka nie widzi typu zwracanego, a to
 * właśnie tędy wszedł błąd produkcyjny znaleziony przez klikacz: `prisma.job.findFirst({ where:
 * { ...(await filtrMoichRekordow(user.id)), type } })` — a `Job` przestrzeni nie ma i nigdy nie
 * miał, bo zadanie w tle bywa systemowe. Prisma odrzucała każde wywołanie, więc stan odświeżania
 * Wiadomości nie wczytywał się ani razu.
 */
const WNOSZA_PRZESTRZEN = ["filtrMoichRekordow", "ownedWhereAsync", "wlasnoscDoZapisu", "wlasnoscOsobistaDoZapisu"];

const bledy = [];
let sprawdzonych = 0;

/**
 * 098: skanujemy też `e2e/` i `prisma/`. Fikstura testu jest kodem jak każdy inny — dwie z nich
 * tworzyły projekt z `ownerId`, czyli kolumną skasowaną migracją 0244, i przewracały klikacz
 * błędem Prismy zamiast wynikiem testu. Bramka pilnująca tylko `src/` przepuszczała to bez słowa.
 */
function analizuj(rel, zrodlo) {
  const t = bezKomentarzy(zrodlo);
  if (!/\b(?:prisma|tx)\.\w+\./.test(t)) return;

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
      // `...(x ? [...] : [])` — `x` jest WARUNKIEM, nie rozlewaną wartością. Wciągnięcie jego
      // definicji kazało bramce sprawdzać pole, które w tym zapytaniu w ogóle nie występuje
      // (`{ project: moje }` w `purge.ts`: `moje` opisuje TaskProject, nie Task).
      for (const i of frag.matchAll(/\.\.\.\(?\s*(?:await\s+)?([A-Za-z_$][\w$]*)\s*([?)\s,\].]|$)/g)) {
        if (i[2] === "?") continue;
        zbior.add(i[1]);
      }
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

    if (!ma.has("workspaceId")) {
      for (const pomocnik of WNOSZA_PRZESTRZEN) {
        const re2 = new RegExp(`\\.\\.\\.\\(?\\s*(?:await\\s+)?${pomocnik}\\s*\\(`, "g");
        for (const t of argument.matchAll(re2)) {
          if (przodkowie(argument, t.index).some((a) => !PRZEZROCZYSTE.has(a))) continue;
          bledy.push(
            `${rel}:${linia(m.index + t.index)} — \`${pomocnik}(...)\` wnosi \`workspaceId\` do ` +
              `zapytania o \`${model}\`, a ten model przestrzeni NIE MA (jest wśród pięciu tabel ` +
              `z \`workspace-nullable.json\`, gdzie własność wyraża \`ownerId\`).`,
          );
        }
      }
    }

    for (const kolumna of KOLUMNY) {
      if (ma.has(kolumna)) continue;
      /**
       * 082: DWA warianty zapisu tego samego pola, bo Prisma nie odróżnia ich wcale.
       *  • `ownerId:` — zapis pełny;
       *  • `{ ownerId,` / `, ownerId }` — zapis SKRÓCONY, przez który przeszedł błąd produkcyjny.
       * Skrócony wymaga `{` albo `,` bezpośrednio przed nazwą, więc `...ownerId` (rozlanie
       * wartości) i `x.ownerId` (odczyt pola pobranego rekordu) nie są trafieniami.
       */
      const kluczRe = new RegExp(
        `(?<![\\w$])${kolumna}\\s*:|(?<=[{,]\\s{0,40})${kolumna}\\s*(?=[,}])`,
        "g",
      );
      for (const { tekst: frag, offset } of fragmenty) {
        const trafienie = kluczRe.exec(frag);
        kluczRe.lastIndex = 0;
        if (!trafienie) continue;
        // Pole pod kluczem relacji należy do INNEJ tabeli — o niej ta bramka nic nie twierdzi.
        if (przodkowie(frag, trafienie.index).some((a) => !PRZEZROCZYSTE.has(a))) continue;
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

for (const plik of [
  ...walk(path.join(root, "src")),
  ...walk(path.join(root, "e2e")),
  ...walk(path.join(root, "prisma")),
]) {
  analizuj(path.relative(root, plik).split(path.sep).join("/"), fs.readFileSync(plik, "utf8"));
}

/**
 * PRÓBY MUTACYJNE (082). Bramka wykrywająca po składni jest warta dokładnie tyle, ile jej własny
 * dowód: wersja sprzed 082 była zielona **przy błędzie leżącym na produkcji**, bo szukała pola
 * wyłącznie w zapisie z dwukropkiem. Dlatego zestaw kształtów — te, które MUSZĄ paść, i te, które
 * MUSZĄ przejść — mieszka odtąd w skrypcie, a nie w pamięci osoby, która go pisała.
 *
 * Uruchamiane w każdym przebiegu (koszt: kilka milisekund na czterech snippetach), więc nie da się
 * ich pominąć zapominając o osobnej fladze.
 */
const PROBY = [
  {
    opis: "skrócony zapis pola wprost w argumencie — kształt błędu produkcyjnego z newsRefresh",
    kod: `import { prisma } from "@/platform/db/prisma";
      export async function f(ownerId: string) {
        await prisma.newsArticle.createMany({ data: { ownerId, url: "a" } });
      }`,
    maPasc: true,
  },
  {
    opis: "skrócony zapis pola w literale zwracanym z .map(), przypisanym do zmiennej",
    kod: `import { prisma } from "@/platform/db/prisma";
      export async function f(ownerId: string, feed: any[], source: any, since: Date) {
        const rows = feed
          .filter((x) => x.publishedAt >= since)
          .map((x) => ({ ownerId, sourceId: source.id, url: x.link }));
        await prisma.newsArticle.createMany({ data: rows, skipDuplicates: true });
      }`,
    maPasc: true,
  },
  {
    opis: "ta sama kolumna na modelu, KTÓRY JĄ MA (workspace-nullable.json) — musi przejść",
    kod: `import { prisma } from "@/platform/db/prisma";
      export async function f(ownerId: string) {
        await prisma.itemHistory.findMany({ where: { ownerId } });
      }`,
    maPasc: false,
  },
  {
    opis: "pole pod kluczem relacji należy do INNEJ tabeli — musi przejść",
    kod: `import { prisma } from "@/platform/db/prisma";
      export async function f() {
        await prisma.task.findMany({ select: { project: { select: { workspaceId: true } } } });
      }`,
    maPasc: false,
  },
  {
    opis: "rozlanie wartości i odczyt pola pobranego rekordu to nie klucz zapytania — musi przejść",
    kod: `import { prisma } from "@/platform/db/prisma";
      export async function f(rekord: { ownerId: string }, filtr: any) {
        await prisma.newsArticle.findMany({ where: { ...filtr, url: rekord.ownerId } });
      }`,
    maPasc: false,
  },
];

const bledyProb = [];
const sprawdzonychWRepo = sprawdzonych;
for (const proba of PROBY) {
  const przed = bledy.length;
  analizuj("<próba>", proba.kod);
  const padla = bledy.length > przed;
  bledy.length = przed; // próby nie zanieczyszczają wyniku dla repozytorium
  if (padla !== proba.maPasc) {
    bledyProb.push(
      `próba „${proba.opis}" ${proba.maPasc ? "MIAŁA paść, a przeszła" : "MIAŁA przejść, a padła"}`,
    );
  }
}
if (bledyProb.length) {
  console.error("\n✖ Bramka nie przechodzi własnych prób mutacyjnych:\n");
  for (const b of bledyProb) console.error(`  • ${b}`);
  console.error("\n  Bramka, która nie wykrywa kształtu błędu, dla którego powstała, jest gorsza");
  console.error("  niż jej brak: ogłasza kontrolę, której nie ma.\n");
  process.exit(1);
}

if (bledy.length) {
  console.error("\n✖ Zapytania o skasowane kolumny własnościowe:\n");
  for (const b of [...new Set(bledy)]) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}
console.log(
  `✓ Kolumny własnościowe: ${sprawdzonychWRepo} wywołań Prismy (+ ${PROBY.length} prób mutacyjnych), ` +
    "żadne nie pyta o skasowane `ownerId`/`ownerTeamId`.",
);
