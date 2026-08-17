import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 079 (U-5 z przeglądu 078) — ODŚWIEŻENIE KOPII WŁASNOŚCI I KONTROLA LICZNOŚCI.
 *
 * `_KopiaWlasnosci` (migracja 0233) to jedyny odwrót od `DROP COLUMN`: kod da się cofnąć `git
 * revert`-em, dane nie. Kopia była jednak **migawką sprzed wielu tygodni** i nic nie pilnowało jej
 * świeżości — wstawka miała `ON CONFLICT DO NOTHING`, więc rekord, który od tamtej pory zmienił
 * właściciela, miał w kopii wartość NIEAKTUALNĄ. Przywrócenie z takiej kopii rozdałoby część danych
 * nie tym kontom, czyli dałoby awarię gorszą niż ta, przed którą kopia broni.
 *
 * Migracja 0244 zaczyna się więc od odświeżenia kopii i kontroli liczności per tabela. Problem
 * z dowodzeniem tego: **migracja wykonuje się RAZ**, na bazie, która w środowisku pracy jest pusta
 * — czyli w warunkach, w których każdy błąd przechodzi.
 *
 * Dlatego ten test **czyta oba bloki `DO` WPROST Z PLIKU MIGRACJI** i uruchamia je na danych.
 * Nie jest to kopia logiki (ta rozjechałaby się z oryginałem przy pierwszej poprawce) — to ten sam
 * tekst SQL, wykonany na fixture, który zawiera dokładnie te trzy sytuacje, dla których odświeżenie
 * powstało: wartość ZMIENIONĄ, wiersz NOWY i wiersz USUNIĘTY ze źródła.
 *
 * Pracujemy na `NoteGroup` — jednej z pięciu tabel, które zachowały kolumny własnościowe
 * (`workspace-nullable.json`). Na pozostałych 40 kopia jest już tylko archiwum.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

/** Wycina blok `DO $tag$ … $tag$;` z pliku migracji — bez przepisywania jego treści. */
function blok(sql: string, tag: string): string {
  const start = sql.indexOf(`DO $${tag}$`);
  const koniec = sql.indexOf(`$${tag}$;`, start);
  if (start < 0 || koniec < 0) throw new Error(`Nie znalazłem bloku $${tag}$ w migracji 0244`);
  return sql.slice(start, koniec + `$${tag}$;`.length);
}

test(
  "0244: odświeżenie kopii własności aktualizuje, dopisuje i sprząta",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace } = await import("../sync");

    const migracja = fs.readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/0244_usuniecie_kolumn_wlasnosciowych/migration.sql",
      ),
      "utf8",
    );
    const ODSWIEZ = blok(migracja, "odswiez");
    const KONTROLA = blok(migracja, "kontrola");

    const a = await prisma.user.create({ data: { email: `kop-a-${rnd()}@test.local` } });
    const b = await prisma.user.create({ data: { email: `kop-b-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(a.id);
    await ensurePersonalWorkspace(b.id);

    const grupa = await prisma.noteGroup.create({
      data: { name: `kopia-${rnd()}`, ownerId: a.id },
    });
    const doUsuniecia = await prisma.noteGroup.create({
      data: { name: `kopia-zniknie-${rnd()}`, ownerId: a.id },
    });

    const wKopii = async (id: string) =>
      prisma.$queryRawUnsafe<{ ownerId: string | null }[]>(
        `SELECT "ownerId" FROM "_KopiaWlasnosci" WHERE "tabela" = 'NoteGroup' AND "wiersz" = $1`,
        id,
      );

    try {
      await t.test("pierwszy przebieg zapisuje aktualnego właściciela", async () => {
        await prisma.$executeRawUnsafe(ODSWIEZ);
        const [wiersz] = await wKopii(grupa.id);
        assert.equal(wiersz?.ownerId, a.id, "kopia musi znać właściciela z chwili odświeżenia");
      });

      await t.test("ZMIANA właściciela trafia do kopii — to jest sedno U-5", async () => {
        // Dokładnie ten przypadek psuła stara wstawka z `ON CONFLICT DO NOTHING`: wiersz w kopii
        // już był, więc nowa wartość nie miała jak się zapisać i archiwum cicho kłamało.
        await prisma.noteGroup.update({ where: { id: grupa.id }, data: { ownerId: b.id } });
        await prisma.$executeRawUnsafe(ODSWIEZ);
        const [wiersz] = await wKopii(grupa.id);
        assert.equal(wiersz?.ownerId, b.id, "kopia z ON CONFLICT DO NOTHING zostałaby przy starym właścicielu");
      });

      await t.test("wiersz USUNIĘTY ze źródła znika z kopii", async () => {
        await prisma.noteGroup.delete({ where: { id: doUsuniecia.id } });
        await prisma.$executeRawUnsafe(ODSWIEZ);
        assert.equal((await wKopii(doUsuniecia.id)).length, 0, "kopia z historią nie przeszłaby kontroli liczności");
      });

      await t.test("kontrola liczności przechodzi po odświeżeniu", async () => {
        await prisma.$executeRawUnsafe(ODSWIEZ);
        await prisma.$executeRawUnsafe(KONTROLA); // brak wyjątku = zgodność
      });

      await t.test("kontrola liczności PRZERYWA przy rozjeździe", async () => {
        // Sonda: bez tego przypadku „kontrola przeszła" nie znaczyłoby nic — blok, który nigdy nie
        // rzuca, przechodzi zawsze. Psujemy kopię celowo i wymagamy wyjątku.
        await prisma.$executeRawUnsafe(
          `DELETE FROM "_KopiaWlasnosci" WHERE "tabela" = 'NoteGroup' AND "wiersz" = $1`,
          grupa.id,
        );
        await assert.rejects(
          () => prisma.$executeRawUnsafe(KONTROLA),
          /Kopia własności nie pokrywa danych/,
          "rozjazd liczności musi przerwać migrację, a nie zostać przemilczany",
        );
        // Przywracamy spójność, żeby test nie zostawiał po sobie zepsutej kopii.
        await prisma.$executeRawUnsafe(ODSWIEZ);
      });
    } finally {
      await prisma.noteGroup.deleteMany({ where: { ownerId: { in: [a.id, b.id] } } });
      await prisma.$executeRawUnsafe(
        `DELETE FROM "_KopiaWlasnosci" WHERE "tabela" = 'NoteGroup' AND "wiersz" = ANY($1::text[])`,
        [grupa.id, doUsuniecia.id],
      );
      await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    }
  },
);
