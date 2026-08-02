import { test } from "node:test";
import assert from "node:assert/strict";

// 041 (T-4) — kolejność rozstrzygania trybu sekcji AI na realnym Postgresie. DB-gated.
//
// Testujemy CAŁĄ kolejność (preferencja → Config → „na żądanie"), bo to ona decyduje o tym, czy
// wejście na stronę kosztuje. Szczególnie pilnujemy degradacji: uszkodzony JSON w konfiguracji ma
// dać „na żądanie", a nie wysypać stronę modułu.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

/** Zakłada użytkownika na czas testu — `AiSectionPref` ma FK do `User`. */
async function withUser(fn: (userId: string) => Promise<void>) {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.create({
    data: { email: `sectionmode-${rnd()}@test.local`, name: "Test trybu sekcji" },
  });
  try {
    await fn(user.id);
  } finally {
    // Kaskada sprząta `AiSectionPref` razem z użytkownikiem.
    await prisma.user.delete({ where: { id: user.id } });
  }
}

/** Podmienia wartość klucza konfiguracji na czas testu i przywraca poprzednią. */
async function withConfig(value: string | null, fn: () => Promise<void>) {
  const { prisma } = await import("@/lib/prisma");
  const { AI_SECTION_MODES_CONFIG_KEY } = await import("@/lib/ai/sectionMode");
  const before = await prisma.config.findUnique({ where: { key: AI_SECTION_MODES_CONFIG_KEY } });
  try {
    if (value === null) {
      await prisma.config.deleteMany({ where: { key: AI_SECTION_MODES_CONFIG_KEY } });
    } else {
      await prisma.config.upsert({
        where: { key: AI_SECTION_MODES_CONFIG_KEY },
        create: { key: AI_SECTION_MODES_CONFIG_KEY, value },
        update: { value },
      });
    }
    await fn();
  } finally {
    if (before) {
      await prisma.config.upsert({
        where: { key: AI_SECTION_MODES_CONFIG_KEY },
        create: { key: AI_SECTION_MODES_CONFIG_KEY, value: before.value },
        update: { value: before.value },
      });
    } else {
      await prisma.config.deleteMany({ where: { key: AI_SECTION_MODES_CONFIG_KEY } });
    }
  }
}

test(
  "brak preferencji i brak konfiguracji → „na żądanie”",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { resolveSectionMode } = await import("@/lib/ai/sectionMode");
    await withConfig(null, async () => {
      await withUser(async (userId) => {
        assert.equal(await resolveSectionMode(userId, "weather.ideas"), "onDemand");
      });
    });
  }
);

test(
  "brak preferencji → dziedziczenie po administratorze (Config)",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { resolveSectionMode } = await import("@/lib/ai/sectionMode");
    await withConfig('{"weather.ideas":"always","news.hotTopics":"onChange"}', async () => {
      await withUser(async (userId) => {
        assert.equal(await resolveSectionMode(userId, "weather.ideas"), "always");
        assert.equal(await resolveSectionMode(userId, "news.hotTopics"), "onChange");
        // Sekcja nieopisana w konfiguracji spada do bezpiecznego domyślnego, a nie do sąsiedniej.
        assert.equal(await resolveSectionMode(userId, "pets.insights"), "onDemand");
      });
    });
  }
);

test(
  "preferencja użytkownika wygrywa z domyślnym systemowym",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/lib/prisma");
    const { resolveSectionMode } = await import("@/lib/ai/sectionMode");
    await withConfig('{"weather.ideas":"always"}', async () => {
      await withUser(async (userId) => {
        await prisma.aiSectionPref.create({
          data: { ownerId: userId, sectionKind: "weather.ideas", mode: "onDemand" },
        });
        assert.equal(await resolveSectionMode(userId, "weather.ideas"), "onDemand");
      });
    });
  }
);

test(
  "uszkodzony JSON w konfiguracji degraduje do „na żądanie”, nie rzuca",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { resolveSectionMode, readDefaultSectionModes } = await import("@/lib/ai/sectionMode");
    await withConfig("{to nie jest JSON", async () => {
      await withUser(async (userId) => {
        assert.deepEqual(await readDefaultSectionModes(), {});
        assert.equal(await resolveSectionMode(userId, "weather.ideas"), "onDemand");
      });
    });
  }
);

test(
  "nieznana nazwa trybu jest ignorowana — i w konfiguracji, i w preferencji",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/lib/prisma");
    const { resolveSectionMode } = await import("@/lib/ai/sectionMode");
    await withConfig('{"weather.ideas":"codziennie","pets.insights":"always"}', async () => {
      await withUser(async (userId) => {
        // Śmieć w konfiguracji → domyślne, a nie wysyp.
        assert.equal(await resolveSectionMode(userId, "weather.ideas"), "onDemand");

        // Śmieć w preferencji → spadamy na konfigurację, bo preferencja jest nieczytelna.
        await prisma.aiSectionPref.create({
          data: { ownerId: userId, sectionKind: "pets.insights", mode: "kiedykolwiek" },
        });
        assert.equal(await resolveSectionMode(userId, "pets.insights"), "always");
      });
    });
  }
);

test(
  "resolveSectionModes zwraca komplet sekcji i zgadza się z pojedynczym rozstrzygnięciem",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/lib/prisma");
    const { resolveSectionMode, resolveSectionModes, AI_SECTION_KINDS } = await import(
      "@/lib/ai/sectionMode"
    );
    await withConfig('{"news.hotTopics":"onChange"}', async () => {
      await withUser(async (userId) => {
        await prisma.aiSectionPref.create({
          data: { ownerId: userId, sectionKind: "kitchen.planWeek", mode: "always" },
        });
        const all = await resolveSectionModes(userId);
        assert.equal(Object.keys(all).length, AI_SECTION_KINDS.length, "komplet sekcji");
        for (const kind of AI_SECTION_KINDS) {
          assert.equal(all[kind], await resolveSectionMode(userId, kind), `zgodność dla ${kind}`);
        }
        assert.equal(all["kitchen.planWeek"], "always");
        assert.equal(all["news.hotTopics"], "onChange");
        assert.equal(all["storage.insights"], "onDemand");
      });
    });
  }
);
