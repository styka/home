import { test } from "node:test";
import assert from "node:assert/strict";

// 041 (T-5) — tabela decyzyjna `rememberedContent` na realnym Postgresie. DB-gated.
//
// Liczymy WYWOŁANIA `generate`, a nie kształt wyniku. To one kosztują, więc to one są przedmiotem
// zgłoszenia: „nic nie generuje się samo". Test, który sprawdzałby tylko zwróconą treść, przepuściłby
// wersję poprawną wizualnie i drogą w rachunku.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

const KIND = "weather.ideas" as const;

async function withUser(fn: (userId: string) => Promise<void>) {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.create({
    data: { email: `contentmode-${rnd()}@test.local`, name: "Test pamięci treści" },
  });
  try {
    await fn(user.id);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
}

/** Licznik wywołań modelu — sedno tego testu. */
function counter(value: string) {
  const calls = { n: 0 };
  return {
    calls,
    generate: async () => {
      calls.n++;
      return { value: `${value}#${calls.n}` };
    },
  };
}

test(
  "brak zapisu: „na żądanie” i „przy zmianie” CZEKAJĄ, „zawsze” generuje",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { rememberedContent } = await import("@/lib/ai/contentMemory");
    await withUser(async (ownerId) => {
      for (const mode of ["onDemand", "onChange"] as const) {
        const g = counter("x");
        const res = await rememberedContent<string>({
          ownerId,
          kind: KIND,
          scopeKey: `${mode}-${rnd()}`,
          inputHash: "h1",
          mode,
          generate: g.generate,
        });
        assert.equal(res.pending, true, `${mode}: sekcja czeka`);
        assert.equal(g.calls.n, 0, `${mode}: ZERO wywołań modelu`);
      }

      const g = counter("x");
      const res = await rememberedContent<string>({
        ownerId,
        kind: KIND,
        scopeKey: `always-${rnd()}`,
        inputHash: "h1",
        mode: "always",
        generate: g.generate,
      });
      assert.equal(res.pending, false);
      assert.equal(g.calls.n, 1, "„zawsze”: dokładnie jedno wywołanie");
    });
  }
);

test(
  "brak trybu = zachowanie sprzed 041: brak zapisu → generuj",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { rememberedContent } = await import("@/lib/ai/contentMemory");
    await withUser(async (ownerId) => {
      const g = counter("legacy");
      const res = await rememberedContent<string>({
        ownerId,
        kind: KIND,
        scopeKey: `legacy-${rnd()}`,
        inputHash: "h1",
        generate: g.generate,
      });
      assert.equal(g.calls.n, 1);
      assert.equal(res.value, "legacy#1");
      assert.equal(res.fromMemory, false);
    });
  }
);

test(
  "zapis + odcisk zgodny: tylko „zawsze” woła model",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { rememberedContent } = await import("@/lib/ai/contentMemory");
    await withUser(async (ownerId) => {
      for (const mode of ["onDemand", "onChange", "always"] as const) {
        const scopeKey = `same-${mode}-${rnd()}`;
        // Pierwsze wypełnienie pamięci — jawne odświeżenie, więc niezależne od trybu.
        const seed = counter("v");
        await rememberedContent<string>({
          ownerId,
          kind: KIND,
          scopeKey,
          inputHash: "h1",
          force: true,
          mode,
          generate: seed.generate,
        });
        assert.equal(seed.calls.n, 1);

        const g = counter("v");
        const res = await rememberedContent<string>({
          ownerId,
          kind: KIND,
          scopeKey,
          inputHash: "h1",
          mode,
          generate: g.generate,
        });
        assert.equal(res.pending, false, `${mode}: treść jest`);
        if (mode === "always") {
          assert.equal(g.calls.n, 1, "„zawsze”: świeże przy każdym wejściu");
          assert.equal(res.pending === false && res.fromMemory, false);
        } else {
          assert.equal(g.calls.n, 0, `${mode}: ZERO wywołań — treść z pamięci`);
          assert.equal(res.pending === false && res.fromMemory, true);
          assert.equal(res.pending === false && res.stale, false, `${mode}: aktualne`);
        }
      }
    });
  }
);

test(
  "zapis + odcisk inny: „na żądanie” pokazuje nieaktualne, „przy zmianie” odświeża samo",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { rememberedContent } = await import("@/lib/ai/contentMemory");
    await withUser(async (ownerId) => {
      // „na żądanie": treść ZOSTAJE na ekranie ze znacznikiem, model milczy.
      const scopeA = `diff-onDemand-${rnd()}`;
      await rememberedContent<string>({
        ownerId, kind: KIND, scopeKey: scopeA, inputHash: "h1", force: true,
        mode: "onDemand", generate: counter("a").generate,
      });
      const gA = counter("a");
      const resA = await rememberedContent<string>({
        ownerId, kind: KIND, scopeKey: scopeA, inputHash: "h2",
        mode: "onDemand", generate: gA.generate,
      });
      assert.equal(gA.calls.n, 0, "„na żądanie”: brak wywołania mimo zmiany warunków");
      assert.equal(resA.pending, false, "treść NIE znika");
      assert.equal(resA.pending === false && resA.stale, true, "znacznik „nieaktualne”");

      // „przy zmianie": rozjazd warunków sam sięga po model.
      const scopeB = `diff-onChange-${rnd()}`;
      await rememberedContent<string>({
        ownerId, kind: KIND, scopeKey: scopeB, inputHash: "h1", force: true,
        mode: "onChange", generate: counter("b").generate,
      });
      const gB = counter("b");
      const resB = await rememberedContent<string>({
        ownerId, kind: KIND, scopeKey: scopeB, inputHash: "h2",
        mode: "onChange", generate: gB.generate,
      });
      assert.equal(gB.calls.n, 1, "„przy zmianie”: dokładnie jedno wywołanie");
      assert.equal(resB.pending === false && resB.stale, false, "po odświeżeniu jest aktualne");
    });
  }
);

test(
  "force generuje w KAŻDYM trybie i podbija licznik odświeżeń",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { rememberedContent } = await import("@/lib/ai/contentMemory");
    await withUser(async (ownerId) => {
      for (const mode of ["onDemand", "onChange", "always"] as const) {
        const scopeKey = `force-${mode}-${rnd()}`;
        await rememberedContent<string>({
          ownerId, kind: KIND, scopeKey, inputHash: "h1", force: true, mode,
          generate: counter("f").generate,
        });
        const g = counter("f");
        const res = await rememberedContent<string>({
          ownerId, kind: KIND, scopeKey, inputHash: "h1", force: true, mode,
          generate: g.generate,
        });
        assert.equal(g.calls.n, 1, `${mode}: force zawsze woła model`);
        // Pierwsza generacja odświeżeniem nie jest — liczy się dopiero druga.
        assert.equal(res.pending === false && res.refreshes, 1, `${mode}: licznik odświeżeń`);
      }
    });
  }
);

test(
  "kliknięcie po stanie oczekiwania zapisuje treść, a kolejne wejście jej nie generuje ponownie",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { rememberedContent } = await import("@/lib/ai/contentMemory");
    await withUser(async (ownerId) => {
      const scopeKey = `flow-${rnd()}`;
      const g = counter("flow");

      const first = await rememberedContent<string>({
        ownerId, kind: KIND, scopeKey, inputHash: "h1", mode: "onDemand", generate: g.generate,
      });
      assert.equal(first.pending, true);
      assert.equal(g.calls.n, 0);

      // Użytkownik klika „Generuj" → to jest `force`.
      const clicked = await rememberedContent<string>({
        ownerId, kind: KIND, scopeKey, inputHash: "h1", force: true, mode: "onDemand",
        generate: g.generate,
      });
      assert.equal(g.calls.n, 1);
      assert.equal(clicked.pending === false && clicked.value, "flow#1");

      // Powrót na stronę: treść jest, więc model milczy.
      const back = await rememberedContent<string>({
        ownerId, kind: KIND, scopeKey, inputHash: "h1", mode: "onDemand", generate: g.generate,
      });
      assert.equal(g.calls.n, 1, "powrót na stronę NIC nie kosztuje");
      assert.equal(back.pending === false && back.value, "flow#1");
    });
  }
);

test(
  "uszkodzony zapis przy trybie „na żądanie” daje stan oczekiwania, a nie ciche generowanie",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/lib/prisma");
    const { rememberedContent } = await import("@/lib/ai/contentMemory");
    await withUser(async (ownerId) => {
      const scopeKey = `broken-${rnd()}`;
      await prisma.aiContent.create({
        data: { ownerId, kind: KIND, scopeKey, inputHash: "h1", content: "{to nie jest JSON" },
      });
      const g = counter("z");
      const res = await rememberedContent<string>({
        ownerId, kind: KIND, scopeKey, inputHash: "h1", mode: "onDemand", generate: g.generate,
      });
      assert.equal(res.pending, true);
      assert.equal(g.calls.n, 0, "zepsuty wpis nie zamienia się w niezamówiony rachunek");
    });
  }
);
