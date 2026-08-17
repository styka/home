import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 054 / ETAP 1 — KOMPLETNOŚĆ BACKFILLU `workspaceId`.
 *
 * Migracja 0227 dokłada `workspaceId` do 45 tabel i wypełnia go z przestrzeni zbudowanych w 051.
 * Kolumna nie ma jeszcze ANI JEDNEGO czytelnika, więc luka w backfillu nie objawia się niczym —
 * wyszłaby dopiero w etapie 3 (przełączenie zapytań) albo, najgorzej, w etapie 4 (`NOT NULL`),
 * kiedy migracja padnie na produkcji. Ten test jest jedyną rzeczą, która ją zobaczy wcześniej.
 *
 * **Lista tabel jest WYPROWADZANA ze `schema.prisma`, nie wpisana ręcznie.** Ręczna lista
 * sprawdzałaby te tabele, o których pamiętałem w dniu pisania testu — a pytanie brzmi odwrotnie:
 * czy backfill objął WSZYSTKIE. Dodatkowo test porównuje dwa źródła prawdy (schemat i migrację):
 * model z `workspaceId` bez `ADD COLUMN` w 0227 to rozjazd, którego `check:schema-drift` nie
 * złapie, bo tam obie strony byłyby zgodne dopiero po dopisaniu kolumny w obu miejscach.
 *
 * **Sieroty nie są błędem, tylko liczbą.** Rekord, którego właściciel nie ma przestrzeni (konto
 * skasowane, zespół usunięty), zostaje z NULL świadomie. Etap 4 musi wiedzieć, ile ich jest —
 * więc test je RAPORTUJE zamiast przemilczeć albo wywalić się na nich.
 */

const HAS_DB = !!process.env.DATABASE_URL;

interface Objeta {
  model: string;
  tabela: string;
  maOwnerId: boolean;
  maOwnerTeamId: boolean;
}

/** Modele ze `schema.prisma`, które mają kolumnę `workspaceId`, wraz z nazwą TABELI (`@@map`). */
function objeteModele(schemat: string): Objeta[] {
  const out: Objeta[] = [];
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(schemat))) {
    const [, model, cialo] = m;
    if (!/^\s*workspaceId\s+String\??/m.test(cialo)) continue;
    // 075: `String?` przestało wystarczać jako sito — etap 4 zaostrzył 40 z tych kolumn do `String`.
    // Rozluźnienie wzorca do `String\??` wpuściło jednak trzy tabele PLATFORMOWE (`DomainEvent`,
    // `ResourceGrant`, `WorkspaceMember`), które mają `workspaceId` od urodzenia jako prawdziwy
    // klucz obcy — 0227 ich nie dotyka i dotykać nie powinna. Rozróżnia je własność: kolumna
    // LUSTRZANA istnieje wyłącznie tam, gdzie jest co lustrzać, czyli obok `ownerId`/`ownerTeamId`.
    if (!/^\s*owner(Id|TeamId)\s+String/m.test(cialo)) continue;
    const map = cialo.match(/@@map\("([^"]+)"\)/);
    out.push({
      model,
      // `ProjectGroup` jest zmapowany na `TaskView`. Zapytanie po nazwie modelu wywala się
      // z `relation … does not exist` — dokładnie tak padł pierwszy przebieg backfillu.
      tabela: map ? map[1] : model,
      maOwnerId: /^\s*ownerId\s+String/m.test(cialo),
      maOwnerTeamId: /^\s*ownerTeamId\s+String/m.test(cialo),
    });
  }
  return out;
}

const root = path.join(__dirname, "../../../..");
const schemat = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const migracja = fs.readFileSync(
  path.join(root, "prisma/migrations/0227_workspaceid_etap1/migration.sql"),
  "utf8",
);
const objete = objeteModele(schemat);

test("backfill 054: schemat i migracja 0227 obejmują ten sam zbiór tabel", () => {
  const wMigracji = new Set(
    [...migracja.matchAll(/ALTER TABLE "(\w+)" ADD COLUMN\s+"workspaceId"/g)].map((x) => x[1]),
  );
  const wSchemacie = new Set(objete.map((o) => o.tabela));

  const brakWMigracji = [...wSchemacie].filter((t) => !wMigracji.has(t)).sort();
  const brakWSchemacie = [...wMigracji].filter((t) => !wSchemacie.has(t)).sort();

  assert.deepEqual(
    brakWMigracji,
    [],
    `Model ma \`workspaceId\`, a migracja 0227 nie dokłada kolumny: ${brakWMigracji.join(", ")}`,
  );
  assert.deepEqual(
    brakWSchemacie,
    [],
    `Migracja dokłada kolumnę, a model jej nie ma: ${brakWSchemacie.join(", ")}`,
  );
  assert.ok(objete.length > 0, "Żaden model nie ma `workspaceId` — parser albo schemat są zepsute.");

  // Każda objęta tabela musi mieć czym się wypełnić. Model bez żadnej kolumny właściciela nie
  // należy do tego zbioru (tak wypadł `Task`, którego własność idzie przez `createdById`).
  const bezWlasciciela = objete.filter((o) => !o.maOwnerId && !o.maOwnerTeamId).map((o) => o.model);
  assert.deepEqual(
    bezWlasciciela,
    [],
    `Model z \`workspaceId\`, ale bez \`ownerId\`/\`ownerTeamId\` — backfill nie ma z czego liczyć: ${bezWlasciciela.join(", ")}`,
  );

  // Sama kolumna to za mało: tabela z `ADD COLUMN`, indeksem, ale BEZ instrukcji backfillu przejdzie
  // sprawdzenie na bazie, dopóki jest pusta — i wyjdzie dopiero na produkcji, gdzie dane są.
  // Dlatego pokrycie `UPDATE`-ami sprawdzamy statycznie, niezależnie od zawartości bazy.
  const zOwnerId = new Set(
    [...migracja.matchAll(/UPDATE "(\w+)" t SET[\s\S]{0,200}?w\."personalUserId"/g)].map((x) => x[1]),
  );
  const zOwnerTeamId = new Set(
    [...migracja.matchAll(/UPDATE "(\w+)" t SET[\s\S]{0,200}?w\."teamId"/g)].map((x) => x[1]),
  );
  const brakBackfillu = objete
    .filter((o) => (o.maOwnerId && !zOwnerId.has(o.tabela)) || (o.maOwnerTeamId && !zOwnerTeamId.has(o.tabela)))
    .map((o) => o.tabela);
  assert.deepEqual(
    brakBackfillu,
    [],
    `Tabela ma kolumnę, ale brakuje jej instrukcji backfillu dla którejś z kolumn właściciela: ${brakBackfillu.join(", ")}`,
  );

  const brakIndeksu = objete
    .filter((o) => !new RegExp(`CREATE INDEX "${o.tabela}_workspaceId_idx"`).test(migracja))
    .map((o) => o.tabela);
  assert.deepEqual(
    brakIndeksu,
    [],
    `Tabela z kolumną, ale bez indeksu — etap 3 wejdzie tam w skan sekwencyjny: ${brakIndeksu.join(", ")}`,
  );
});

test(
  "backfill 054: żaden rekord z właścicielem mającym przestrzeń nie został z pustym `workspaceId`",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");

    const luki: string[] = [];
    const sieroty: string[] = [];

    for (const o of objete) {
      const warunki: string[] = [];
      if (o.maOwnerId) {
        warunki.push(
          `(t."ownerId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Workspace" w WHERE w."personalUserId" = t."ownerId"))`,
        );
      }
      if (o.maOwnerTeamId) {
        warunki.push(
          `(t."ownerTeamId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Workspace" w WHERE w."teamId" = t."ownerTeamId"))`,
        );
      }
      const maWlasciciela = [
        o.maOwnerId ? `t."ownerId" IS NOT NULL` : null,
        o.maOwnerTeamId ? `t."ownerTeamId" IS NOT NULL` : null,
      ]
        .filter(Boolean)
        .join(" OR ");

      const [wiersz] = await prisma.$queryRawUnsafe<{ luka: bigint; sierota: bigint }[]>(
        `SELECT
           count(*) FILTER (WHERE ${warunki.join(" OR ")})                       AS luka,
           count(*) FILTER (WHERE NOT (${warunki.join(" OR ")}))                 AS sierota
         FROM "${o.tabela}" t
         WHERE t."workspaceId" IS NULL AND (${maWlasciciela})`,
      );

      if (Number(wiersz.luka) > 0) luki.push(`${o.tabela}: ${wiersz.luka}`);
      if (Number(wiersz.sierota) > 0) sieroty.push(`${o.tabela}: ${wiersz.sierota}`);
    }

    if (sieroty.length > 0) {
      // Nie awaria — informacja dla etapu 4. `NOT NULL` będzie musiał te rekordy albo przypisać,
      // albo usunąć; liczba mówi, o jakiej skali mowa.
      console.log(
        `  ℹ rekordy bez przestrzeni właściciela (świadomie z NULL): ${sieroty.join(", ")}`,
      );
    }

    assert.deepEqual(
      luki,
      [],
      `Rekordy, których backfill nie objął mimo istniejącej przestrzeni właściciela: ${luki.join(", ")}`,
    );
  },
);
