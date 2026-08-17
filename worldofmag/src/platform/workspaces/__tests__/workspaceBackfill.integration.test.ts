import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 054 / ETAP 1 — KOMPLETNOŚĆ BACKFILLU `workspaceId` (migracja 0227).
 *
 * **079: test stracił jedno ze swoich dwóch źródeł prawdy i dlatego zmienił kształt.**
 *
 * Pierwotnie zestawiał dwa niezależne opisy tego samego zbioru: modele ze `schema.prisma`, które
 * mają `workspaceId` **obok** kolumn właścicielskich, i tabele, którym migracja 0227 tę kolumnę
 * dokłada. Rozjazd między nimi oznaczał tabelę bez backfillu — usterkę niewidoczną aż do etapu 4.
 * Migracja 0244 usunęła kolumny właścicielskie, więc **po stronie schematu nie ma już czym odróżnić
 * tabeli LUSTRZANEJ od platformowej** (`DomainEvent`, `ResourceGrant`, `WorkspaceMember` mają
 * `workspaceId` od urodzenia i 0227 ich nie dotyka). Udawanie, że da się to nadal wyprowadzić,
 * dałoby test zielony z niewłaściwego powodu.
 *
 * Co zostaje i nadal może się zepsuć: **wewnętrzna kompletność migracji** (kolumna + indeks +
 * instrukcja backfillu dla KAŻDEJ objętej tabeli) oraz to, że każda tabela, którą 0227 objęła,
 * **nadal istnieje w schemacie i nadal ma tę kolumnę**. Drugi warunek łapie usunięcie kolumny
 * bez usunięcia jej z migracji — czyli dokładnie tę klasę pomyłki, którą etap 4 mógł popełnić.
 *
 * Czego tu już NIE MA: sprawdzenia na danych („czy jakiś rekord z właścicielem mającym przestrzeń
 * został z pustym `workspaceId`"). Pytanie wymagało kolumny właściciela, a odpowiedź na nie jest
 * dziś wymuszona przez `NOT NULL` z migracji 0235 — ma własną asercję w `ownershipScopeSwitch`.
 */

const root = path.join(__dirname, "../../../..");
const schemat = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const migracja = fs.readFileSync(
  path.join(root, "prisma/migrations/0227_workspaceid_etap1/migration.sql"),
  "utf8",
);

/** Tabele, którym 0227 dokłada kolumnę — to jest źródło prawdy o zakresie backfillu. */
const objete = [...migracja.matchAll(/ALTER TABLE "(\w+)" ADD COLUMN\s+"workspaceId"/g)].map(
  (x) => x[1],
);

/** Nazwa TABELI dla każdego modelu ze `schema.prisma` (`@@map` bywa inny niż nazwa modelu). */
function tabeleZeSchematu(): Map<string, string> {
  const out = new Map<string, string>(); // tabela → ciało modelu
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(schemat))) {
    const [, model, cialo] = m;
    const map = cialo.match(/@@map\("([^"]+)"\)/);
    out.set(map ? map[1] : model, cialo);
  }
  return out;
}

test("backfill 054: migracja 0227 jest kompletna dla każdej objętej tabeli", () => {
  assert.ok(objete.length >= 40, `0227 obejmuje tylko ${objete.length} tabel — parser albo migracja są zepsute.`);

  const brakIndeksu = objete.filter(
    (t) => !new RegExp(`CREATE INDEX "${t}_workspaceId_idx"`).test(migracja),
  );
  assert.deepEqual(
    brakIndeksu,
    [],
    `Tabela z kolumną, ale bez indeksu — zapytania zakresowe wchodzą w skan sekwencyjny: ${brakIndeksu.join(", ")}`,
  );

  // Sama kolumna to za mało: tabela z `ADD COLUMN` i indeksem, ale BEZ instrukcji backfillu przejdzie
  // sprawdzenie na pustej bazie i wyjdzie dopiero na produkcji, gdzie dane są.
  const zBackfillem = new Set(
    [...migracja.matchAll(/UPDATE "(\w+)" t SET[\s\S]{0,200}?w\."(personalUserId|teamId)"/g)].map(
      (x) => x[1],
    ),
  );
  const brakBackfillu = objete.filter((t) => !zBackfillem.has(t));
  assert.deepEqual(
    brakBackfillu,
    [],
    `Tabela objęta migracją, ale bez instrukcji backfillu: ${brakBackfillu.join(", ")}`,
  );
});

test("backfill 054: każda objęta tabela nadal istnieje i nadal ma `workspaceId`", () => {
  const wSchemacie = tabeleZeSchematu();
  const znikniete = objete.filter((t) => !wSchemacie.has(t));
  assert.deepEqual(
    znikniete,
    [],
    `0227 dokłada kolumnę tabeli, której nie ma już w schemacie: ${znikniete.join(", ")}`,
  );

  const bezKolumny = objete.filter((t) => !/^\s*workspaceId\s+String\??/m.test(wSchemacie.get(t)!));
  assert.deepEqual(
    bezKolumny,
    [],
    `Tabela straciła \`workspaceId\`, choć 0227 jej ją dokłada — rozjazd migracji ze schematem: ${bezKolumny.join(", ")}`,
  );
});
