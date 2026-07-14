import { test } from "node:test";
import assert from "node:assert/strict";

// Z-051/Z-172/Z-174: twarde usunięcie danych użytkownika (RODO art. 17).
// DB-gated — sprawdza, że purgeUserData kasuje WSZYSTKIE dane usera (też SET-NULL,
// które inaczej zostałyby osierocone) i NIE rusza danych innych userów.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-051 purgeUserData: kasuje dane usera (w tym SET-NULL), izolacja innych zachowana", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { purgeUserData } = await import("@/lib/privacy/purge");

  const A = await prisma.user.create({ data: { email: `purge-a-${rnd()}@test.local` } });
  const B = await prisma.user.create({ data: { email: `purge-b-${rnd()}@test.local` } });

  // Treści A (mieszanka SET-NULL i CASCADE):
  const proj = await prisma.taskProject.create({ data: { name: "P", ownerId: A.id } });
  await prisma.task.create({ data: { title: "t", projectId: proj.id, createdById: A.id } });
  await prisma.note.create({ data: { title: "n", ownerId: A.id } });
  await prisma.shoppingList.create({ data: { name: "l", ownerId: A.id } });
  await prisma.recipe.create({ data: { title: "r", slug: `r-${rnd()}`, ownerId: A.id } });
  // Z-370: Contact ma ownerId BEZ FK — bez jawnego delete zostałby osierocony.
  await prisma.contact.create({ data: { name: "Jan Kowalski", ownerId: A.id } });
  // Z-050/Z-051: zgody RODO + ustawienia zdrowia (FK CASCADE → znikają z userem).
  await prisma.userConsent.create({ data: { userId: A.id, documentKey: "privacy", version: "1" } });
  await prisma.healthSettings.create({ data: { userId: A.id, aiOptIn: true } });
  // Dane B — kontrola izolacji
  await prisma.note.create({ data: { title: "B-note", ownerId: B.id } });
  await prisma.contact.create({ data: { name: "B-contact", ownerId: B.id } });

  try {
    await purgeUserData(A.id);

    await t.test("user A i jego dane skasowane (brak sierot SET-NULL)", async () => {
      assert.equal(await prisma.user.count({ where: { id: A.id } }), 0);
      assert.equal(await prisma.note.count({ where: { ownerId: A.id } }), 0);
      assert.equal(await prisma.recipe.count({ where: { ownerId: A.id } }), 0);
      assert.equal(await prisma.shoppingList.count({ where: { ownerId: A.id } }), 0);
      assert.equal(await prisma.taskProject.count({ where: { ownerId: A.id } }), 0);
      assert.equal(await prisma.task.count({ where: { createdById: A.id } }), 0);
      assert.equal(await prisma.contact.count({ where: { ownerId: A.id } }), 0, "Z-370: kontakty (bez FK) skasowane, nie osierocone");
      assert.equal(await prisma.userConsent.count({ where: { userId: A.id } }), 0, "zgody RODO skasowane (CASCADE)");
      assert.equal(await prisma.healthSettings.count({ where: { userId: A.id } }), 0, "ustawienia zdrowia skasowane (CASCADE)");
    });

    await t.test("dane usera B nietknięte (izolacja)", async () => {
      assert.equal(await prisma.user.count({ where: { id: B.id } }), 1);
      assert.equal(await prisma.note.count({ where: { ownerId: B.id } }), 1);
      assert.equal(await prisma.contact.count({ where: { ownerId: B.id } }), 1, "kontakt B nietknięty");
    });
  } finally {
    await prisma.note.deleteMany({ where: { ownerId: B.id } });
    await prisma.contact.deleteMany({ where: { ownerId: B.id } });
    await prisma.user.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  }
});

// Z-264 (RODO sprzedaży zwierząt): PetSale przechowuje PII OSOBY TRZECIEJ
// (buyerName/buyerContact). Ma FK ownerId→User i petId→Pet, oba onDelete:Cascade,
// więc usunięcie konta sprzedawcy MUSI skasować też dane kupującego (nie osierocić).
// Test pilnuje tej kaskady — gdyby ktoś zmienił FK na SetNull, PII wyciekłoby.
test("Z-264 RODO: usunięcie konta kasuje PetSale wraz z PII kupującego (CASCADE)", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  const { purgeUserData } = await import("@/lib/privacy/purge");

  const U = await prisma.user.create({ data: { email: `petsale-${rnd()}@test.local` } });
  const pet = await prisma.pet.create({ data: { name: "Rex", ownerId: U.id } });
  const buyerTag = `buyer-${rnd()}`;
  await prisma.petSale.create({
    data: { petId: pet.id, ownerId: U.id, buyerName: "Anna Nowak", buyerContact: buyerTag, price: 100 },
  });

  try {
    await purgeUserData(U.id);
    assert.equal(await prisma.user.count({ where: { id: U.id } }), 0);
    assert.equal(await prisma.petSale.count({ where: { ownerId: U.id } }), 0, "PetSale skasowane (CASCADE po ownerId)");
    assert.equal(await prisma.petSale.count({ where: { buyerContact: buyerTag } }), 0, "PII kupującego nie zostaje osierocone");
    assert.equal(await prisma.pet.count({ where: { ownerId: U.id } }), 0, "Pet skasowany (CASCADE)");
  } finally {
    await prisma.petSale.deleteMany({ where: { buyerContact: buyerTag } });
    await prisma.user.deleteMany({ where: { id: U.id } });
  }
});

// Z-301 (RODO finansów): dane majątkowe (salda, wydatki, cele, kursy) to PII.
// Wszystkie modele Portfela mają FK onDelete:Cascade do User → usunięcie konta MUSI
// je skasować. Test pilnuje kaskady (gdyby ktoś zmienił FK na SetNull, dane zostałyby).
test("Z-301 RODO: usunięcie konta kasuje dane finansowe Portfela (CASCADE)", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  const { purgeUserData } = await import("@/lib/privacy/purge");

  const U = await prisma.user.create({ data: { email: `fin-${rnd()}@test.local` } });
  const el = await prisma.walletElement.create({ data: { name: "Konto ROR", ownerId: U.id, balance: 1000 } });
  await prisma.walletEntry.create({ data: { elementId: el.id, balanceAfter: 1000, delta: 1000, note: "wpłata" } });
  await prisma.budget.create({ data: { category: "Jedzenie", limitAmount: 800, ownerId: U.id } });
  await prisma.financeGoal.create({ data: { name: "Wakacje", targetAmount: 5000, ownerId: U.id } });
  await prisma.financeSettings.create({ data: { userId: U.id } });
  await prisma.exchangeRate.create({ data: { userId: U.id, currency: "EUR", rate: 4.3 } });

  try {
    await purgeUserData(U.id);
    assert.equal(await prisma.user.count({ where: { id: U.id } }), 0);
    assert.equal(await prisma.walletElement.count({ where: { ownerId: U.id } }), 0, "elementy portfela");
    assert.equal(await prisma.walletEntry.count({ where: { elementId: el.id } }), 0, "wpisy (kaskada przez element)");
    assert.equal(await prisma.budget.count({ where: { ownerId: U.id } }), 0, "budżety");
    assert.equal(await prisma.financeGoal.count({ where: { ownerId: U.id } }), 0, "cele oszczędnościowe");
    assert.equal(await prisma.financeSettings.count({ where: { userId: U.id } }), 0, "ustawienia finansowe");
    assert.equal(await prisma.exchangeRate.count({ where: { userId: U.id } }), 0, "kursy walut");
  } finally {
    await prisma.user.deleteMany({ where: { id: U.id } });
  }
});

// Audyt RODO (systematyczny przegląd FK SetNull/no-FK): purge.ts kasuje wszystkie
// OSOBISTE rekordy SET-NULL (ownerId=user). QaTestScenario to jednak WSPÓŁDZIELONE
// narzędzie (Epic→Story→Scenario; brak ownerId, authorId=tylko atrybucja), więc
// usunięcie konta autora MUSI je ZACHOWAĆ, anonimizując authorId (SET NULL). Test
// pilnuje intencji: zmiana FK na Cascade = utrata scenariuszy QA; dodanie do purge
// = niepotrzebne kasowanie współdzielonej dokumentacji. (Potwierdza: brak luki RODO.)
test("RODO/QA: usunięcie konta autora ANONIMIZUJE QaTestScenario (authorId→null), nie kasuje", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  const { purgeUserData } = await import("@/lib/privacy/purge");

  const U = await prisma.user.create({ data: { email: `qa-${rnd()}@test.local` } });
  const tag = rnd();
  const epic = await prisma.qaEpic.create({ data: { slug: `e-${tag}`, title: "Epic", module: "qa" } });
  const story = await prisma.qaUserStory.create({ data: { slug: `s-${tag}`, title: "Story", epicId: epic.id } });
  const scenario = await prisma.qaTestScenario.create({
    data: { slug: `sc-${tag}`, title: "Scenariusz", content: "# krok", storyId: story.id, authorId: U.id },
  });

  try {
    await purgeUserData(U.id);
    assert.equal(await prisma.user.count({ where: { id: U.id } }), 0, "konto skasowane");
    const after = await prisma.qaTestScenario.findUnique({ where: { id: scenario.id }, select: { authorId: true } });
    assert.ok(after, "scenariusz QA NIE jest kasowany (współdzielone narzędzie, nie dane osobiste)");
    assert.equal(after?.authorId, null, "authorId zanonimizowany (SET NULL)");
  } finally {
    await prisma.qaEpic.delete({ where: { id: epic.id } }).catch(() => {}); // cascade → story → scenario
    await prisma.user.deleteMany({ where: { id: U.id } });
  }
});
