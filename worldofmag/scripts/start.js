#!/usr/bin/env node
// Runs `prisma migrate deploy` with retries (Neon free tier wakes up slowly),
// then hands off to `next start`.
const { execSync, spawn } = require("child_process")
const path = require("path")

const MAX_ATTEMPTS = 5
const RETRY_DELAY_MS = 8000

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function migrate() {
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
      console.log(`Migration attempt ${i} failed (Neon waking up?). Retrying in ${RETRY_DELAY_MS / 1000}s...`)
      await sleep(RETRY_DELAY_MS)
    }
  }
}

migrate().then(() => {
  const nextBin = path.join(__dirname, "..", "node_modules", ".bin", "next")
  const child = spawn(nextBin, ["start"], { stdio: "inherit" })
  child.on("exit", (code) => process.exit(code ?? 0))
})
