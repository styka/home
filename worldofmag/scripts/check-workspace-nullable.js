#!/usr/bin/env node
/**
 * Bramka NULLOWALNOŚCI `workspaceId` (075, zadanie 11 etap 4).
 *
 * Etap 4 zaostrzył `workspaceId` do NOT NULL na 41 z 45 tabel lustrzanych. Cztery zostały
 * nullowalne, bo trzymają REKORDY SYSTEMOWE, które z definicji nie należą do żadnej przestrzeni.
 * To poprawna reguła — ale reguła z wyjątkami rozjeżdża się sama, jeśli nikt jej nie pilnuje:
 * wystarczy, że ktoś doda nowy model i napisze `workspaceId String?` z rozpędu, kopiując sąsiada.
 * Taki model przechodzi build, działa, i dopiero po miesiącach okazuje się, że jego wiersze są
 * poza kontrolą dostępu opartą na przestrzeniach.
 *
 * Trzy kontrole:
 *   1. TABELA Z MANIFESTU MUSI BYĆ NULLOWALNA — wpis bez pokrycia w schemacie to martwy wyjątek.
 *   2. TABELA SPOZA MANIFESTU MUSI BYĆ NOT NULL — to jest właściwa zapadka.
 *   3. SUFIT `maks` — lista może maleć, ale nie rosnąć. Bramka pada TAKŻE przy spadku, żeby
 *      wymusić obniżenie sufitu; inaczej zapadka po cichu poluzowałaby się o odzyskany zapas.
 *
 * Każdy wyjątek wymaga `powod` — bramka nie umie ocenić, czy tabela naprawdę trzyma rekordy
 * systemowe, więc wymusza podjęcie decyzji, a nie jej zgadnięcie. Ten sam wzorzec co
 * `check-ai-coverage`, `check-content-memory` i `check-subscribers`.
 *
 * Na końcu bramka SPRAWDZA SAMĄ SIEBIE dwiema sondami na kopii schematu w pamięci: reguła, która
 * nie zaczerwieni się na złamaniu, jest dekoracją (lekcja z 070 i 071).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "src/lib/db/workspace-nullable.json");
const schemaPath = path.join(root, "prisma/schema.prisma");

/** Zwraca mapę: model → czy `workspaceId` jest nullowalne. Modele bez tej kolumny pomijamy. */
function czytajSchemat(tekst) {
  const wynik = new Map();
  let model = null;
  for (const linia of tekst.split("\n")) {
    const m = /^model (\w+) \{/.exec(linia);
    if (m) {
      model = m[1];
      continue;
    }
    if (linia.trim() === "}") {
      model = null;
      continue;
    }
    if (!model) continue;
    const pole = /^\s*workspaceId\s+String(\?)?/.exec(linia);
    if (pole) wynik.set(model, pole[1] === "?");
  }
  return wynik;
}

function sprawdz(schemat, manifest) {
  const bledy = [];
  const wpisy = manifest.nullowalne ?? {};
  const maks = manifest.maks;

  for (const [model, nullowalne] of schemat) {
    const wpis = wpisy[model];
    if (wpis && !nullowalne) {
      bledy.push(
        `manifest wymienia "${model}" jako nullowalny, a w schemacie \`workspaceId\` jest NOT NULL — usuń martwy wyjątek`
      );
    }
    if (!wpis && nullowalne) {
      bledy.push(
        `model "${model}" ma nullowalne \`workspaceId\`, a nie ma wpisu w workspace-nullable.json. ` +
          `Albo zaostrz kolumnę do NOT NULL (migracją!), albo zadeklaruj, że tabela trzyma rekordy ` +
          `SYSTEMOWE — i napisz dlaczego.`
      );
    }
  }

  for (const [model, wpis] of Object.entries(wpisy)) {
    if (!schemat.has(model)) {
      bledy.push(`manifest opisuje "${model}", który nie ma kolumny \`workspaceId\` — usuń nieaktualny wpis`);
      continue;
    }
    if (!wpis.powod || String(wpis.powod).trim().length < 40) {
      bledy.push(`wyjątek "${model}": brak sensownego uzasadnienia w polu "powod"`);
    }
  }

  const ile = Object.keys(wpisy).length;
  if (typeof maks !== "number") {
    bledy.push('manifest nie ma liczbowego pola "maks" — bez sufitu zapadka nie istnieje');
  } else if (ile > maks) {
    bledy.push(`wyjątków jest ${ile}, a sufit to ${maks}. Zapadka może maleć, nie rosnąć.`);
  } else if (ile < maks) {
    bledy.push(
      `wyjątków jest ${ile}, a sufit wciąż ${maks} — obniż "maks" do ${ile}. ` +
        `Odzyskany zapas nie może zostać jako cichy kredyt na przyszłe wyjątki.`
    );
  }

  return bledy;
}

// ─── Właściwe sprawdzenie ───────────────────────────────────────────────────

if (!fs.existsSync(manifestPath)) {
  console.error(`✗ Brak manifestu ${path.relative(root, manifestPath)}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const tekst = fs.readFileSync(schemaPath, "utf8");
const schemat = czytajSchemat(tekst);

if (schemat.size === 0) {
  console.error("✗ Nie znalazłem w schemacie ANI JEDNEGO modelu z `workspaceId` — parser się rozjechał.");
  process.exit(1);
}

const bledy = sprawdz(schemat, manifest);

// ─── Sondy: czy ta bramka w ogóle potrafi zaczerwienić ──────────────────────
// Bez nich literówka w parserze cicho wyłączyłaby całą kontrolę, a build zostałby zielony.

const sondy = [];
{
  // (a) model spoza manifestu zrobiony nullowalnym → MUSI dać błąd
  const ofiara = [...schemat.keys()].find((m) => !(manifest.nullowalne ?? {})[m]);
  const podrasowany = new Map(schemat);
  podrasowany.set(ofiara, true);
  if (sprawdz(podrasowany, manifest).length === 0) {
    sondy.push(`sonda A: poluzowanie "${ofiara}" do nullowalnego NIE zaczerwieniło bramki`);
  }
}
{
  // (b) model z manifestu zaostrzony → MUSI dać błąd (martwy wyjątek)
  const ofiara = Object.keys(manifest.nullowalne ?? {})[0];
  const podrasowany = new Map(schemat);
  podrasowany.set(ofiara, false);
  if (sprawdz(podrasowany, manifest).length === 0) {
    sondy.push(`sonda B: martwy wyjątek "${ofiara}" NIE zaczerwienił bramki`);
  }
}

if (bledy.length > 0 || sondy.length > 0) {
  console.error("✗ Nullowalność `workspaceId` (zadanie 11, etap 4):\n");
  for (const b of bledy) console.error(`  • ${b}`);
  for (const s of sondy) console.error(`  • ${s}`);
  console.error("");
  process.exit(1);
}

const nullowalnych = Object.keys(manifest.nullowalne).length;
console.log(
  `✓ Nullowalność \`workspaceId\`: ${schemat.size - nullowalnych} tabel NOT NULL, ` +
    `${nullowalnych} świadomych wyjątków (rekordy systemowe, sufit ${manifest.maks}); 2 sondy zaczerwieniły bramkę.`
);
