// Runs `prisma migrate deploy` with retries for Neon free-tier wake-up.
// Called at the END of `npm run build` so migrations are applied before
// the server ever starts.
const { execSync } = require("child_process")

const MAX_ATTEMPTS = 5
const RETRY_MS = 8_000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" })
      console.log("✔ Migrations applied.")
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
