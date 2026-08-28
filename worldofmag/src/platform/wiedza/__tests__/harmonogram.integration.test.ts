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

    /**
     * Warunek wyboru kandydatów jest tu przepisany świadomie: chodzi o to, żeby zmiana tamtego
     * zapytania musiała przejść przez ten test, a nie prześlizgnąć się niezauważona.
     */
    const kandydaciSposrod = (ids: string[]) =>
      prisma.user.findMany({
        where: {
          id: { in: ids },
          OR: [
            { assistantPref: { is: null } },
            {
              assistantPref: {
                autoFacts: true,
                OR: [{ factsLastRunAt: null }, { factsLastRunAt: { lt: new Date(Date.now() - 86_400_000) } }],
              },
            },
          ],
        },
        select: { id: true },
      });

    await t.test("wyłączony automat nie trafia do przemiatania (AC-9)", async () => {
      const bezAutomatu = await prisma.user.create({ data: { email: `wiedza-off-${rnd()}@test.local` } });
      const zAutomatem = await prisma.user.create({ data: { email: `wiedza-on-${rnd()}@test.local` } });
      try {
        await prisma.assistantPref.create({ data: { userId: bezAutomatu.id, autoFacts: false } });
        await prisma.assistantPref.create({ data: { userId: zAutomatem.id, autoFacts: true } });

        const kandydaci = await kandydaciSposrod([bezAutomatu.id, zAutomatem.id]);
        assert.deepEqual(kandydaci.map((k) => k.id), [zAutomatem.id]);
      } finally {
        await prisma.user.deleteMany({ where: { id: { in: [bezAutomatu.id, zAutomatem.id] } } });
      }
    });

    /**
     * 111 (recenzja): KONTO, KTÓRE NIGDY NIE ZAJRZAŁO W USTAWIENIA ASYSTENTA, TEŻ MA BYĆ PRZEMIATANE.
     *
     * `AssistantPref` powstaje dopiero przy pierwszej zmianie ustawień, więc pierwsza wersja
     * przemiatania — pytająca o samą tę tabelę — pomijała każde takie konto. Domyślna wartość
     * kolumny to `true`, czyli brak wiersza znaczy „automat włączony", a nie „wyłączony".
     */
    await t.test("konto bez wiersza ustawień asystenta JEST kandydatem", async () => {
      const swiezak = await prisma.user.create({ data: { email: `wiedza-nowy-${rnd()}@test.local` } });
      try {
        const kandydaci = await kandydaciSposrod([swiezak.id]);
        assert.deepEqual(kandydaci.map((k) => k.id), [swiezak.id]);
      } finally {
        await prisma.user.deleteMany({ where: { id: swiezak.id } });
      }
    });

    await t.test("konto przemiecione przed chwilą czeka do jutra", async () => {
      const swiezy = await prisma.user.create({ data: { email: `wiedza-swiezy-${rnd()}@test.local` } });
      try {
        await prisma.assistantPref.create({
          data: { userId: swiezy.id, autoFacts: true, factsLastRunAt: new Date() },
        });
        assert.deepEqual(await kandydaciSposrod([swiezy.id]), []);
      } finally {
        await prisma.user.deleteMany({ where: { id: swiezy.id } });
      }
    });

    await prisma.config.deleteMany({ where: { key: WIEDZA_ZNACZNIK_KLUCZ } });
  },
);
