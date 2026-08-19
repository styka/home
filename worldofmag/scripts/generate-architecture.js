#!/usr/bin/env node
/**
 * GENERATOR PRZEGLĄDU ARCHITEKTURY (094, zadanie 45; rozdz. 13.F9).
 *
 * `/admin/architecture` była stroną **pisaną ręcznie** i dlatego nieaktualną: mówiła „SQLite (lokalne
 * dev)" długo po przejściu na Postgresa i nosiła datę „ostatnia aktualizacja: 2026-06-01". To jest
 * przewidywalny los każdego opisu struktury utrzymywanego osobno od struktury.
 *
 * Dlatego liczby i listy są **wyprowadzane**, nie przepisywane: zdolności platformy z katalogu
 * `src/platform`, moduły z `src/modules`, bramki z polecenia `build` w `package.json`, liczba modeli
 * i migracji z `prisma/`. Ta strona nie może się rozjechać ze stanem repozytorium, bo nie ma z czym
 * — jej treść JEST stanem repozytorium.
 *
 * Czego generator świadomie NIE robi: nie opisuje, **dlaczego** coś jest tak zrobione. Na to są dwie
 * książki (`/admin/architektura-docelowa` i `/admin/audyt`) i dziennik przebiegów; strona przeglądowa
 * ma odpowiadać na „co tu jest", a nie zastępować uzasadnień.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "src/generated/architecture.ts");

function katalogi(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return [];
  return fs
    .readdirSync(p, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "__tests__")
    .map((e) => e.name)
    .sort();
}

function pliki(rel, wzor) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter((f) => wzor.test(f)).sort();
}

// ── Zdolności platformy: katalogi + pojedyncze pliki (np. `pagination.ts`, `calendar.ts`) ──
const zdolnosciPlatformy = [
  ...katalogi("src/platform"),
  ...pliki("src/platform", /\.ts$/).filter((f) => !f.endsWith(".json")).map((f) => f.replace(/\.ts$/, "")),
].sort();

const moduly = katalogi("src/modules");

// ── Bramki: wyciągnięte z polecenia `build`, żeby lista nie mogła się rozjechać z buildem ──
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const bramki = [...(pkg.scripts?.build ?? "").matchAll(/scripts\/(check-[\w-]+)\.js/g)].map((m) => m[1]).sort();
const bakowanie = [...(pkg.scripts?.build ?? "").matchAll(/scripts\/(copy-[\w-]+|generate-[\w-]+)\.js/g)]
  .map((m) => m[1])
  .sort();

// ── Baza: modele i migracje ──
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const modele = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
const migracje = katalogi("prisma/migrations");
const zWersja = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
  .filter(([, , body]) => /^\s*version\s+Int/m.test(body))
  .map(([, nazwa]) => nazwa);
const zPrzestrzenia = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
  .filter(([, , body]) => /^\s*workspaceId\s/m.test(body))
  .map(([, nazwa]) => nazwa);

// ── Zapadki i ich progi: czytamy manifesty, a nie przepisujemy liczby ──
function prog(rel, pole) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"))[pole] ?? null;
  } catch {
    return null;
  }
}
const zapadki = [
  { nazwa: "Najcięższa trasa (bajty JS)", wartosc: prog("src/lib/ui/perf-baseline.json", "najciezszaTrasaB"), bramka: "check:perf" },
].filter((z) => z.wartosc !== null);

const tresc = `// PLIK GENEROWANY — nie edytuj ręcznie.
// Źródło: scripts/generate-architecture.js (094, zadanie 45). Uruchamiane w \`npm run build\`.
//
// Powód, dla którego to jest generowane, a nie pisane: poprzednia wersja strony
// \`/admin/architecture\` była pisana ręcznie i mówiła „SQLite (lokalne dev)" długo po przejściu na
// Postgresa. Opis struktury utrzymywany osobno od struktury zawsze się rozjeżdża.

export interface PrzegladArchitektury {
  wygenerowano: string;
  zdolnosciPlatformy: string[];
  moduly: string[];
  bramki: string[];
  bakowanie: string[];
  liczbaModeli: number;
  liczbaMigracji: number;
  modeleZWersja: string[];
  modeleZPrzestrzenia: string[];
  zapadki: { nazwa: string; wartosc: number; bramka: string }[];
}

export const PRZEGLAD_ARCHITEKTURY: PrzegladArchitektury = ${JSON.stringify(
  {
    wygenerowano: new Date().toISOString(),
    zdolnosciPlatformy,
    moduly,
    bramki,
    bakowanie,
    liczbaModeli: modele.length,
    liczbaMigracji: migracje.length,
    modeleZWersja: zWersja,
    modeleZPrzestrzenia: zPrzestrzenia,
    zapadki,
  },
  null,
  2,
)};
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, tresc);
console.log(
  `✓ generate-architecture: ${moduly.length} modułów, ${zdolnosciPlatformy.length} zdolności platformy, ` +
    `${bramki.length} bramek, ${modele.length} modeli, ${migracje.length} migracji → src/generated/architecture.ts`,
);
