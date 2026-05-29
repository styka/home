import { PrismaClient } from "@prisma/client";
import { categorize } from "../src/lib/categorize";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");

const prisma = new PrismaClient();

// name → defaultUnit (null = no default unit, like "szt" implied)
const COMMON_ITEMS: Array<{ name: string; unit?: string }> = [
  // Produce
  { name: "jabłka", unit: "kg" },
  { name: "banany", unit: "kg" },
  { name: "pomidory", unit: "kg" },
  { name: "ogórki", unit: "szt" },
  { name: "marchew", unit: "kg" },
  { name: "ziemniaki", unit: "kg" },
  { name: "cebula", unit: "kg" },
  { name: "czosnek", unit: "szt" },
  { name: "papryka", unit: "szt" },
  { name: "szpinak", unit: "op" },
  { name: "sałata", unit: "szt" },
  { name: "brokuł", unit: "szt" },
  { name: "kapusta", unit: "szt" },
  { name: "por", unit: "szt" },
  { name: "cytryna", unit: "szt" },
  { name: "awokado", unit: "szt" },
  { name: "gruszki", unit: "kg" },
  { name: "śliwki", unit: "kg" },
  { name: "winogrona", unit: "kg" },
  // Dairy
  { name: "mleko", unit: "l" },
  { name: "masło", unit: "szt" },
  { name: "ser żółty", unit: "dkg" },
  { name: "jogurt naturalny", unit: "szt" },
  { name: "jajka", unit: "szt" },
  { name: "śmietana", unit: "szt" },
  { name: "twaróg", unit: "szt" },
  { name: "kefir", unit: "szt" },
  { name: "mozzarella", unit: "szt" },
  { name: "serek wiejski", unit: "szt" },
  // Meat
  { name: "kurczak", unit: "kg" },
  { name: "mielone wołowe", unit: "kg" },
  { name: "boczek", unit: "dkg" },
  { name: "szynka", unit: "dkg" },
  { name: "parówki", unit: "op" },
  { name: "schab", unit: "kg" },
  { name: "łosoś", unit: "dkg" },
  { name: "tuńczyk w puszce", unit: "szt" },
  { name: "krewetki", unit: "g" },
  // Bakery
  { name: "chleb", unit: "szt" },
  { name: "bułki", unit: "szt" },
  { name: "bagietka", unit: "szt" },
  { name: "chleb żytni", unit: "szt" },
  // Dry
  { name: "makaron spaghetti", unit: "op" },
  { name: "ryż", unit: "kg" },
  { name: "mąka pszenna", unit: "kg" },
  { name: "cukier", unit: "kg" },
  { name: "sól", unit: "szt" },
  { name: "płatki owsiane", unit: "op" },
  { name: "kasza gryczana", unit: "op" },
  { name: "soczewica czerwona", unit: "op" },
  { name: "fasola biała", unit: "op" },
  // Drinks
  { name: "woda mineralna", unit: "l" },
  { name: "sok pomarańczowy", unit: "l" },
  { name: "kawa", unit: "op" },
  { name: "herbata", unit: "op" },
  { name: "piwo", unit: "szt" },
  // Snacks
  { name: "czekolada gorzka", unit: "szt" },
  { name: "chipsy", unit: "op" },
  { name: "orzechy", unit: "g" },
  { name: "miód", unit: "słoik" },
  // Condiments
  { name: "oliwa z oliwek", unit: "butelka" },
  { name: "ketchup", unit: "szt" },
  { name: "musztarda", unit: "szt" },
  { name: "sos sojowy", unit: "butelka" },
  // Cleaning
  { name: "pasta do zębów", unit: "szt" },
  { name: "szampon", unit: "szt" },
  { name: "płyn do naczyń", unit: "szt" },
  { name: "papier toaletowy", unit: "op" },
  { name: "mydło", unit: "szt" },
];

async function main() {
  console.log("Seeding database…");

  // Create default list
  const list = await prisma.shoppingList.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", name: "Zakupy" },
  });

  console.log(`Created list: ${list.name}`);

  // Seed ItemHistory for backward compat
  for (const { name } of COMMON_ITEMS) {
    await prisma.itemHistory.upsert({
      where: { name: name.toLowerCase() },
      update: {},
      create: {
        name: name.toLowerCase(),
        category: categorize(name),
        useCount: 1,
      },
    });
  }

  console.log(`Seeded ${COMMON_ITEMS.length} ItemHistory entries`);

  // Seed global Products (userId=null, teamId=null)
  for (const { name, unit } of COMMON_ITEMS) {
    const existing = await prisma.product.findFirst({
      where: { name: name.toLowerCase(), userId: null, teamId: null },
    });
    if (!existing) {
      await prisma.product.create({
        data: {
          name: name.toLowerCase(),
          category: categorize(name),
          defaultUnit: unit ?? null,
          useCount: 1,
          userId: null,
          teamId: null,
        },
      });
    }
  }

  console.log(`Seeded ${COMMON_ITEMS.length} global Product entries`);

  // Seed Reports
  const finalReportPath = path.join(__dirname, "../refactoring.final.md");
  if (fs.existsSync(finalReportPath)) {
    const finalContent = fs.readFileSync(finalReportPath, "utf-8");
    await prisma.report.upsert({
      where: { slug: "refactoring-final-2026-05" },
      update: {},
      create: {
        title: "Raport końcowy refaktoryzacji — WorldOfMag, Maj 2026",
        slug: "refactoring-final-2026-05",
        content: finalContent,
        category: "refactoring",
        createdAt: new Date("2026-05-18T12:00:00.000Z"),
      },
    });
    console.log("Seeded final refactoring report");
  }

  // Seed pets module permission + grant to ADMIN (idempotent; for local db:push)
  const petsPerm = await prisma.permission.upsert({
    where: { slug: "module.pets" },
    update: {},
    create: { slug: "module.pets", name: "Zwierzęta", description: "Dostęp do modułu zarządzania zwierzętami" },
  });
  const existingGrant = await prisma.rolePermission.findUnique({
    where: { role_permissionId: { role: "ADMIN", permissionId: petsPerm.id } },
  });
  if (!existingGrant) {
    await prisma.rolePermission.create({ data: { role: "ADMIN", permissionId: petsPerm.id } });
  }
  console.log("Seeded pets module permission (module.pets → ADMIN)");

  // Seed flota + portfel module permissions + grant to ADMIN (idempotent; for local db:push)
  for (const m of [
    { slug: "module.flota", name: "Flota", description: "Dostęp do modułu zarządzania flotą pojazdów" },
    { slug: "module.portfel", name: "Portfel", description: "Dostęp do modułu zarządzania finansami/portfelem" },
  ]) {
    const perm = await prisma.permission.upsert({
      where: { slug: m.slug },
      update: {},
      create: m,
    });
    const grant = await prisma.rolePermission.findUnique({
      where: { role_permissionId: { role: "ADMIN", permissionId: perm.id } },
    });
    if (!grant) await prisma.rolePermission.create({ data: { role: "ADMIN", permissionId: perm.id } });
    console.log(`Seeded ${m.slug} → ADMIN`);
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
