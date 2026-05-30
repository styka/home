// Seeduje raport implementacji „Omnia 2026-05-30" do tabeli Report.
// Idempotentny — można uruchamiać wielokrotnie (upsert po slug).
//
// Użycie:
//   cd worldofmag
//   node scripts/seed-omnia-report.js
//
// Wymaga skonfigurowanej DATABASE_URL w env (lokalnie lub na Render Shell).

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const OWNER_EMAIL = "tyka.szymon@gmail.com";

const REPORT = {
  slug: "omnia-implementacja-2026-05-30",
  title: "Omnia — Raport implementacji 2026-05-30",
  file: "docs/reports/omnia-implementacja-2026-05-30.md",
  category: "general",
};

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner) {
    console.warn(`⚠ User ${OWNER_EMAIL} nie znaleziony — raport zapiszę bez authorId.`);
  }

  const filePath = path.join(__dirname, "..", REPORT.file);
  if (!fs.existsSync(filePath)) {
    console.error(`✘ Brak pliku ${filePath} — przerywam.`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, "utf-8");

  const record = await prisma.report.upsert({
    where: { slug: REPORT.slug },
    create: {
      slug: REPORT.slug,
      title: REPORT.title,
      content,
      category: REPORT.category,
      authorId: owner?.id ?? null,
    },
    update: {
      title: REPORT.title,
      content,
      category: REPORT.category,
    },
  });

  console.log(`✔ ${record.slug} (${content.length} znaków)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
