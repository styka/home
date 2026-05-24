/**
 * Zbiorczy seed wszystkich scenariuszy QA dla całej aplikacji.
 * Idempotentny (upsert po slug). Uruchom: npx tsx prisma/seeds/qa-all.ts
 */
import { PrismaClient } from "@prisma/client";
import { seedModule, type EpicSeed } from "./qa-helpers";
import { SHOPPING_EPICS } from "./qa-shopping";
import { TASKS_EPICS } from "./qa-tasks";
import { NOTES_EPICS } from "./qa-notes";
import { KITCHEN_EPICS } from "./qa-kitchen";
import { HOME_EPICS } from "./qa-home";
import { REPORTS_EPICS } from "./qa-reports";
import { TEAMS_EPICS } from "./qa-teams";
import { SETTINGS_EPICS } from "./qa-settings";
import { AUTH_EPICS } from "./qa-auth";
import { ADMIN_EPICS } from "./qa-admin";
import { QA_META_EPICS } from "./qa-qa";

const prisma = new PrismaClient();

const MODULES: { module: string; epics: EpicSeed[] }[] = [
  { module: "shopping", epics: SHOPPING_EPICS },
  { module: "tasks", epics: TASKS_EPICS },
  { module: "notes", epics: NOTES_EPICS },
  { module: "kitchen", epics: KITCHEN_EPICS },
  { module: "home", epics: HOME_EPICS },
  { module: "reports", epics: REPORTS_EPICS },
  { module: "teams", epics: TEAMS_EPICS },
  { module: "settings", epics: SETTINGS_EPICS },
  { module: "auth", epics: AUTH_EPICS },
  { module: "admin", epics: ADMIN_EPICS },
  { module: "qa", epics: QA_META_EPICS },
];

async function main() {
  const owner = await prisma.user.findFirst({
    where: { email: "tyka.szymon@gmail.com" },
    select: { id: true },
  });
  const authorId = owner?.id ?? null;

  let totalEpics = 0;
  let totalStories = 0;
  let totalScenarios = 0;

  for (const { module, epics } of MODULES) {
    const r = await seedModule(prisma, module, epics, authorId);
    totalEpics += r.epicCount;
    totalStories += r.storyCount;
    totalScenarios += r.scenarioCount;
    console.log(`  • ${module}: ${r.epicCount} epików, ${r.storyCount} stories, ${r.scenarioCount} scenariuszy`);
  }

  console.log(`✔ QA seed zakończony: ${totalEpics} epików, ${totalStories} user stories, ${totalScenarios} scenariuszy.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
