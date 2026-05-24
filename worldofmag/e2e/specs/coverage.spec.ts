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
  "scenario-add-item-enter",
  "scenario-admin-add-user-role",
  "scenario-admin-architecture",
  "scenario-admin-config-groq",
  "scenario-admin-console-admin-only",
  "scenario-admin-non-admin-blocked",
  "scenario-admin-playground",
  "scenario-admin-system-category-create",
  "scenario-admin-toggle-role-permission",
  "scenario-auth-fresh-permissions",
  "scenario-auth-google-success",
  "scenario-auth-no-anonymous",
  "scenario-auth-unauth-redirect",
  "scenario-categories-three-levels",
  "scenario-create-list-empty-name",
  "scenario-create-list-long-name",
  "scenario-create-list-positive",
  "scenario-direct-url-blocked",
  "scenario-home-admin-widget",
  "scenario-home-snapshots-filtered",
  "scenario-home-subtitle",
  "scenario-home-tasks-badges",
  "scenario-icons-browse",
  "scenario-kitchen-cookbook-create",
  "scenario-kitchen-pantry-add",
  "scenario-kitchen-pantry-expiring",
  "scenario-kitchen-plan-cooked",
  "scenario-kitchen-plan-set",
  "scenario-kitchen-recipe-create",
  "scenario-kitchen-recipe-slug-unique",
  "scenario-kitchen-shop-recipe",
  "scenario-kitchen-stocktake",
  "scenario-mobile-select-list",
  "scenario-no-permission-locked",
  "scenario-notes-create",
  "scenario-notes-group-create",
  "scenario-notes-home-recent-pinned",
  "scenario-notes-search",
  "scenario-notes-tag-create-assign",
  "scenario-notes-tag-filter",
  "scenario-products-browse",
  "scenario-qa-admin-create-hierarchy",
  "scenario-qa-admin-edit-preview",
  "scenario-qa-home-stats",
  "scenario-qa-module-tree",
  "scenario-qa-no-permission",
  "scenario-qa-scenario-fullscreen",
  "scenario-qa-tester-access",
  "scenario-reports-admin-create",
  "scenario-reports-admin-edit",
  "scenario-reports-list-visibility",
  "scenario-reports-open-markdown",
  "scenario-settings-logout",
  "scenario-settings-profile-display",
  "scenario-settings-teams-list",
  "scenario-status-filter",
  "scenario-stores-browse",
  "scenario-switch-lists-sidebar",
  "scenario-tasks-add-empty-blocked",
  "scenario-tasks-add-quick",
  "scenario-tasks-create-project",
  "scenario-tasks-ctrlk-palette",
  "scenario-tasks-nav-jk",
  "scenario-tasks-tag-create-assign",
  "scenario-tasks-view-empty",
  "scenario-tasks-view-overdue",
  "scenario-tasks-view-today",
  "scenario-teams-create",
  "scenario-teams-create-empty-name",
  "scenario-teams-invite-accept",
  "scenario-units-list",
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
