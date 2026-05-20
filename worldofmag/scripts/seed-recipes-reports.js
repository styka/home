// Seeduje 4 raporty modułu Kuchnia do tabeli Report.
// Idempotentny — można uruchamiać wielokrotnie (upsert po slug).
//
// Użycie:
//   cd worldofmag
//   node scripts/seed-recipes-reports.js
//
// Wymaga skonfigurowanej DATABASE_URL w env (lokalnie lub na Render Shell).

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const OWNER_EMAIL = "tyka.szymon@gmail.com";

const REPORTS = [
  {
    slug: "kitchen-architecture-2026-05-20",
    title: "Kuchnia — Dokument architektoniczny",
    file: "docs/recipes/recipes-architecture.md",
    category: "proposal",
  },
  {
    slug: "kitchen-ux-2026-05-20",
    title: "Kuchnia — Dokument UX",
    file: "docs/recipes/recipes-ux.md",
    category: "proposal",
  },
  {
    slug: "kitchen-analysis-2026-05-20",
    title: "Kuchnia — Dokument analityczny",
    file: "docs/recipes/recipes-analysis.md",
    category: "proposal",
  },
  {
    slug: "kitchen-summary-2026-05-20",
    title: "Kuchnia — Raport końcowy z sesji przygotowawczej",
    file: "docs/recipes/recipes-summary.md",
    category: "proposal",
  },
];

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner) {
    console.warn(
      `⚠ User ${OWNER_EMAIL} nie znaleziony — raporty zapiszę bez authorId.`
    );
  }

  for (const r of REPORTS) {
    const filePath = path.join(__dirname, "..", r.file);
    if (!fs.existsSync(filePath)) {
      console.error(`✘ Brak pliku ${filePath} — pomijam ${r.slug}`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");

    const record = await prisma.report.upsert({
      where: { slug: r.slug },
      create: {
        slug: r.slug,
        title: r.title,
        content,
        category: r.category,
        authorId: owner?.id ?? null,
      },
      update: {
        title: r.title,
        content,
        category: r.category,
      },
    });

    console.log(`✔ ${record.slug} (${content.length} znaków)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
