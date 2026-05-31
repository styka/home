import { test as setup, expect, request } from "@playwright/test";
import fs from "fs";
import path from "path";
import { E2E_ADMIN, E2E_LIMITED } from "../fixtures/users";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Logs in a user through the env-gated `e2e` credentials provider (active only
 * when the server runs with E2E_TEST_MODE=1) and saves the authenticated
 * browser storage state for reuse by all test projects.
 */
async function loginAndSaveState(email: string, statePath: string) {
  const ctx = await request.newContext({ baseURL: BASE_URL });

  // NextAuth CSRF token (also sets the csrf cookie in this context).
  const csrfRes = await ctx.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  // Credentials sign-in. The E2E provider is registered with id "e2e"
  // (see src/lib/auth.ts), so the callback path must match that id.
  // NextAuth sets the session cookie on success.
  await ctx.post("/api/auth/callback/e2e", {
    form: { csrfToken, email, callbackUrl: "/", json: "true" },
  });

  // Verify the session is real.
  const sessionRes = await ctx.get("/api/auth/session");
  const session = await sessionRes.json();
  expect(session?.user?.email, `login failed for ${email}`).toBe(email);

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  await ctx.storageState({ path: statePath });
  await ctx.dispose();
}

setup("authenticate admin", async () => {
  await loginAndSaveState(E2E_ADMIN.email, E2E_ADMIN.storageState);
});

setup("authenticate limited user", async () => {
  await loginAndSaveState(E2E_LIMITED.email, E2E_LIMITED.storageState);
});
