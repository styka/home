import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 065 (zadanie 18) — ASYSTENT NIE OMIJA UPRAWNIEŃ W ZWIERZĘTACH.
 *
 * Bramka `check:ai-access` sprawdza, czy **widać** mechanizm zawężenia. To jest pytanie o obecność,
 * nie o skutek — a rozdz. 12.2.1 mówi o skutku: użytkownik z dostępem `viewer` nie może przez
 * asystenta zmienić cudzego zasobu.
 *
 * Zwierzęta są tu właściwym drugim modułem (po Zadaniach z 052), bo mają **udostępnianie z rolami**
 * (`VIEWER`/`EDITOR`) — czyli jedyne miejsce poza Zadaniami, gdzie „mam dostęp" i „wolno mi zmieniać"
 * to dwie różne rzeczy. Tam, gdzie są tylko dwa stany (moje / nie moje), pomyłka jest znacznie
 * trudniejsza.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "asystent: VIEWER nie zmieni zwierzęcia, a obcy go nie zobaczy",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { assertPetAccess } = await import("../actions/pets");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");

    const wlasciciel = await prisma.user.create({ data: { email: `ap-o-${rnd()}@test.local` } });
    const widz = await prisma.user.create({ data: { email: `ap-v-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `ap-x-${rnd()}@test.local` } });
    for (const u of [wlasciciel, widz, obcy]) await ensurePersonalWorkspace(u.id);

    const zwierze = await prisma.pet.create({
      data: { name: `AP-${rnd()}`, species: "kot", ...(await wlasnoscDoZapisu(wlasciciel.id)) },
    });
    await prisma.petShare.create({
      data: { petId: zwierze.id, userId: widz.id, role: "VIEWER" },
    });

    try {
      await t.test("VIEWER czyta, ale NIE może zmieniać (rozdz. 12.2.1)", async () => {
        // Dokładnie scenariusz z dokumentu: „użytkownik z dostępem viewer mógłby poprosić
        // asystenta o zmianę — i asystent by ją wykonał".
        await assertPetAccess(zwierze.id, widz.id);
        await assert.rejects(
          () => assertPetAccess(zwierze.id, widz.id, true),
          /tylko do odczytu|Brak dostępu/,
        );
      });

      await t.test("obcy nie ma dostępu nawet znając identyfikator", async () => {
        // Asystent dostaje identyfikatory wprost z rozmowy — podanie cudzego nic nie kosztuje.
        await assert.rejects(() => assertPetAccess(zwierze.id, obcy.id), /Brak dostępu/);
      });

      await t.test("właściciel zachowuje pełny dostęp", async () => {
        await assertPetAccess(zwierze.id, wlasciciel.id, true);
      });
    } finally {
      await prisma.petShare.deleteMany({ where: { petId: zwierze.id } });
      await prisma.pet.delete({ where: { id: zwierze.id } });
      for (const u of [wlasciciel, widz, obcy]) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
  },
);
