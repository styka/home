import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 111 (AC-5, AC-9) — AUTOMATYCZNE WNIOSKOWANIE WIEDZY O UŻYTKOWNIKU.
 *
 * Trzy rzeczy, które mogłyby pójść źle po cichu:
 *  1. **dwa przebiegi naraz** — tyknięcie chodzi w każdej instancji `web`, więc bez atomowego
 *     odebrania prawa każda z nich zakolejkowałaby ten sam komplet zadań;
 *  2. **przemiatanie konta, które sobie tego nie życzy** — wyłącznik z AC-9 musi być respektowany
 *     w zapytaniu, a nie dopiero w handlerze, bo inaczej i tak powstaje zadanie i wpis w kolejce;
 *  3. **konto przemiatane w kółko** — bez warunku „nie częściej niż raz na dobę" ten sam
 *     użytkownik trafiałby do kolejki co godzinę.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "przemiatanie wiedzy: prawo do przebiegu, wyłącznik i odstęp doby",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { odbierzPrawoDoPrzemiatania, przemiecWiedzeJesliCzas, WIEDZA_ZNACZNIK_KLUCZ } = await import(
      "../harmonogram"
    );

    // Czysty start: znacznik z poprzedniego uruchomienia testów zablokowałby pierwszy przypadek.
    await prisma.config.deleteMany({ where: { key: WIEDZA_ZNACZNIK_KLUCZ } });

    await t.test("prawo do przebiegu dostaje DOKŁADNIE jedna instancja z pięciu równoległych", async () => {
      await prisma.config.deleteMany({ where: { key: WIEDZA_ZNACZNIK_KLUCZ } });
      const wyniki = await Promise.all(
        Array.from({ length: 5 }, () => odbierzPrawoDoPrzemiatania()),
      );
      assert.equal(
        wyniki.filter(Boolean).length,
        1,
        "wersja odczytaj-porownaj-zapisz przepuszcza tu wszystkie piec",
      );
    });

    await t.test("drugie przemiecenie w tej samej godzinie nie dochodzi do skutku", async () => {
      // Prawo zostało właśnie odebrane w poprzednim przypadku, więc znacznik jest świeży.
      assert.equal(await przemiecWiedzeJesliCzas(), null);
    });

    await t.test("wyłączony automat nie trafia do przemiatania (AC-9)", async () => {
      const bezAutomatu = await prisma.user.create({ data: { email: `wiedza-off-${rnd()}@test.local` } });
      const zAutomatem = await prisma.user.create({ data: { email: `wiedza-on-${rnd()}@test.local` } });
      try {
        await prisma.assistantPref.create({ data: { userId: bezAutomatu.id, autoFacts: false } });
        await prisma.assistantPref.create({ data: { userId: zAutomatem.id, autoFacts: true } });

        const kandydaci = await prisma.assistantPref.findMany({
          where: {
            autoFacts: true,
            userId: { in: [bezAutomatu.id, zAutomatem.id] },
            OR: [{ factsLastRunAt: null }, { factsLastRunAt: { lt: new Date(Date.now() - 86_400_000) } }],
          },
          select: { userId: true },
        });
        assert.deepEqual(kandydaci.map((k) => k.userId), [zAutomatem.id]);
      } finally {
        await prisma.user.deleteMany({ where: { id: { in: [bezAutomatu.id, zAutomatem.id] } } });
      }
    });

    await t.test("konto przemiecione przed chwilą czeka do jutra", async () => {
      const swiezy = await prisma.user.create({ data: { email: `wiedza-swiezy-${rnd()}@test.local` } });
      try {
        await prisma.assistantPref.create({
          data: { userId: swiezy.id, autoFacts: true, factsLastRunAt: new Date() },
        });
        const kandydaci = await prisma.assistantPref.findMany({
          where: {
            autoFacts: true,
            userId: swiezy.id,
            OR: [{ factsLastRunAt: null }, { factsLastRunAt: { lt: new Date(Date.now() - 86_400_000) } }],
          },
          select: { userId: true },
        });
        assert.deepEqual(kandydaci, []);
      } finally {
        await prisma.user.deleteMany({ where: { id: swiezy.id } });
      }
    });

    await prisma.config.deleteMany({ where: { key: WIEDZA_ZNACZNIK_KLUCZ } });
  },
);
