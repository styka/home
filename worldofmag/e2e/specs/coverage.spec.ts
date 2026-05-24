import { test } from "../fixtures/test";
import type { EpicSeed } from "../../prisma/seeds/qa-helpers";
import { SHOPPING_EPICS } from "../../prisma/seeds/qa-shopping";
import { TASKS_EPICS } from "../../prisma/seeds/qa-tasks";
import { NOTES_EPICS } from "../../prisma/seeds/qa-notes";
import { KITCHEN_EPICS } from "../../prisma/seeds/qa-kitchen";
import { HOME_EPICS } from "../../prisma/seeds/qa-home";
import { REPORTS_EPICS } from "../../prisma/seeds/qa-reports";
import { TEAMS_EPICS } from "../../prisma/seeds/qa-teams";
import { SETTINGS_EPICS } from "../../prisma/seeds/qa-settings";
import { AUTH_EPICS } from "../../prisma/seeds/qa-auth";
import { ADMIN_EPICS } from "../../prisma/seeds/qa-admin";
import { QA_META_EPICS } from "../../prisma/seeds/qa-qa";

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

// Scenario slugs that already have a concrete, asserting test elsewhere in /e2e.
const IMPLEMENTED = new Set<string>([
  "scenario-create-list-positive",
  "scenario-create-list-empty-name",
  "scenario-no-permission-locked",
  "scenario-mobile-select-list",
  "scenario-tasks-view-today",
  "scenario-tasks-create-project",
  "scenario-tasks-add-quick",
  "scenario-notes-search",
  "scenario-notes-group-create",
  "scenario-notes-tag-create-assign",
  "scenario-kitchen-recipe-create",
  "scenario-kitchen-plan-set",
  "scenario-kitchen-pantry-add",
  "scenario-kitchen-cookbook-create",
  "scenario-qa-home-stats",
  "scenario-qa-module-tree",
  "scenario-qa-scenario-fullscreen",
  "scenario-qa-admin-create-hierarchy",
  "scenario-qa-no-permission",
  "scenario-reports-list-visibility",
  "scenario-reports-admin-create",
  "scenario-home-snapshots-filtered",
  "scenario-home-admin-widget",
  "scenario-admin-console-admin-only",
  "scenario-admin-add-user-role",
  "scenario-admin-config-groq",
  "scenario-admin-non-admin-blocked",
  "scenario-settings-profile-display",
  "scenario-direct-url-blocked",
]);

/**
 * Traceability suite: every QA scenario from the seed data appears here as a
 * test. Scenarios with a concrete implementation are skipped (covered
 * elsewhere); the rest are marked `fixme` with their documented steps so the
 * report shows the full backlog of scenarios still to automate.
 */
test.describe("Pokrycie scenariuszy QA (traceability)", () => {
  for (const { module, epics } of MODULES) {
    for (const epic of epics) {
      for (const story of epic.stories) {
        for (const sc of story.scenarios) {
          const title = `[${module}/${sc.slug}] ${sc.priority} ${sc.title}`;
          test(title, async ({}, testInfo) => {
            // List the backlog once (under the desktop project) to avoid noise.
            test.skip(testInfo.project.name !== "desktop", "Pokrycie liczone raz (desktop)");

            testInfo.annotations.push(
              { type: "epic", description: epic.title },
              { type: "story", description: story.title },
              { type: "type", description: sc.type },
              { type: "kroki", description: sc.steps.join("  →  ") },
              { type: "oczekiwane", description: sc.expected.join("  •  ") },
            );

            if (IMPLEMENTED.has(sc.slug)) {
              test.skip(true, "Zaimplementowane jako dedykowany test w /e2e/specs");
              return;
            }
            test.fixme(true, "Scenariusz udokumentowany — interakcja UI do uzupełnienia");
          });
        }
      }
    }
  }
});
