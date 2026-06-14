// Strażnik numeracji migracji Prisma (read-only — NIE dotyka bazy ani plików).
//
// Po co: równoległe gałęzie `claude/*` tworzyły migracje z tym samym numerem
// (np. dwa katalogi `0109_*`). Same w sobie są nieszkodliwe (Prisma identyfikuje
// migracje po PEŁNEJ nazwie katalogu), ale to bałagan. Przemianowanie już
// ZAAPLIKOWANYCH migracji jest natomiast groźne (`prisma migrate deploy` uznałby
// je za nowe i uruchomił ponownie → przy CREATE/ALTER deploy pada). Dlatego nie
// czyścimy przeszłości — pilnujemy tylko, by NOWE migracje miały unikalny, kolejny
// numer. 12 istniejących kolizji jest celowo „grandfathered" (LEGACY_DUPLICATES).
//
// Użycie:
//   node scripts/check-migrations.js          # weryfikacja (exit 1 przy nowej kolizji)
//   node scripts/check-migrations.js --next    # wypisz następny wolny numer i wyjdź

const fs = require("fs")
const path = require("path")

const MIGRATIONS_DIR = path.join(__dirname, "..", "prisma", "migrations")

// Numery, które mają już po kilka katalogów w historii repo. Zostają nietknięte.
// NIE dopisuj tu nowych numerów — nowa kolizja ma być błędem, nie wyjątkiem.
const LEGACY_DUPLICATES = new Set([
  "0043", "0049", "0074", "0077", "0078",
  "0095", "0096", "0099", "0100", "0102", "0103", "0109",
])

function migrationNumbers() {
  const groups = new Map() // prefix -> [dirName, ...]
  for (const entry of fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const m = entry.name.match(/^(\d{4})_/)
    if (!m) continue
    const prefix = m[1]
    if (!groups.has(prefix)) groups.set(prefix, [])
    groups.get(prefix).push(entry.name)
  }
  return groups
}

function nextNumber(groups) {
  const max = [...groups.keys()].reduce((a, p) => Math.max(a, parseInt(p, 10)), 0)
  return String(max + 1).padStart(4, "0")
}

function main() {
  const groups = migrationNumbers()

  if (process.argv.includes("--next")) {
    process.stdout.write(nextNumber(groups) + "\n")
    return
  }

  const offenders = []
  for (const [prefix, dirs] of groups) {
    if (dirs.length > 1 && !LEGACY_DUPLICATES.has(prefix)) {
      offenders.push({ prefix, dirs })
    }
  }

  if (offenders.length > 0) {
    console.error("✘ Wykryto NOWĄ kolizję numeracji migracji:")
    for (const { prefix, dirs } of offenders) {
      console.error(`  ${prefix}: ${dirs.join(", ")}`)
    }
    console.error(`\nNadaj nowej migracji unikalny, kolejny numer: ${nextNumber(groups)}`)
    console.error("(Nie przemianowuj już zaaplikowanych migracji — to zrywa `migrate deploy`.)")
    process.exit(1)
  }

  console.log(`✔ Numeracja migracji OK (następny wolny numer: ${nextNumber(groups)}).`)
}

main()
