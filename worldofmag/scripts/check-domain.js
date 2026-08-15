#!/usr/bin/env node
/**
 * Bramka WARSTWY REGUŁ (069, zadanie 19; rozdz. 10.1).
 *
 * Rozdz. 10.1 opisuje warstwę `domain/` przez to, **czego nie zna** (Prismy, Reacta, sesji) i **jak
 * jest testowana** (jednostkowo, bez bazy, w milisekundach). Katalog o właściwej nazwie sam z siebie
 * nie daje ani jednego, ani drugiego — rozdz. 10.4 mówi to wprost o poprzednim podejściu:
 * `components/ui/home` istniał i nie był używany wszędzie. Dlatego warstwa dostaje bramkę.
 *
 * Cztery kontrole:
 *   1. CZYSTOŚĆ      — plik reguł nie sięga po bazę, sesję, cache tras ani Reacta i nie jest
 *                      oznaczony jako kod serwerowy.
 *   2. TEST          — każdy plik reguł ma odpowiadający mu test. Warstwa, w której wolno zostawić
 *                      regułę nieprzetestowaną, nie rozwiązuje problemu, dla którego powstała.
 *   3. MANIFEST      — każdy z modułów ma rozstrzygniętą decyzję (w obie strony: moduł spoza
 *                      manifestu i wpis bez modułu to oba błędy).
 *   4. ZAPADKA       — liczba nazwanych pomocników pozostających w plikach akcji nie rośnie.
 *                      Bez tego przebieg posprzątałby stan dzisiejszy i pozwolił odtworzyć go od
 *                      nowa — dokładnie tak powstało zastane 55.
 *
 * ZNANA GRANICA KONTROLI 4, zapisana zamiast przemilczanej: liczone są pomocniki **nazwane**.
 * Reguła napisana wprost w ciele akcji nazwy nie ma i przez tę zapadkę nie przejdzie wykryta.
 * Tak właśnie znalazła się analityka Magazynowania — ręcznie, nie pomiarem.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "src/lib/domain-coverage.json");
const modulesDir = path.join(root, "src/modules");

/** Importy, których warstwa reguł mieć nie może — wzorzec → co to znaczy. */
const ZAKAZANE = [
  [/^\s*["']use server["']/m, "oznaczenie kodu serwerowego (`use server`)"],
  [/from\s+["']@\/platform\/db/, "dostęp do bazy (`@/platform/db`)"],
  [/from\s+["']@prisma\/client["']/, "klient Prismy"],
  [/\bprisma\./, "użycie klienta Prismy"],
  [/from\s+["']next\/headers["']/, "nagłówki żądania (`next/headers`)"],
  [/from\s+["']next\/cache["']/, "unieważnianie cache (`next/cache`)"],
  [/from\s+["']react["']/, "React"],
  [/from\s+["']@\/platform\/auth\/session["']/, "sesja użytkownika"],
  [/\brequireAuth\b/, "sprawdzenie zalogowania (`requireAuth`)"],
];

const bledy = [];

function plikiTs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) plikiTs(p, out);
    else if (/\.ts$/.test(w.name)) out.push(p);
  }
  return out;
}

// ─── Kontrole 1 i 2: czystość i test ────────────────────────────────────────

/** Katalogi reguł: `modules/<x>/domain` oraz dwa pliki przekrojowe w platformie (069 T-10). */
const katalogiRegul = fs
  .readdirSync(modulesDir, { withFileTypes: true })
  .filter((w) => w.isDirectory())
  .map((w) => path.join(modulesDir, w.name, "domain"))
  .filter((p) => fs.existsSync(p));

/**
 * Reguły przekrojowe (069 T-10) — nie należą do żadnego modułu, więc mieszkają w zdolnościach
 * platformy. Wymieniamy je z nazwy, a nie skanujemy całego `src/platform/`: platforma to w większości
 * infrastruktura, która **ma prawo** wołać bazę i sesję. Bramka pilnowałaby wtedy nie tego, co trzeba.
 */
const REGULY_PLATFORMY = [
  "src/platform/ai/conversationTitle.ts",
  "src/platform/favorites/sanitize.ts",
];

let liczbaRegul = 0;

const plikiRegul = [
  ...katalogiRegul.flatMap((k) => plikiTs(k)),
  ...REGULY_PLATFORMY.map((p) => path.join(root, p)),
];

for (const plik of plikiRegul) {
  {
    const wzgl = path.relative(root, plik);
    if (wzgl.includes("__tests__")) continue;
    if (!fs.existsSync(plik)) {
      bledy.push(`${wzgl}: plik reguł wymieniony w bramce nie istnieje — popraw listę w check-domain.js`);
      continue;
    }
    liczbaRegul += 1;
    const tresc = fs.readFileSync(plik, "utf8");

    for (const [wzorzec, opis] of ZAKAZANE) {
      if (wzorzec.test(tresc)) {
        bledy.push(
          `${wzgl}: warstwa reguł sięga po ${opis}. Reguła ma liczyć, a nie pobierać — ` +
            `przenieś to do akcji i podaj wynik parametrem.`
        );
      }
    }

    const nazwa = path.basename(plik, ".ts");
    const test = path.join(path.dirname(plik), "__tests__", `${nazwa}.test.ts`);
    if (!fs.existsSync(test)) {
      bledy.push(
        `${wzgl}: brak testu (${path.relative(root, test)}). Reguła bez testu wraca do stanu, ` +
          `z którego 069 ją wyciągnęło — niesprawdzalnej.`
      );
    }
  }
}

// ─── Kontrola 3: manifest w obie strony ─────────────────────────────────────

if (!fs.existsSync(manifestPath)) {
  console.error(`✗ Brak manifestu ${path.relative(root, manifestPath)}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const wpisy = manifest.moduly ?? {};
const DECYZJE = ["domena", "regula-w-lib", "bez-regul"];

const naDysku = fs
  .readdirSync(modulesDir, { withFileTypes: true })
  .filter((w) => w.isDirectory())
  .map((w) => w.name);

for (const m of naDysku) {
  const wpis = wpisy[m];
  if (!wpis) {
    bledy.push(
      `moduł "${m}" nie ma wpisu w domain-coverage.json. Rozstrzygnij, gdzie są jego reguły ` +
        `(${DECYZJE.join(" | ")}) — bramka nie zgadnie tego za ciebie.`
    );
    continue;
  }
  if (!DECYZJE.includes(wpis.decyzja)) {
    bledy.push(`moduł "${m}": nieznana decyzja "${wpis.decyzja}" (dozwolone: ${DECYZJE.join(", ")})`);
  }
  if (!wpis.powod || wpis.powod.trim().length < 20) {
    bledy.push(`moduł "${m}": brak sensownego uzasadnienia w polu "powod"`);
  }
  if (wpis.decyzja === "domena" && !fs.existsSync(path.join(modulesDir, m, "domain"))) {
    bledy.push(`moduł "${m}": manifest mówi "domena", ale katalog domain/ nie istnieje`);
  }
  if (wpis.decyzja !== "domena" && fs.existsSync(path.join(modulesDir, m, "domain"))) {
    bledy.push(
      `moduł "${m}": ma katalog domain/, ale manifest mówi "${wpis.decyzja}". ` +
        `Zaktualizuj manifest — inaczej opisuje stan, którego nie ma.`
    );
  }
}

for (const m of Object.keys(wpisy)) {
  if (!naDysku.includes(m)) {
    bledy.push(`manifest opisuje moduł "${m}", którego nie ma w src/modules/ — usuń nieaktualny wpis`);
  }
}

// ─── Kontrola 4: zapadka na pomocnikach w plikach akcji ─────────────────────

/** Ten sam sposób liczenia, którym zmierzono zastane 55 — próg i pomiar muszą mierzyć to samo. */
function policzPomocnikow() {
  const pliki = [];
  for (const m of naDysku) plikiTs(path.join(modulesDir, m, "actions"), pliki);
  plikiTs(path.join(root, "src/actions"), pliki);

  let ile = 0;
  const gdzie = [];
  for (const p of pliki) {
    const tresc = fs.readFileSync(p, "utf8");
    if (!/^\s*["']use server["']/m.test(tresc)) continue;
    for (const linia of tresc.split("\n")) {
      if (/^function |^const [a-zA-Z_]+ = \(/.test(linia)) {
        ile += 1;
        gdzie.push(`${path.relative(root, p)}: ${linia.trim().slice(0, 70)}`);
      }
    }
  }
  return { ile, gdzie };
}

const maks = manifest.zapadka?.maks;
if (typeof maks !== "number") {
  bledy.push("manifest nie podaje progu zapadki (`zapadka.maks`)");
} else {
  const { ile, gdzie } = policzPomocnikow();
  if (ile > maks) {
    bledy.push(
      `pomocników w plikach akcji: ${ile}, próg to ${maks}. Nowa reguła w pliku "use server" jest ` +
        `NIESPRAWDZALNA — taki plik nie eksportuje funkcji synchronicznej, więc nie da się jej ` +
        `zaimportować do testu. Przenieś ją do modules/<x>/domain/ razem z testem.\n` +
        gdzie.slice(0, 40).map((g) => `    ${g}`).join("\n")
    );
  } else if (ile < maks) {
    bledy.push(
      `pomocników w plikach akcji: ${ile}, a próg to wciąż ${maks}. Dług zmalał — obniż ` +
        `"zapadka.maks" do ${ile} w src/lib/domain-coverage.json, żeby nie było drogi powrotnej.`
    );
  }
}

// ─── Wynik ──────────────────────────────────────────────────────────────────

if (bledy.length > 0) {
  console.error("✗ Warstwa reguł (zadanie 19):\n");
  for (const b of bledy) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}

const wgDecyzji = Object.values(wpisy).reduce((acc, w) => {
  acc[w.decyzja] = (acc[w.decyzja] ?? 0) + 1;
  return acc;
}, {});
console.log(
  `✓ Warstwa reguł: ${liczbaRegul} plików reguł z testami · ` +
    `${naDysku.length} modułów sklasyfikowanych ` +
    `(domena ${wgDecyzji.domena ?? 0} / w lib ${wgDecyzji["regula-w-lib"] ?? 0} / ` +
    `bez reguł ${wgDecyzji["bez-regul"] ?? 0}) · ` +
    `zapadka ${maks} pomocników w akcjach — trzyma.`
);
