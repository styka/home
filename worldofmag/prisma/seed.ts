import { PrismaClient } from "@prisma/client";
import { categorize } from "../src/lib/categorize";

const prisma = new PrismaClient();

const COMMON_ITEMS = [
  // Produce
  "jabłka", "banany", "pomidory", "ogórki", "marchew", "ziemniaki", "cebula",
  "czosnek", "papryka", "szpinak", "sałata", "brokuł", "kapusta", "por",
  "cytryna", "awokado", "gruszki", "śliwki", "winogrona",
  // Dairy
  "mleko", "masło", "ser żółty", "jogurt naturalny", "jajka", "śmietana",
  "twaróg", "kefir", "mozzarella", "serek wiejski",
  // Meat
  "kurczak", "mielone wołowe", "boczek", "szynka", "parówki", "schab",
  "łosoś", "tuńczyk w puszce", "krewetki",
  // Bakery
  "chleb", "bułki", "bagietka", "chleb żytni",
  // Dry
  "makaron spaghetti", "ryż", "mąka pszenna", "cukier", "sól", "płatki owsiane",
  "kasza gryczana", "soczewica czerwona", "fasola biała",
  // Drinks
  "woda mineralna", "sok pomarańczowy", "kawa", "herbata", "piwo",
  // Snacks
  "czekolada gorzka", "chipsy", "orzechy", "miód",
  // Condiments
  "oliwa z oliwek", "ketchup", "musztarda", "sos sojowy",
  // Cleaning
  "pasta do zębów", "szampon", "płyn do naczyń", "papier toaletowy", "mydło",
];

const ACTION_COMPONENTS = [
  {
    name: "Onet.pl",
    type: "LINK_BUTTON",
    isBuiltIn: true,
    defaultParams: JSON.stringify({ url: "https://onet.pl", label: "Onet" }),
    description: "Otwiera Onet.pl w nowej karcie",
  },
  {
    name: "WP.pl",
    type: "LINK_BUTTON",
    isBuiltIn: true,
    defaultParams: JSON.stringify({ url: "https://wp.pl", label: "WP" }),
    description: "Otwiera WP.pl w nowej karcie",
  },
  {
    name: "Losowa Pogoda",
    type: "WEATHER_GENERATOR",
    isBuiltIn: true,
    defaultParams: null,
    description: "Losuje zabawną prognozę pogody",
  },
];

async function main() {
  console.log("Seeding database…");

  // Seed ItemHistory for autocomplete
  for (const name of COMMON_ITEMS) {
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

  console.log(`Seeded ${COMMON_ITEMS.length} history items`);

  // Seed built-in ActionComponents
  for (const component of ACTION_COMPONENTS) {
    await prisma.actionComponent.upsert({
      where: { name: component.name },
      update: {},
      create: component,
    });
  }

  console.log(`Seeded ${ACTION_COMPONENTS.length} action components`);
  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
