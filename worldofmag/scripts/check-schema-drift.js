#!/usr/bin/env node
/**
 * Bramka ROZJAZDU SCHEMATU (Faza 0, zadanie 3 przebudowy).
 *
 * Problem, który rozwiązuje: `schema.prisma` i katalog migracji to DWA źródła prawdy o kształcie
 * bazy, a nic ich nie porównywało. Edycja modelu bez napisania migracji przechodzi lokalnie
 * (bo `prisma generate` czyta schemat) i wywala się dopiero na produkcji, gdzie `migrate deploy`
 * stosuje wyłącznie pliki migracji. To jest ten rodzaj błędu, który wychodzi po wdrożeniu.
 *
 * Bramka staje się krytyczna przed Fazą 2 przebudowy: migracja `workspaceId` na 46 modelach to
 * najgroźniejsze zadanie całej listy, a robi się je czterema krokami — po każdym schemat i migracje
 * MUSZĄ się zgadzać, inaczej krok piąty pracuje na wyobrażeniu o bazie.
 *
 * Jak działa: `prisma migrate diff` porównuje stan wynikający z katalogu migracji ze stanem
 * opisanym w `schema.prisma`. Pusty diff = zgoda. Niepusty = ktoś zmienił schemat bez migracji
 * (albo odwrotnie).
 *
 * WYMAGA BAZY CIENIA (shadow database) — Prisma odtwarza na niej migracje po kolei. Bez
 * `DATABASE_URL` bramka **przepuszcza** z ostrzeżeniem zamiast wywalać build: na środowisku bez
 * bazy (np. czysty klon) nie ma jak porównać, a blokowanie builda z tego powodu zamieniłoby bramkę
 * w przeszkodę, którą wszyscy wyłączają.
 *
 * ŚWIADOME WYJĄTKI: `src/lib/db/schema-drift-allowed.json`. Prisma raportuje kilka różnic, które
 * NIE są rozjazdem, tylko granicą jej możliwości (np. indeksy `pg_trgm` tworzone surowym SQL-em —
 * `schema.prisma` nie umie ich wyrazić, więc `migrate diff` zawsze zgłosi ich brak).
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const allowPath = path.join(root, "src/lib/db/schema-drift-allowed.json");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log("• Rozjazd schematu: pominięty (brak DATABASE_URL — nie ma na czym odtworzyć migracji).");
  process.exit(0);
}

if (/neon\.tech|render\.com/.test(dbUrl) && !process.env.ALLOW_DRIFT_CHECK_ON_REMOTE) {
  // C-13: bramka tworzy i kasuje bazę cienia. Na produkcyjnym połączeniu to niedopuszczalne.
  console.log("• Rozjazd schematu: pominięty (zdalna baza — bramka nie tworzy bazy cienia na produkcji).");
  process.exit(0);
}

/**
 * Baza cienia musi być ODDZIELNA bazą, nie tą z `DATABASE_URL`.
 *
 * Recenzja 048: bramka podawała jako `--shadow-database-url` **to samo** połączenie co robocze.
 * Prisma czyści bazę cienia przed odtworzeniem migracji, więc każde uruchomienie
 * `npm run check:schema-drift` (a więc i każdy `npm run build`) **kasowało lokalną bazę
 * deweloperską** — łącznie z `_prisma_migrations`. Objaw był mylący: `next build` przechodził,
 * a wywracał się dopiero końcowy `scripts/migrate.js` z błędem P3005 („schema is not empty"),
 * czyli w miejscu, które z przyczyną nie miało nic wspólnego.
 *
 * Nazwę bazy cienia wyprowadzamy z roboczej (`<db>_shadow`) i tworzymy ją, jeśli nie istnieje.
 * Gdyby się nie dało (brak uprawnień do CREATE DATABASE), bramkę POMIJAMY — lepiej stracić
 * jedno sprawdzenie niż czyjeś dane.
 */
function shadowUrl(url) {
  const u = new URL(url);
  const dbName = u.pathname.replace(/^\//, "") || "postgres";
  u.pathname = `/${dbName}_shadow`;
  return { url: u.toString(), name: `${dbName}_shadow` };
}

let shadow;
try {
  shadow = shadowUrl(dbUrl);
  const admin = new URL(dbUrl);
  admin.pathname = "/postgres";
  // `CREATE DATABASE` nie ma `IF NOT EXISTS`, więc powtórzone uruchomienie zwróci błąd — i dobrze,
  // bo to znaczy, że baza już jest. Rozróżniamy to od realnego braku uprawnień po treści błędu.
  try {
    execFileSync("npx", ["prisma", "db", "execute", "--url", admin.toString(), "--stdin"], {
      cwd: root, input: `CREATE DATABASE "${shadow.name}";`, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    // 051: „nie umiem utworzyć" NIE znaczy „nie ma". Rola bez uprawnienia CREATEDB dostaje
    // `permission denied to create database` także wtedy, gdy baza cienia już istnieje (założona
    // przez administratora) — a wcześniej bramka milkła w takim układzie i **pomijała kontrolę**,
    // czyli była najcichsza dokładnie tam, gdzie najbardziej potrzebna. Zamiast ufać treści błędu,
    // sprawdzamy stan faktyczny: czy da się połączyć z bazą cienia.
    if (!/already exists/i.test(String(e.stderr || e.message))) {
      execFileSync("npx", ["prisma", "db", "execute", "--url", shadow.url, "--stdin"], {
        cwd: root, input: "SELECT 1;", encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
      });
    }
  }
} catch (e) {
  console.log(
    "• Rozjazd schematu: pominięty (nie udało się przygotować bazy cienia — bramka nigdy nie użyje bazy roboczej jako cienia).",
  );
  process.exit(0);
}

let out;
try {
  out = execFileSync(
    "npx",
    [
      "prisma", "migrate", "diff",
      "--from-migrations", "prisma/migrations",
      "--to-schema-datamodel", "prisma/schema.prisma",
      "--shadow-database-url", shadow.url,
      "--script",
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (e) {
  console.error("✖ Rozjazd schematu: nie udało się porównać migracji ze schematem.");
  console.error(String(e.stderr || e.message).trim().split("\n").slice(-6).join("\n"));
  process.exit(1);
}

const allowed = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, "utf8")) : { patterns: [] };
const patterns = (allowed.patterns || []).map((p) => new RegExp(p.pattern, "i"));

// Zostawiamy wyłącznie realne instrukcje SQL; komentarze i puste linie nie są rozjazdem.
const statements = out
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("--"))
  .filter((l) => !patterns.some((re) => re.test(l)));

if (statements.length === 0) {
  const skipped = (allowed.patterns || []).length;
  console.log(
    `✓ Rozjazd schematu: brak — migracje odtwarzają dokładnie \`schema.prisma\`` +
      (skipped > 0 ? ` (${skipped} świadomych wyjątków).` : "."),
  );
  process.exit(0);
}

console.error("\n✖ Rozjazd schematu: `schema.prisma` NIE zgadza się z katalogiem migracji.\n");
console.error("  Brakujące instrukcje (to, czego migracje nie robią, a schemat opisuje):\n");
for (const s of statements.slice(0, 25)) console.error(`    ${s}`);
if (statements.length > 25) console.error(`    …i ${statements.length - 25} więcej`);
console.error(
  "\n  Napraw jedną z dwóch dróg:\n" +
    "   · zmiana miała trafić do bazy → dopisz RĘCZNĄ migrację (C-10), numer z `npm run next:migration`;\n" +
    "   · zmiana schematu była pomyłką → cofnij ją w `schema.prisma`.\n" +
    "  Jeśli różnica jest granicą Prismy (np. indeks `pg_trgm` tworzony surowym SQL-em), dopisz\n" +
    "  wzorzec do `src/lib/db/schema-drift-allowed.json` z uzasadnieniem.\n",
);
process.exit(1);
