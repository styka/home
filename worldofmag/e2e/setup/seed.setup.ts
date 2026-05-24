import { test as setup } from "@playwright/test";
import { ensureE2EFixtures, disconnect } from "../fixtures/db";

// Runs first (setup project). Provisions E2E users + permissions in the DB.
setup("provision E2E users and permissions", async () => {
  await ensureE2EFixtures();
  await disconnect();
});
