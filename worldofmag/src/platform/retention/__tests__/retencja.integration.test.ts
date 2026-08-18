import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 083 (zadanie 30, Faza 5) — RETENCJA DANYCH.
 *
 * Trzy rzeczy, które mogłyby pójść źle po cichu, i każda ma tu swój przypadek:
 *  1. **kasowanie za dużo** — polityka mierzy niewłaściwą datę (np. `createdAt` zamiast `updatedAt`),
 *     więc znikają rekordy używane wczoraj;
 *  2. **kasowanie czegoś, co jest pracą do wykonania** — `DomainEvent` bez `deliveredAt` to zdarzenie,
 *     którego worker jeszcze nie przetworzył;
 *  3. **cichy brak przebiegu** — dolna granica retencji śladu audytowego dałaby się obejść zapisem
 *     spoza formularza, a odbieranie prawa do przebiegu przepuściłoby dwie instancje naraz.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);
const dniTemu = (n: number) => new Date(Date.now() - n * 86_400_000);

test(
  "retencja: kasuje stare, oszczędza używane i niedostarczone",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { uruchomRetencje, dniRetencji, kluczKonfiguracji } = await import("../index");
    const { POLITYKI_RETENCJI } = await import("@/lib/retention/polityki");
    const { odbierzPrawoDoPrzebiegu, RETENCJA_ZNACZNIK_KLUCZ } = await import("../harmonogram");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");

    const polityka = (klucz: string) => {
      const p = POLITYKI_RETENCJI.find((x) => x.klucz === klucz);
      assert.ok(p, `brak polityki „${klucz}" — rozdz. 11.6 wymienia ją wprost`);
      return p!;
    };

    const u = await prisma.user.create({ data: { email: `ret-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(u.id);
    const przestrzen = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: u.id } });

    try {
      await t.test("wszystkie tabele z rozdz. 11.6 mają politykę", () => {
        // Lista z dokumentu, przepisana świadomie: jej rolą jest wykryć POLITYKĘ, która zniknęła
        // przy refaktorze. `AiMessage` znika kaskadą razem z rozmową, więc nie ma własnego wpisu.
        for (const klucz of ["user_activity", "ai_conversations", "news_articles", "item_history", "domain_events", "ai_calls", "audit_log"]) {
          polityka(klucz);
        }
      });

      await t.test("dziennik aktywności: stare znika, świeże zostaje", async () => {
        const stary = await prisma.userActivity.create({
          data: { userId: u.id, module: "test", action: `stare-${rnd()}`, createdAt: dniTemu(200) },
        });
        const swiezy = await prisma.userActivity.create({
          data: { userId: u.id, module: "test", action: `swieze-${rnd()}` },
        });
        await uruchomRetencje([polityka("user_activity")]);
        assert.equal(await prisma.userActivity.count({ where: { id: stary.id } }), 0);
        assert.equal(await prisma.userActivity.count({ where: { id: swiezy.id } }), 1, "świeży wpis nie może zniknąć");
      });

      await t.test("podpowiedzi zakupowe liczą OSTATNIE UŻYCIE, nie datę powstania", async () => {
        // Gdyby polityka patrzyła na datę utworzenia, pozycja kupowana co tydzień od pięciu lat
        // znikałaby razem z tą, której nikt nie tknął. Rekord jest STARY i UŻYWANY naraz.
        const uzywany = await prisma.itemHistory.create({
          data: { name: `mleko-${rnd()}`, category: "nabiał", ownerId: u.id },
        });
        const zapomniany = await prisma.itemHistory.create({
          data: { name: `kasza-${rnd()}`, category: "sypkie", ownerId: u.id },
        });
        await prisma.$executeRawUnsafe(
          `UPDATE "ItemHistory" SET "updatedAt" = $2 WHERE "id" = $1`,
          zapomniany.id,
          dniTemu(500)
        );
        await uruchomRetencje([polityka("item_history")]);
        assert.equal(await prisma.itemHistory.count({ where: { id: zapomniany.id } }), 0);
        assert.equal(
          await prisma.itemHistory.count({ where: { id: uzywany.id } }),
          1,
          "pozycja używana niedawno musi zostać, choćby powstała dawno temu"
        );
      });

      await t.test("zdarzenia domenowe: NIEDOSTARCZONE zostają, choćby były stare", async () => {
        // To jest różnica między sprzątaniem a utratą pracy. Po dłuższej awarii workera outbox
        // pełen jest zdarzeń starszych niż 30 dni — i wszystkie trzeba jeszcze dostarczyć.
        const dostarczone = await prisma.domainEvent.create({
          data: {
            type: "test.retencja", module: "test", workspaceId: przestrzen.id, payload: {},
            createdAt: dniTemu(90), deliveredAt: dniTemu(89),
          },
        });
        const zalegajace = await prisma.domainEvent.create({
          data: { type: "test.retencja", module: "test", workspaceId: przestrzen.id, payload: {}, createdAt: dniTemu(90) },
        });
        await uruchomRetencje([polityka("domain_events")]);
        assert.equal(await prisma.domainEvent.count({ where: { id: dostarczone.id } }), 0);
        assert.equal(
          await prisma.domainEvent.count({ where: { id: zalegajace.id } }),
          1,
          "niedostarczone zdarzenie to praca do wykonania, nie śmieć"
        );
      });

      await t.test("dolna granica działa przy ODCZYCIE, nie tylko w formularzu", async () => {
        // Wpis w `Config` da się zmienić z `psql` albo migracją. Gdyby granicy pilnował wyłącznie
        // formularz, ślad audytowy dałoby się skrócić z pominięciem tej kontroli.
        const audyt = polityka("audit_log");
        const key = kluczKonfiguracji(audyt);
        await prisma.config.upsert({ where: { key }, update: { value: "1" }, create: { key, value: "1" } });
        try {
          assert.equal(
            await dniRetencji(audyt),
            audyt.minimumDni,
            "wartość poniżej minimum musi zostać PODNIESIONA, a nie użyta"
          );
        } finally {
          await prisma.config.deleteMany({ where: { key } });
        }
      });

      await t.test("prawo do przebiegu dostaje dokładnie jedna instancja", async () => {
        await prisma.config.deleteMany({ where: { key: RETENCJA_ZNACZNIK_KLUCZ } });
        // Pięć równoległych prób = pięć instancji `web` tykających w tej samej sekundzie.
        const wyniki = await Promise.all(Array.from({ length: 5 }, () => odbierzPrawoDoPrzebiegu()));
        assert.equal(
          wyniki.filter(Boolean).length,
          1,
          "dwie instancje z prawem do przebiegu to dwa równoległe kasowania tych samych wierszy"
        );
        assert.equal(await odbierzPrawoDoPrzebiegu(), false, "przed upływem doby kolejny przebieg się nie należy");
        assert.equal(await odbierzPrawoDoPrzebiegu(0), true, "po upływie odstępu prawo znów przysługuje");
      });

      await t.test("błąd jednej polityki nie zatrzymuje pozostałych", async () => {
        const psuta = { ...polityka("user_activity"), klucz: "psuta", usun: async () => { throw new Error("celowo"); } };
        const wyniki = await uruchomRetencje([psuta, polityka("user_activity")]);
        assert.equal(wyniki.length, 2, "wykonawca musi przejść przez wszystkie polityki");
        assert.match(wyniki[0].blad ?? "", /celowo/);
        assert.equal(wyniki[1].blad, undefined, "kolejna polityka ma się wykonać mimo błędu poprzedniej");
      });
    } finally {
      await prisma.config.deleteMany({ where: { key: RETENCJA_ZNACZNIK_KLUCZ } });
      await prisma.domainEvent.deleteMany({ where: { workspaceId: przestrzen.id } });
      await prisma.itemHistory.deleteMany({ where: { ownerId: u.id } });
      await prisma.userActivity.deleteMany({ where: { userId: u.id } });
      await prisma.workspaceMember.deleteMany({ where: { userId: u.id } });
      await prisma.workspace.deleteMany({ where: { id: przestrzen.id } });
      await prisma.user.deleteMany({ where: { id: u.id } });
    }
  }
);
