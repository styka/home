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
    ]
    for (const p of perms) {
      const perm = await prisma.permission.upsert({
        where: { slug: p.slug },
        create: p,
        update: { name: p.name, description: p.description },
      })
      // Grant to ADMIN + TESTER roles
      for (const role of ["ADMIN", "TESTER"]) {
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

function seedQaScenarios() {
  try {
    execSync("npx tsx prisma/seeds/qa-shopping.ts", { stdio: "inherit" })
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
