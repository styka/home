#!/usr/bin/env node
/**
 * Bramka WYPEŁNIANIA PRZESTRZENI (055, Faza 2 / zadanie 11, etap 2 z czterech).
 *
 * Problem, który rozwiązuje: kolumnę `workspaceId` wypełnia wyzwalacz `BEFORE INSERT` założony
 * migracją 0228 — po jednym na każdą z 45 objętych tabel. Tabela, która kolumnę ma, a wyzwalacza
 * nie dostała, **nie objawia się niczym**: nic jeszcze przestrzeni nie czyta, więc rekordy po
 * prostu zbierają NULL-e. Wyszłoby to dopiero w etapie 3 (zasób znika właścicielowi z listy) albo
 * w etapie 4 (`NOT NULL` odbija migrację produkcyjną) — czyli najpóźniej i najdrożej.
 *
 * Dlaczego bramka pilnuje MECHANIZMU, a nie wywołań: wyzwalacza nie da się pominąć w ścieżce
 * zapisu — obejmuje każdy `INSERT`, także z surowego SQL-a i seedów. Jedyne, co można pominąć, to
 * **założenie go na nowej tabeli**. To jest dokładnie to, co ta bramka sprawdza.
 *
 * Trzy kontrole, wszystkie STATYCZNE (bez bazy — lekcja z 054: dowód nie może zależeć od tego,
 * czy akurat są dane):
 *   1. model z `workspaceId String?` w `schema.prisma` → musi mieć `CREATE TRIGGER` w migracjach;
 *   2. w drugą stronę — wyzwalacz na tabeli spoza tego zbioru to błąd (literówka w nazwie tabeli
 *      objawiłaby się inaczej jako „wszystko zielone, jedna tabela niepokryta");
 *   3. martwy wpis w manifeście wyjątków też wywala bramkę (wzorzec `mirror-coverage.json`).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const schemaPath = path.join(root, "prisma/schema.prisma");
const migrationsDir = path.join(root, "prisma/migrations");
const manifestPath = path.join(root, "src/platform/workspaces/fill-coverage.json");

/**
 * Modele z LUSTRZANYM `workspaceId` — tym, który wypełnia wyzwalacz.
 *
 * 075: filtrem był kiedyś `String?`, bo etap 1 dokładał kolumnę nullowalną. Etap 4 zaostrzył
 * 40 z nich do `String`, więc filtr po znaku zapytania przestał widzieć niemal cały zbiór
 * i bramka zaczęła zgłaszać „wyzwalacz na tabeli, której nie ma wśród modeli".
 *
 * Rozróżnienie, o które naprawdę chodzi, nigdy nie dotyczyło nullowalności: `WorkspaceMember`,
 * `ResourceGrant` i `DomainEvent` też mają kolumnę o tej nazwie, ale u nich przestrzeń jest
 * CZĘŚCIĄ TOŻSAMOŚCI rekordu, a nie wyprowadzoną własnością — i dlatego nie mają wyzwalacza.
 * Poznajemy je po tym, że nie mają `ownerId`/`ownerTeamId`: nie ma z czego lustrzać.
 */
function objeteTabele(schemat) {
  const out = new Map(); // tabela → model
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(schemat))) {
    const [, model, cialo] = m;
    if (!/^\s*workspaceId\s+String\??/m.test(cialo)) continue;
    if (!/^\s*owner(Id|TeamId)\s+String/m.test(cialo)) continue;
    const map = cialo.match(/@@map\("([^"]+)"\)/);
    // Nazwa TABELI, nie modelu: `ProjectGroup` jest zmapowany na `TaskView`. Na tej różnicy padł
    // backfill w 0227 i tu byłaby ona równie niewidoczna.
    out.set(map ? map[1] : model, model);
  }
  return out;
}

/**
 * Tabele, dla których migracje zakładają wyzwalacz. Czytamy CAŁY katalog migracji, nie tylko 0228 —
 * wyzwalacz dla tabeli dołożonej w przyszłości trafi do nowej migracji i ma się liczyć tak samo.
 * Obsługujemy obie formy: pętlę `DO` po liście nazw (0228) i zwykłe `CREATE TRIGGER`.
 */
function tabeleZWyzwalaczem() {
  const znalezione = new Set();
  // Migracje idą w kolejności numerów, bo późniejsza może wyzwalacz USUNĄĆ. Bez sortowania
  // kolejność zależałaby od systemu plików.
  for (const dir of fs.readdirSync(migrationsDir).sort()) {
    const plik = path.join(migrationsDir, dir, "migration.sql");
    if (!fs.existsSync(plik)) continue;
    const sql = fs.readFileSync(plik, "utf8");
    if (!/omnia_fill_workspace|DROP\s+TRIGGER/i.test(sql)) continue;

    // Forma 1: jawna lista nazw w tablicy pętli DO.
    const petla = sql.match(/FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\[([\s\S]*?)\]/);
    if (petla) {
      for (const nazwa of petla[1].matchAll(/'([^']+)'/g)) znalezione.add(nazwa[1]);
    }
    // Forma 2: wyzwalacz napisany wprost.
    for (const t of sql.matchAll(/CREATE\s+TRIGGER\s+\S+\s+BEFORE\s+INSERT\s+ON\s+"([^"]+)"/gi)) {
      znalezione.add(t[1]);
    }
    // Zdjęcie wyzwalacza w PÓŹNIEJSZEJ migracji. Bez tego bramka zliczałaby założenie z 0228
    // i świeciła na zielono jeszcze długo po tym, jak wyzwalacz przestał istnieć — czyli byłaby
    // najcichsza dokładnie w chwili, gdy mechanizm przestaje działać.
    // W 0228 `DROP TRIGGER IF EXISTS` idzie przez `format(%I)`, więc nie ma tam nazwy tabeli
    // w cudzysłowie i ten wzorzec go nie łapie — celowo, bo tamten DROP służy idempotencji.
    for (const t of sql.matchAll(/DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?\S+\s+ON\s+"([^"]+)"/gi)) {
      znalezione.delete(t[1]);
    }
  }
  return znalezione;
}

const schemat = fs.readFileSync(schemaPath, "utf8");
const objete = objeteTabele(schemat);
const zWyzwalaczem = tabeleZWyzwalaczem();
const wyjatki = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).wyjatki || {}
  : {};

const uzyteWyjatki = new Set();
const brakujace = [];
for (const [tabela] of objete) {
  if (zWyzwalaczem.has(tabela)) continue;
  if (wyjatki[tabela]) {
    uzyteWyjatki.add(tabela);
    continue;
  }
  brakujace.push(tabela);
}

const nadmiarowe = [...zWyzwalaczem].filter((t) => !objete.has(t)).sort();
const martwe = Object.keys(wyjatki).filter(
  (t) => !uzyteWyjatki.has(t) && (!objete.has(t) || zWyzwalaczem.has(t)),
);

if (brakujace.length || nadmiarowe.length || martwe.length) {
  console.error("\n✖ Wypełnianie przestrzeni — mechanizm niekompletny:\n");
  for (const t of brakujace.sort()) {
    console.error(`  ✖ Tabela „${t}" ma kolumnę \`workspaceId\`, a nie ma wyzwalacza.`);
    console.error("    Rekordy będą powstawać z pustą przestrzenią i NIC tego nie pokaże, dopóki");
    console.error("    etap 3 nie przełączy odczytów. Dopisz tabelę do listy w migracji zakładającej");
    console.error(`    \`omnia_fill_workspace\` albo — jeśli świadomie zostaje poza — dopisz powód`);
    console.error(`    do ${path.relative(root, manifestPath)}.\n`);
  }
  for (const t of nadmiarowe) {
    console.error(`  ✖ Wyzwalacz na tabeli „${t}", której nie ma wśród modeli z \`workspaceId\`.`);
    console.error("    Najczęściej literówka w nazwie tabeli — a wtedy tabela, która MIAŁA dostać");
    console.error("    wyzwalacz, zostaje bez niego.\n");
  }
  for (const t of martwe) {
    console.error(`  ✖ Martwy wyjątek w manifeście: „${t}" już go nie potrzebuje.`);
    console.error("    Usuń wpis — wyjątek bez powodu z czasem staje się furtką.\n");
  }
  process.exit(1);
}

console.log(
  `✓ Wypełnianie przestrzeni: ${objete.size} tabel z \`workspaceId\`, każda z wyzwalaczem` +
    `${uzyteWyjatki.size ? ` (${uzyteWyjatki.size} świadomych wyjątków)` : ""}.`,
);
