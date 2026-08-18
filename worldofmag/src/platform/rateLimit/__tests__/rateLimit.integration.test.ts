import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * 081 (zadanie 26) — LIMITER DZIAŁA MIĘDZY PROCESAMI.
 *
 * Test, o który prosi rozdz. 11.2 wprost: **z dwoma procesami**. Poprzednia implementacja trzymała
 * liczniki w `Map` w pamięci — każdy test jednoprocesowy przechodził, a na produkcji z wieloma
 * instancjami globalny limit po prostu nie istniał. Regres tej klasy jest niewidoczny dla wszystkich
 * innych rodzajów testów, więc drugi proces jest tu warunkiem sensu, a nie ozdobą.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "limiter dzieli licznik między procesami i slotami",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { sprawdzLimit, zajmijSlot, posprzatajLimity } = await import("../index");
    const { POLITYKI } = await import("../polityki");
    const { prisma } = await import("@/platform/db/prisma");

    const sprzataczki: string[] = [];
    const podmiot = () => {
      const p = `test-${rnd()}`;
      sprzataczki.push(p);
      return p;
    };

    try {
      await t.test("pod limitem przechodzi, po przekroczeniu odmawia z czasem oczekiwania", async () => {
        const u = podmiot();
        const limit = POLITYKI.zaproszenia.naMinute!;
        for (let i = 0; i < limit; i++) {
          assert.equal((await sprawdzLimit("zaproszenia", u)).ok, true, `żądanie ${i + 1} powinno przejść`);
        }
        const nadmiar = await sprawdzLimit("zaproszenia", u);
        assert.equal(nadmiar.ok, false, "żądanie ponad limit musi zostać odrzucone");
        if (!nadmiar.ok) {
          assert.ok(nadmiar.retryAfterSec > 0 && nadmiar.retryAfterSec <= 60, "czas oczekiwania musi mieścić się w oknie");
          assert.equal(nadmiar.message, POLITYKI.zaproszenia.komunikatMinuta);
        }
      });

      await t.test("dobijanie się NIE przedłuża okna", async () => {
        // Świadoma decyzja polityki: licznik rośnie dalej, ale `resetAt` zostaje. Gdyby okno się
        // przesuwało, użytkownik odświeżający stronę w pętli zablokowałby się na stałe.
        const u = podmiot();
        for (let i = 0; i < POLITYKI.zaproszenia.naMinute! + 1; i++) await sprawdzLimit("zaproszenia", u);
        const pierwszy = await sprawdzLimit("zaproszenia", u);
        const drugi = await sprawdzLimit("zaproszenia", u);
        assert.equal(pierwszy.ok, false);
        assert.equal(drugi.ok, false);
        if (!pierwszy.ok && !drugi.ok) {
          assert.ok(
            drugi.retryAfterSec <= pierwszy.retryAfterSec,
            "kolejna odmowa nie może odsuwać terminu odblokowania"
          );
        }
      });

      await t.test("DRUGI PROCES zużywa ten sam licznik", async () => {
        const u = podmiot();
        const limit = POLITYKI.zaproszenia.naMinute!; // 5
        const wDziecku = 3;

        const wynik = execFileSync(
          process.execPath,
          ["--import", "tsx", path.join(process.cwd(), "src/platform/rateLimit/__tests__/dzieckoLimitu.ts"), "zaproszenia", u, String(wDziecku)],
          { encoding: "utf8", env: process.env, cwd: process.cwd() }
        ).trim();
        const przeszloWDziecku = Number(wynik);
        assert.equal(przeszloWDziecku, wDziecku, "drugi proces powinien zmieścić się w limicie");

        let przeszloTutaj = 0;
        for (let i = 0; i < limit; i++) {
          if ((await sprawdzLimit("zaproszenia", u)).ok) przeszloTutaj++;
        }

        // TO jest cała treść testu: suma z OBU procesów, a nie wynik żadnego z nich osobno.
        // Z licznikiem w pamięci procesu byłoby 3 + 5 = 8 i test świeciłby na czerwono.
        assert.equal(
          przeszloWDziecku + przeszloTutaj,
          limit,
          "oba procesy muszą zużywać JEDEN licznik — inaczej limit globalny nie istnieje"
        );
      });

      await t.test("sloty współbieżności: N zajętych, N+1 odrzucony, zwolnienie oddaje slot", async () => {
        const u = podmiot();
        const n = POLITYKI["ai.agent"].rownolegle!;
        const zwalniacze: (() => Promise<void>)[] = [];
        for (let i = 0; i < n; i++) {
          const z = await zajmijSlot("ai.agent", u);
          assert.ok(z, `slot ${i + 1} powinien być wolny`);
          zwalniacze.push(z!);
        }
        assert.equal(await zajmijSlot("ai.agent", u), null, `slot ${n + 1} musi zostać odrzucony`);
        await zwalniacze[0]();
        const poZwolnieniu = await zajmijSlot("ai.agent", u);
        assert.ok(poZwolnieniu, "po zwolnieniu slot musi być znowu do wzięcia");
        await poZwolnieniu!();
        for (const z of zwalniacze.slice(1)) await z();
      });

      await t.test("zwolnienie jest idempotentne i nie zwalnia CUDZEJ dzierżawy", async () => {
        const u = podmiot();
        const klucz = `ai.agent:${u}`;
        const zwolnij = (await zajmijSlot("ai.agent", u))!;
        assert.ok(zwolnij);

        // Symulujemy proces, który padł: dzierżawa wygasa, slot przejmuje ktoś inny…
        await prisma.rateLimitLease.updateMany({
          where: { key: klucz, slot: 0 },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        const nowy = await zajmijSlot("ai.agent", u);
        assert.ok(nowy, "wygasła dzierżawa musi dać się przejąć — inaczej awaria procesu blokuje konto na zawsze");
        const poPrzejeciu = await prisma.rateLimitLease.findFirst({ where: { key: klucz, slot: 0 } });

        // …a spóźnione `finally` pierwszego procesu NIE MOŻE tego slotu skasować.
        await zwolnij();
        await zwolnij(); // drugi raz: idempotencja
        const potem = await prisma.rateLimitLease.findFirst({ where: { key: klucz, slot: 0 } });
        assert.equal(
          potem?.holder,
          poPrzejeciu?.holder,
          "spóźnione zwolnienie skasowało cudzą dzierżawę — trzecia operacja weszłaby ponad limit"
        );
        await nowy!();
      });

      await t.test("sprzątanie usuwa wygasłe, zostawia aktywne", async () => {
        const u = podmiot();
        await sprawdzLimit("zaproszenia", u);
        const trzymany = (await zajmijSlot("ai.agent", u))!;
        await prisma.rateLimitBucket.updateMany({
          where: { key: `zaproszenia:${u}:min` },
          data: { resetAt: new Date(Date.now() - 1000) },
        });
        await posprzatajLimity();
        assert.equal(
          await prisma.rateLimitBucket.count({ where: { key: `zaproszenia:${u}:min` } }),
          0,
          "wygasłe okno powinno zniknąć"
        );
        assert.equal(
          await prisma.rateLimitLease.count({ where: { key: `ai.agent:${u}` } }),
          1,
          "AKTYWNA dzierżawa nie może zostać sprzątnięta — inaczej sprzątaczka rozbraja strażnika"
        );
        await trzymany();
      });
    } finally {
      for (const p of sprzataczki) {
        await prisma.rateLimitBucket.deleteMany({ where: { key: { contains: `:${p}:` } } });
        await prisma.rateLimitLease.deleteMany({ where: { key: { endsWith: `:${p}` } } });
      }
    }
  }
);
