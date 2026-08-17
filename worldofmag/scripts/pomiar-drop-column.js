#!/usr/bin/env node
/**
 * NARZĘDZIE POMIAROWE (nie bramka) — ile pracy zostało do `DROP COLUMN` w zadaniu 11, etap 4.
 *
 * Kopiuje `schema.prisma`, usuwa z niego kolumny własnościowe na tabelach objętych etapem,
 * uruchamia `prisma generate` + `tsc`, liczy błędy per plik i PRZYWRACA schemat.
 *
 * Miara ma być twarda, a nie „na oko": kompilator wskazuje dokładnie te miejsca, które przestaną
 * działać w chwili usunięcia kolumn. Uruchamiaj z `worldofmag/`.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SCHEMA = path.join(__dirname, "..", "prisma", "schema.prisma");
const NULLOWALNE = require("../src/lib/db/workspace-nullable.json").nullowalne;

function modele(tekst) {
  const out = [];
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(tekst))) out.push({ nazwa: m[1], cialo: m[2], start: m.index, koniec: re.lastIndex });
  return out;
}

const oryginal = fs.readFileSync(SCHEMA, "utf8");
const wszystkie = modele(oryginal);
const objete = wszystkie.filter(
  (m) =>
    /^\s*workspaceId\s/m.test(m.cialo) &&
    /^\s*(ownerId|ownerTeamId)\s/m.test(m.cialo) &&
    !NULLOWALNE[m.nazwa]
);

console.log(`Tabele objęte etapem 4: ${objete.length}`);

// Usuń pola własnościowe i wszystko, co się do nich odwołuje (relacje, indeksy, unikalności).
let zmieniony = oryginal;
/** Nazwy relacji usuniętych po stronie „dziecka" — po nich znajdziemy przeciwległe pola. */
const usunieteNazwane = new Set();
/** Modele, w których usunięto relację BEZ nazwy — przeciwległe pole też jest bez nazwy. */
const usunieteBezNazwy = new Set();

for (const m of objete) {
  const noweCialo = m.cialo
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      if (/^(ownerId|ownerTeamId)\s/.test(t)) return false;
      if (/^(owner|ownerTeam)\s+\w+\??\s+@relation/.test(t)) {
        const nazwa = /@relation\(\s*"([^"]+)"/.exec(t);
        if (nazwa) usunieteNazwane.add(nazwa[1]);
        else usunieteBezNazwy.add(m.nazwa);
        return false;
      }
      if (/^@@(index|unique)\(\[?[^)]*owner(Id|TeamId)/.test(t)) return false;
      return true;
    })
    .join("\n");
  zmieniony = zmieniony.replace(m.cialo, noweCialo);
}

// Przeciwległe pola relacji (User/Team → zasób) muszą zniknąć razem z nimi.
for (const mod of modele(zmieniony)) {
  const noweCialo = mod.cialo
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      const nazwa = /@relation\(\s*"([^"]+)"/.exec(t);
      if (nazwa && usunieteNazwane.has(nazwa[1])) return false;
      const bezNazwy = /^\w+\s+(\w+)\[\]\s*$/.exec(t);
      if (bezNazwy && usunieteBezNazwy.has(bezNazwy[1])) return false;
      return true;
    })
    .join("\n");
  if (noweCialo !== mod.cialo) zmieniony = zmieniony.replace(mod.cialo, noweCialo);
}

fs.writeFileSync(SCHEMA, zmieniony);
try {
  execSync("npx prisma generate", { stdio: "pipe" });
  let wyjscie = "";
  try {
    execSync("npx tsc --noEmit -p tsconfig.test.json", { stdio: "pipe" });
  } catch (e) {
    wyjscie = e.stdout.toString();
  }
  const linie = wyjscie.split("\n").filter((l) => /^\S.*\(\d+,\d+\): error/.test(l));
  const dziennik = process.env.POMIAR_WYJSCIE;
  if (dziennik) fs.writeFileSync(dziennik, linie.join("\n") + "\n");
  const perPlik = new Map();
  for (const l of linie) {
    const plik = l.split("(")[0];
    perPlik.set(plik, (perPlik.get(plik) || 0) + 1);
  }
  const posortowane = [...perPlik.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\nBłędów: ${linie.length} w ${perPlik.size} plikach\n`);
  for (const [p, n] of posortowane) console.log(`${String(n).padStart(4)}  ${p}`);
  const testy = posortowane.filter(([p]) => /test|__tests__|fixture/.test(p));
  console.log(
    `\nz czego testy/fixture'y: ${testy.reduce((s, [, n]) => s + n, 0)} w ${testy.length} plikach`
  );
} finally {
  fs.writeFileSync(SCHEMA, oryginal);
  execSync("npx prisma generate", { stdio: "pipe" });
  console.log("\nSchemat przywrócony.");
}
