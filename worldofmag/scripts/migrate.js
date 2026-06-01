// Runs `prisma migrate deploy` with retries for Neon free-tier wake-up.
// Called at the END of `npm run build` so migrations are applied before
// the server ever starts.
// After successful migration also seeds module permissions (idempotent).
const { execSync } = require("child_process")

const MAX_ATTEMPTS = 5
const RETRY_MS = 8_000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function seedPermissions() {
  let PrismaClient
  try {
    PrismaClient = require("@prisma/client").PrismaClient
  } catch {
    console.warn("⚠ @prisma/client not available — skipping permission seed.")
    return
  }
  const prisma = new PrismaClient()
  try {
    const perms = [
      { slug: "module.qa", name: "Dział QA", description: "Przeglądanie scenariuszy testowych" },
      { slug: "module.truck", name: "Trasy TIR", description: "Planowanie tras dla pojazdów ciężarowych" },
      { slug: "module.languages", name: "Nauka języków", description: "Dostęp do działu nauki słownictwa (fiszki + powtórki)" },
      { slug: "module.health", name: "Zdrowie", description: "Zarządzanie wizytami u lekarzy i badaniami" },
      { slug: "module.habits", name: "Nawyki", description: "Śledzenie nawyków: codzienne odhaczanie, streaki i przypomnienia" },
      { slug: "module.news", name: "Wiadomości", description: "Personalizowane streszczenia wiadomości: monitorowane tematy, baza wiedzy, gorące tematy" },
      { slug: "module.weather", name: "Pogoda", description: "Szczegółowa pogoda z opisami AI i obserwatorami (alerty pogodowe)" },
    ]
    const grants = {
      "module.qa": ["ADMIN", "TESTER"],
      "module.truck": ["ADMIN", "BETA_TESTER"],
      "module.languages": ["ADMIN"],
      "module.health": ["ADMIN"],
      "module.habits": ["ADMIN"],
      "module.news": ["ADMIN"],
      "module.weather": ["ADMIN"],
    }
    for (const p of perms) {
      const perm = await prisma.permission.upsert({
        where: { slug: p.slug },
        create: p,
        update: { name: p.name, description: p.description },
      })
      for (const role of grants[p.slug] ?? ["ADMIN"]) {
        await prisma.rolePermission.upsert({
          where: { role_permissionId: { role, permissionId: perm.id } },
          create: { role, permissionId: perm.id },
          update: {},
        })
      }
    }
    console.log("✔ Module permissions seeded.")
  } catch (err) {
    console.warn("⚠ Failed to seed permissions:", err?.message ?? err)
  } finally {
    await prisma.$disconnect()
  }
}

// Domyślna konfiguracja LLM: dostawca Groq (z istniejącego Config.groq_api_key)
// + przypisanie każdego typu operacji do tego dostawcy. Idempotentne — pokrywa
// też ścieżkę `prisma db push` (dev), która nie odpala migracji SQL.
async function seedLlmDefaults() {
  let PrismaClient
  try {
    PrismaClient = require("@prisma/client").PrismaClient
  } catch {
    return
  }
  const prisma = new PrismaClient()
  try {
    let provider = await prisma.llmProvider.findFirst({ orderBy: { createdAt: "asc" } })
    if (!provider) {
      const legacy = await prisma.config.findUnique({ where: { key: "groq_api_key" } })
      provider = await prisma.llmProvider.create({
        data: {
          label: "Groq (domyślny)",
          kind: "openai_compat",
          baseUrl: "https://api.groq.com/openai/v1",
          apiKey: legacy?.value ?? "",
          enabled: true,
        },
      })
    }
    const defaults = [
      { operationType: "dispatch", model: "llama-3.1-8b-instant" },
      { operationType: "reasoning", model: "llama-3.3-70b-versatile" },
      { operationType: "vision", model: "meta-llama/llama-4-scout-17b-16e-instruct" },
      { operationType: "generation", model: "llama-3.3-70b-versatile" },
    ]
    for (const d of defaults) {
      const existing = await prisma.llmAssignment.findUnique({ where: { operationType: d.operationType } })
      if (!existing) {
        await prisma.llmAssignment.create({
          data: { operationType: d.operationType, providerId: provider.id, model: d.model },
        })
      }
    }
    console.log("✔ LLM defaults seeded.")
  } catch (err) {
    console.warn("⚠ Failed to seed LLM defaults:", err?.message ?? err)
  } finally {
    await prisma.$disconnect()
  }
}

function seedQaScenarios() {
  try {
    execSync("npx tsx prisma/seeds/qa-all.ts", { stdio: "inherit" })
  } catch (err) {
    console.warn("⚠ Failed to seed QA scenarios (non-fatal):", err?.message ?? err)
  }
}

async function main() {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" })
      console.log("✔ Migrations applied.")
      await seedPermissions()
      await seedLlmDefaults()
      seedQaScenarios()
      return
    } catch {
      if (i === MAX_ATTEMPTS) {
        console.error("✘ Migration failed after all attempts.")
        process.exit(1)
      }
      console.log(`Attempt ${i} failed (Neon waking up?). Retrying in ${RETRY_MS / 1000}s…`)
      await sleep(RETRY_MS)
    }
  }
}

main()
