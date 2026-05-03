// This file is called once by Next.js when the server initialises.
// We use it to run `prisma migrate deploy` with retries so Neon free-tier
// wake-up (error E57P01) doesn't prevent migrations from being applied.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { execSync } = await import("child_process")

    const MAX_ATTEMPTS = 5
    const RETRY_MS = 8_000

    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      try {
        execSync("npx prisma migrate deploy", { stdio: "inherit" })
        console.log("✔ Migrations applied.")
        return
      } catch {
        if (i === MAX_ATTEMPTS) {
          console.error("✘ Migrations failed after all attempts — server starting anyway.")
          return
        }
        console.log(`Migration attempt ${i} failed (Neon waking up?). Retrying in ${RETRY_MS / 1000}s…`)
        await new Promise((r) => setTimeout(r, RETRY_MS))
      }
    }
  }
}
