# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> For full historical context, session notes, and infrastructure credentials, read:
> `worldofmag/CONTEXT.md`
>
> For accumulated bug/fix lessons (debugging shortcuts you should not relearn), read:
> `doświadczenia.md` (repo root).
>
> For the **working roadmap of remaining work** — an ordered task tracker (`T-NN`, easiest→hardest,
> with statuses we flip ⬜/🟡/🔓/⏸️ → ✅ as tasks complete; owner-decision items live here too), read:
> `worldofmag/content/audyt/64-plan-tracker.md` (Dodatek **A.16 — TRACKER ROBOCZY**). This is the
> guidepost: when continuing audit work, pick the next task from here and update its status.
> Companions: `63-raport-stanu.md` (A.15 — done/remaining snapshot) and `60-status-wdrozen.md`
> (A.13 — detailed per-`Z-NNN` ledger).

---

## Rule: Lessons Learned

**Every time we fix a bug or solve a non-obvious problem, append a lesson to the
`doświadczenia.md` file in the repository root.** (Keep the exact filename, with
diacritics. The log itself is written in Polish — keep new entries in Polish so
they match the existing ones.)

When to add a lesson: a build fails and we fix it → broken logic we correct → a
merge conflict we resolve → a security bug we patch.

Entry format (Polish labels, to match the existing log):
```
## YYYY-MM-DD — Krótki tytuł problemu
**Problem:** co się stało / jaki był błąd
**Rozwiązanie:** co naprawiliśmy i jak
**Lekcja:** co robić inaczej następnym razem
```

Do not ask for permission — just append the lesson and commit it together with the fix.

---

## Project Overview

**WorldOfMag** (internal/product name **Omnia**) is a modular personal life/work
management system for **Szymon Tyka** (tyka.szymon@gmail.com). The name means
"World of the Mage" — Szymon's personal digital world. It has grown well beyond
the original 3 modules into a ~20-module "operating system for life" (shopping,
tasks, notes, kitchen, pets, health, habits, vehicles, finance, languages, news,
weather, storage, workshop, a service marketplace, contacts/CRM, a unified
calendar, …) unified by a shared ownership model, RBAC, notifications, a
soft-delete trash, per-user Google Drive storage, and an AI assistant.

### UX Philosophy
- Keyboard-first (vim-style shortcuts: j/k, x, e, d)
- Dark theme, minimalist (Linear/GitHub/VS Code aesthetic), skinnable
- Zero unnecessary clicks or animations
- Designed for a developer power user

### Module Status
| Module | Route | Permission | Status |
|--------|-------|------------|--------|
| Home (AI dashboard) | `/` | `module.home` | Done — Sparkles AI assistant + on-demand morning briefing; **personalizable dashboard** (section order/visibility, per-user `DashboardPref`); Beta badge for `BETA_TESTER` |
| Shopping | `/shopping` | `module.shopping` | Done and deployed |
| Tasks | `/tasks` | `module.tasks` | Done — custom per-list statuses, project groups, recurring tasks, subtasks, bulk add, **timeline + kanban views**. **Tag filter of constant height** (100, `FiltrTagow`): one button with a counter („Wszystkie" / „3 z 18") + an `AnchoredLayer` panel with search and multi-select, plus removable chips for the tags actually **selected**. The old strip drew one chip per **existing** label, so the bar grew linearly with the user's tag dictionary — same fault, same cure as `SourceFilter` (083). Filter semantics (conjunction in `TasksPage`) unchanged |
| Notes | `/notes` | `module.notes` | Done — live markdown preview, **wikilinks `[[Title]]`** + weighted full-text search, attachments (`NoteAttachment`), version history (`NoteRevision`) |
| Kitchen (recipes/meal plan/pantry) | `/kitchen` | `module.kitchen` (+ sub-perms) | Done — recipes/meal plan/pantry + per-recipe nutrition values |
| Pets (care/husbandry/breeding) | `/pets` | `module.pets` | Done — care/husbandry/breeding + genetics, enclosure alarms, vet export (PDF card + CSV measurements), pet calendar |
| Health (visits/tests + meds) | `/health` | `module.health` | Done — visits + **lab-test repository** (`HealthAttachment`, PDF/image) with trend analysis + **Leki i pielęgnacja** sub-section (`/health/leki`): medication dosing & recurring care tasks (dressing changes, nails…), "today" agenda with check-off, integrated with Calendar and the AI assistant |
| Habits (tracker/heatmap) | `/habits` | `module.habits` | Done — heatmap/streaks + weekly goals + habit↔task integration |
| Flota (vehicles/fuel/service) | `/flota` | `module.flota` | Done — vehicles/fuel/service + attachments (`VehicleAttachment`: invoices, registration, insurance) |
| Portfel (personal finance) | `/portfel` | `module.portfel` | Done — wallet elements/entries + **budgets & savings goals** (`/portfel/budzety`), **monthly reports** (`/portfel/raporty`), **settings + multi-currency/exchange rates** (`/portfel/ustawienia`), and **auto-expense booking** from other modules (`WalletEntry.sourceModule/sourceId`) |
| Languages (SRS flashcards) | `/languages` | `module.languages` | Done — SuperMemo-2 + TTS/pronunciation, writing mode, study series |
| Wiadomości (news + timeline) | `/wiadomosci` | `module.news` | Done — **reading mode** (087, `czytanie` in the URL so a reading-mode view is favouritable): one toggle in the module bar hides the refresh-status strip, the module tabs and the main actions, leaving the topic navigator, the source filter, the content switch and the reader — measured 303 → 202 px of chrome above the first item at 360 px. Topic edit/delete moved into a three-dot menu; module settings left the tab strip for the frame's `settings` slot. **Topics with nothing new are hidden by default** (085; `NewsPref.showEmptyTopics`, toggle in the module's own **Ustawienia** view — reached from the frame's `settings` gear since 087, not from a tab; „Źródła" is now sources only, and the summary-length setting moved where it belongs). The view filters the SAME set that feeds the jump list, so content and navigator can never disagree. **single-column layout**, **one navigation bar** (`GroupNavigator`, shared component in `components/ui/nav/`): a searchable topic list that is a JUMP, not a filter (084 — the owner reversed 083 here: the view always shows every topic, the list only scrolls to one; prev/next arrows are gone, and `etykietaStala` makes the trigger read „Tematy" rather than a topic name, so the sticky section header stays the only place a topic is named). The old Stream/Single-topic switch is gone (it was the same list under two names) and so is the refresh-history panel (`NewsRefreshRun` still records runs — administrative data). **Source filter of constant height** (`SourceFilter`: one button with a counter + an `AnchoredLayer` panel, multi-select — the old chip strip made the sticky bar height depend on the number of feeds; measured 59 px at both 3 and 15 sources). **Timeline works for ALL topics** (`getStreamTimeline`, same sticky-header sections as the news view). Topic edit/delete live in a three-dot menu in the section header (087), add-topic in the view actions. **Hot-topics lists are a SEGMENTED SWITCH, not a ⋮ menu** (100, `PrzelacznikSegmentowy` in `components/ui/nav/`): „Proponowane | Monitorowane | Odrzucone", each with a counter, in one row of the sticky section header. 099 had hidden the last two behind ⋮ to save a row at 360 px, and the owner reported both resulting faults at once — the menu says neither what is available (you must open it) nor what is selected (the state sits inside a closed layer). A segment whose counter is 0 stays **visible but disabled**: hiding it would change the bar's width mid-work and conceal that the list exists. `NaglowekSekcji` gained an optional `segmenty` prop that replaces the title+counter pair — kept in that file because `top: var(--news-pasek-h)` and the height the cover is computed from live there (086/087). View state — content kind, sources and reading mode — lives in the **URL** (`tresc`/`zrodla`/`czytanie`), so a view is favouritable (`temat` was dropped in 084 together with the filter); `NewsPref.activeSourceKey` was dropped as a second carrier. **systemic RSS source library** (`NewsSourceCatalog`, 419 seeded entries PL + world, browsable by country/language/category from the sources view; manual add unchanged; admin-managed at `/admin/zrodla-rss`), **one `news.refresh` job for the whole module** (shared article pool `NewsArticle` → cheap classification → summaries → timeline), **event timeline** (`NewsTimelineEntry`) replacing the old versioned knowledge base, hot topics read **from the pool** (no re-fetch) with per-topic **hiding/restoring**, **reader** (`NewsReader`, 084): one bar per view, `position: fixed` at the bottom (`sticky bottom-0` only sticks once you scroll down to it — useless), no repeated text of its own; the sentence being read is highlighted **inside the news card**, matched by sentence TEXT (both sides split with `lib/speech/sentences`, so an index would need two lists kept in sync). Silence can no longer masquerade as playback: `lib/tts` `speak()` takes `onSilent` and a 1.5 s watchdog fires when neither `onstart` nor `onend` arrives — iOS rejects speech started outside a user gesture with no event at all. 24h freshness. Chrome above content measured at **163 px** (was 515) after moving to `ModuleView` density=compact |
| Pogoda (weather) | `/pogoda` | `module.weather` | Done — Open-Meteo (sunrise/sunset + moon phase, day/night icons), **location picking on a map** (Leaflet+OSM, reverse geocoding), watchers (preset + custom, **editable**, status = *is the watcher's condition met* — `met/partial/unmet/unknown`, never a judgement of "nice weather"; **list ordered by state** with an optional grouped view, remembered per user in `WeatherPref`. 085: the status **filter chips are gone** — the owner did not want that filter and they wrapped to a second row; counts survive in the grouped layout. One control bar now sits **above** the list: layout choice + `AiContentMeta` (generated-at / stale / re-analyse / mode / cost). It used to sit at the very bottom, under the wall of watchers, so you learned the rating was stale only after scrolling past everything), **„Co robić?" as a list of AI proposals** with on-demand persistent detail plans + an idea library (`/pogoda/pomysly`, `WeatherIdea`) |
| Magazynowanie (storage/inventory) | `/magazynowanie` | `module.magazynowanie` | Done — **two modes (Dom/Pro, per-user `StorageSettings`)**. Shared: items by warehouse+location, SKU/EAN, min-stock replenishment→shopping, stocktake, AI photo inventory, movement log. **Dom:** "where is it?" (AI search), QR labels (print+scan), warranties/expiry, value+photos (CSV export). **Pro:** barcode in/out scan (`@zxing`), suppliers, PZ/WZ/invoice documents (OCR), purchase orders (LLM draft), analytics (value/ABC/dead-stock/trend + AI takeaways), batches/lots + FEFO. AI in assistant (`add_storage_item`/`adjust_storage` + read-tool `list_storage_items`) |
| Warsztaty (workshop/studio) | `/warsztaty` | `module.warsztaty` | Done — **two modes (Dom/Pro, per-user `WarsztatSettings`)**. Any workshop type (woodworking/automotive/painting/electronics/metalworking/ceramics/sewing/jewelry/general). Equipment register (`WorkshopItem`: kind tool/machine/material/PPE, condition, qty+min-stock, service `nextServiceAt`), **static equipment-suggestion catalog by profile** (`src/lib/warsztat/catalog.ts`, basic/recommended/advanced tiers) as an "add to equipment" checklist. **Pro:** team ownership, tool assignment (who has / station), service + low-stock agenda (`/warsztaty/przeglady`), project journal (`WorkshopProject`). AI: read-tool `list_workshops` + actions `create_workshop`/`add_workshop_item` |
| Usługi (service marketplace) | `/services` | `module.services` | Done — provider profiles (admin-set **verified** badge, public profile + slug/tagline at `/providers/[id]`), listings (categories, advanced filters/sort), service requests with a status workflow, **in-app chat** (`ServiceMessage`), **quotes** (`ServiceQuote`), **portfolio** images (`ServiceImage`), **availability + slot booking** (`ServiceAvailability`, `lib/serviceSlots.ts`, `lib/serviceGeo.ts`), ratings/reviews (`ServiceReview`), **payments/invoices** (`ServicePayment`, Portfel integration), **favorites** (`ServiceFavorite`), **promo codes** (`ServicePromoCode`), **multi-worker firms** (`ServiceStaff`), **disputes + admin moderation** (`ServiceDispute`, `/services/moderation`) |
| Calendar | `/calendar` | `module.calendar` | Done — **unified agenda** aggregating tasks (due dates), kitchen meal plan, health meds & care, pet care, SRS language reviews and fleet service/inspection into a month grid (`actions/calendar.ts` `getCalendarEvents` + `lib/calendar.ts`) |
| Contacts (CRM) | `/contacts` | `module.contacts` | Done — lightweight personal CRM (contacts with tags); model `Contact`, `actions/contacts.ts` |
| Reports (markdown docs) | `/reports` | authenticated | Done — system/user/team reports; **content stored in DB or per-user Google Drive** (`Report.storage` db\|drive, hydrated transparently) |
| QA (test scenarios) | `/qa` | `module.qa` | Internal tooling (Epic → Story → Scenario) |
| Truck (heavy-vehicle routing) | `/truck` | `module.truck` | Done (experimental) — vehicle profile (weight/height/length/width/axle load), ORS truck routing origin→destination, distance/duration + roadworks-in-corridor, "open in Google Maps" deep-link |

> **Keep this table honest.** When you add/finish/stub a module, update this table, the Route Structure block, the permission list, the Server Actions list, and the Database Schema section below.

---

## Repository Layout

```
/home/user/home/
├── CLAUDE.md               # This file
├── doświadczenia.md        # Lessons-learned log (Polish) — read & append per the rule above
├── pom.xml                 # Legacy Spring Boot 1.5.4 — DO NOT TOUCH
├── src/                    # Legacy AngularJS 1.5.5 — DO NOT TOUCH
├── _old/                   # Archived old code — DO NOT TOUCH
└── worldofmag/             # Active application — all new work goes here
```

All work happens inside `worldofmag/`. Run all commands from there.

---

## Development Commands

```bash
cd worldofmag

# Local dev — needs a real PostgreSQL (the Prisma schema is postgres-only; see
# "Database & migrations"). Point .env.local at it, e.g. a local Postgres or a
# Neon branch:
echo 'DATABASE_URL="postgresql://omnia:omnia@127.0.0.1:5432/omnia_dev"'  > .env.local
echo 'DIRECT_URL="postgresql://omnia:omnia@127.0.0.1:5432/omnia_dev"'   >> .env.local
npm install
npx prisma migrate deploy   # apply existing migrations to your dev DB
npm run db:seed             # populate seed data
npm run dev                 # → http://localhost:3000

# Database
npm run db:migrate   # prisma migrate deploy (apply migration files)
npm run db:studio    # Prisma Studio UI
# npm run db:push    # prisma db push — only against a throwaway dev DB you own

# Build (prod-oriented; see warning under "Database & migrations")
npm run build
```

### Required environment variables
```
DATABASE_URL          # PostgreSQL connection string (Neon in prod; local Postgres in dev)
DIRECT_URL            # Same as DATABASE_URL (required by Prisma for Neon)
AUTH_SECRET           # NextAuth secret
AUTH_URL              # Base URL for auth callbacks (e.g. https://worldofmag.onrender.com)
GOOGLE_CLIENT_ID      # Google OAuth
GOOGLE_CLIENT_SECRET  # Google OAuth
```

### Database & migrations

- **The schema is PostgreSQL-only** (`datasource.provider = "postgresql"`). The old
  "local dev uses SQLite (`file:./dev.db`)" note is **obsolete** — `prisma db push`
  against SQLite does not work. For a verifiable local build, stand up a local
  Postgres (the sandbox image ships Postgres 16: `pg_ctlcluster 16 main start`,
  role+db e.g. `omnia/omnia_dev`), point `.env.local` `DATABASE_URL`/`DIRECT_URL`
  at `127.0.0.1:5432`, and run `npx prisma migrate deploy`. **Also export those
  vars into the shell** — `scripts/migrate.js` does not read `.env.local`.
- **Editing `schema.prisma` alone does NOT create tables in prod.** Production runs
  `prisma migrate deploy`, which only *applies existing migration files*. Any new
  model/column needs a **hand-written migration file** under `prisma/migrations/`.
- **Never run `npm run build` / `scripts/migrate.js` locally against a prod
  `DATABASE_URL`** — `migrate.js` runs `migrate deploy` (+ seeding) on the real
  Neon DB. For a docs-only change you don't need a build at all.
- **Reports** are seeded via idempotent, dollar-quoted SQL migrations:
  `INSERT INTO "Report" (…) VALUES (gen_random_uuid()::text, …, $tag$…markdown…$tag$, 'category', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("slug") DO NOTHING;`
  (PostgreSQL-only, idempotent). The `slug` must be **globally unique** — `ON CONFLICT
  DO NOTHING` silently skips a duplicate, so a report with a reused slug never lands.
  Module permissions are likewise seeded in SQL migrations (`gen_random_uuid()::text`).
- **Migration numbering**: every new migration dir needs a **unique, sequential**
  4-digit prefix. Get the next free number with `npm run next:migration`; `npm run
  check:migrations` (also wired into `build`) fails on a *new* collision. The 12
  legacy duplicate prefixes (parallel `claude/*` branches) are grandfathered in
  `scripts/check-migrations.js` — **never renumber an already-applied migration**:
  `migrate deploy` keys on the full dir name, so a rename re-runs it (CREATE/ALTER →
  deploy breaks). Duplicate prefixes are harmless to leave; only fix them going forward.

### E2E tests (klikacze)

**When asked to "run e2e / klikacze":**
- **Claude on web (remote sandbox)** — the network blocks downloading browsers and
  Docker, so `npm run test:e2e:local` does NOT work. Use the prepared script and
  runbook that work around this (preinstalled Chromium + local Postgres, no Docker).
  **098: the script builds the app and serves it with `next start`** instead of `npm run dev` —
  in dev Next compiles a route on first hit and parallel workers tripped over each other, so the
  result depended on what the neighbouring worker was doing (the same tests passed alone and failed
  in the full run). The suite went from ~18 min to ~2 min and now exercises the code that actually
  ships. `E2E_DEV=1` restores the dev server if you need it.
  ```bash
  cd worldofmag
  nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &   # background; then: tail -40 /tmp/e2e.log
  ```
  Full instructions: **`worldofmag/docs/e2e/uruchamianie-e2e-claude.md`**.
- **Locally (human, with Docker)** — `npm run test:e2e:local` (headed demo).
  Non-technical tester guide: **`worldofmag/docs/e2e/instrukcja-testera-e2e.md`**.
- Framework details: `worldofmag/e2e/README.md` and `/admin/e2e`.
- The E2E login provider is **offline-only** (`E2E_TEST_MODE=1`, never on prod).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI | React 18 + Tailwind CSS + CSS variables (skinnable) |
| Auth | NextAuth v5 (beta) + Google OAuth + Prisma adapter |
| Components | Radix UI (headless), cmdk (palette), Lucide React (icons), @dnd-kit (drag & drop) |
| Scanning | `@zxing/*` (barcodes), `qrcode` (QR labels) |
| ORM | Prisma 5 |
| DB | PostgreSQL (Neon in prod; local Postgres in dev — **no SQLite**) |
| PWA | Installable: `ServiceWorkerRegistration` component + generated icons (`/pwa-icon`, `/apple-touch-icon`) |
| Hosting | Render (Frankfurt, free tier) |

---

## Architecture

### Module boundaries — `src/platform/` and `src/modules/` (046, Faza 1)

The rebuild's Faza 1 introduced two directories with **hard, lint-enforced** boundaries.
**All 21 modules now live in `src/modules/`** — the transitional array is gone, and `PERMISSIONS`
in `platform/auth/permissions.ts` holds only non-module surfaces (`SETTINGS`, `ADMIN`,
`INVITATIONS`, plus Kitchen's five sub-permissions). That emptiness is the proof the "8 → 1" goal
landed: no module slug lives in a parallel list any more.

**A file belongs to the module its CONSUMERS put it in, not the one its name suggests.** This ruling
kept `lib/habitStats.ts`, `lib/medicationSchedule.ts` and `actions/tags.ts` outside the modules
(shared by several), and — the other way round — moved the shopping dictionaries (categories, units,
products, category icons) *into* Shopping once a consumer check showed nobody else called them.

**A contract carries what consumers call, not what the module exports.** Magazynowanie exports 47
actions; its contract has 14. Cross-module coupling turned out to be five one-function calls:
`assertListAccess` (Kitchen, Storage → Shopping), `createTask` (Weather, Habits → Tasks), `addEntry`
and `bookAutoExpense` (Services, Fleet, Shopping → Portfel).

**The shell imports no module internals.** Per-module side navigation comes from the declaration
(`sideNav`, lazily loaded — `module.ts` is read by server code, so a static import of a client
component would drag it into every such graph). The global AI assistant lives in
`components/assistant/`, not in the Home module: the shell mounts it on every page, so it is chrome,
not the dashboard.

```
src/platform/     # capabilities that know NOTHING about any module
  auth/{session,permissions,serverUtils,ownership}.ts   db/prisma.ts
  trash/  audit/  notifications/  viewState/  shortcuts/  favorites/
  ai/             # 049: agent protocol, content memory, cost, rate limits, action contract,
                  #      catalog.ts (buildAiCatalog — takes contributions as a PARAMETER)
  llm/            # 049: chat, model resolver, pricing, effort, TPM limiter
  jobs/           # 049: queue, worker (handler resolver + retention policies are INJECTED)
  sharing/        # 052/090: requireAccess/requireShareAccess, per-request + per-operation cache
  workspaces/     # 051–079: zapis.ts (where a new record goes), sync.ts (Team → Workspace mirror)
  concurrency/    # 062: updateWithVersion (updateMany + version guard)
  events/         # 070–073: DomainEvent outbox, worker, dispatch, in-process SSE bus
  rateLimit/      # 081: SHARED limiter — windows in `RateLimitBucket`, concurrency LEASES
  retention/      # 083: executor + hourly scheduler; policies come as a PARAMETER
  observability/  # 086/087: structured log (context via AsyncLocalStorage, PII scrub) + metrics
  cache/          # 085: stempel.ts — workspace stamp used as the aggregate cache KEY
  runtime/        # 088: rola.ts — OMNIA_ROLE (web | worker | cron | all)
  i18n/           # 089: language list, request context, Intl formatting, prompt language sentence
  calendar.ts     # 049: CalendarContributor type
  registry.ts     # ModuleDeclaration + defineModule + pure merge helpers
  ui/index.ts     # RE-EXPORT of components/ui (deliberately not a move)
src/modules/<x>/  # a module
  contract.ts     # the ONLY file other modules may import
  module.ts       # defineModule(...) — menu, permission, paths, sideNav, ai, jobs, calendar
  actions/  ui/  lib/
  ai/             # 049: catalog.ts (prompt text) + executor.ts + readTools.ts + index.ts
  jobs/           # 049: this module's background handlers + index.ts
  calendar.ts     # 049: this module's contribution to the shared agenda
  dashboard.ts    # 050: this module's contribution to the home snapshot (wired in
                  #      lib/dashboardContributors.ts, NOT in module.server.ts — see below)
  sharing.ts      # 052: resource declaration (label, operations → roles, parent); wired in
                  #      lib/sharingResources.ts
  retention.ts    # 083: this module's retention policies (wired in lib/retention/polityki.ts)
```

**049 — the declaration now carries the module's whole contribution to the app.** Four lazy fields
(`sideNav`, `ai`, `jobs`, `calendar`), each a function returning `import()`. **Laziness is a
correctness requirement, not an optimisation, and it cuts both ways:** `module.ts` is read by server
code (so a static import of a client component would drag it into every such graph — that was
`sideNav` in 048), *and* `MODULES` is imported by `ModuleSidebar`, a client component (so a static
import of an executor would drag Prisma into the browser bundle — that is `ai`/`jobs`/`calendar` in
049). The document (chapter 9.3) shows these as static fields; Omnia deliberately deviates.

What the fields replaced — five parallel lists that no longer exist: the assistant's action catalog
(a 16-entry map of prompt text), the executor registry (a chain of 16 `if (module === …)`), the
read-tool dispatcher (a 56-case `switch`, 1199 lines), the job-handler map (which also produced the
**enqueue allowlist** — a security boundary), and the calendar aggregate (9 queries into six other
modules' tables, 227 lines → 32). **050 removed the sixth and last one: the home dashboard
snapshot.** `src/app/page.tsx` went from eight module-contract imports and ten permission branches to
zero of either; eleven modules each declare a `dashboard.ts`. Equivalence was proved against a
runtime dump taken *before* the move — 20 fields, value by value, in two variants (with and without
permissions) — because the snapshot is built **in place** and `tsc` alone would not have caught a
silent regression. Phase 1 of the rebuild is now closed in full.

**A shared registry of lazy loaders is itself a barrel — the 049 contract lesson one floor up.**
The dashboard contributions deliberately do **not** live in `module.server.ts`: that object holds
four lazy loaders per module, and webpack's dev graph follows `import()` targets reachable from any
statically imported file, so importing it for *one* field compiles all four. Measured on `/`:
1889 (before) → **2117** via `MODULE_SERVER` → **1903** via a dedicated root
(`src/lib/dashboardContributors.ts`), where +14 is exactly the number of new source files. The cost
of that choice — the wiring is no longer visible in the module's declaration — is paid by the gate,
which checks it **both ways**. `calendarContributors.ts`, `lib/ai/catalog.ts` and
`lib/jobs/registry.ts` still pay the same tax; splitting them is the same operation, deliberately
left as a separate step.

**The platform composes but never knows.** `buildAiCatalog(contributions)` and the worker's handler
resolver both take module knowledge as a **required parameter** — the `filterAccessibleFavorites(…,
isPathLocked)` pattern. Composition roots live outside the platform: `src/lib/ai/catalog.ts`,
`src/lib/jobs/registry.ts`, `src/lib/calendarContributors.ts`, `src/lib/dashboardContributors.ts`
+ `src/lib/dashboardSnapshot.ts`, next to `src/lib/modules.tsx`.

Three rules, each enforced by a gate rather than by good will:

- **A module sees another module ONLY through `@/modules/<x>/contract`.** Its *own* internals it
  imports **by relative path** (`./actions/x`) — to a linter, `@/modules/qa/…` inside `modules/qa`
  looks identical to a foreign import, so with aliases one rule cannot tell mine from theirs and you
  would need an `overrides` block per module. With relative paths the boundary is visible in the
  import itself. `npm run check:boundaries` breaks both rules on purpose and demands ESLint actually
  errors — because `next lint` **exits 0 on an invalid config**, which would silently disable the rule.
- **`src/platform/**` must not import `@/modules/*` at all** — not even a contract (asymmetry from
  chapter 7.1: a module knows the platform, the platform knows no module). When the platform needs
  module knowledge it **takes it as a required parameter** (`filterAccessibleFavorites(…, isPathLocked)`);
  an optional parameter with a "historical" default would turn a forgotten argument into a silent RBAC leak.
- **A module registers with ONE declaration.** `npm run check:module-registry` fails the build when a
  directory in `src/modules/` lacks `contract.ts`/`module.ts`, has an incomplete declaration, a
  duplicate id, or **is not imported by the composition root** (`src/lib/modules.tsx`) — a module that
  exists on disk and not in the app otherwise builds green.

Because the platform may not import modules, **the composition root is `src/lib/modules.tsx`**, not
`platform/registry.ts`: the platform supplies the type and pure helpers, the root assembles. Same for
path→permission: `platform/auth/permissions.ts` keeps `legacyPermissionForPath` (modules not yet moved
plus non-module surfaces such as `/settings`, `/admin`), and **`src/lib/pathPermissions.ts` is the
app-wide `permissionForPath`/`isPathLocked` you should import**.

Contracts carry exactly what consumers need — never "everything just in case". A contract growing to
dozens of functions is a signal the module does too much.

### Route Structure (`src/app/`)

```
/                        # Home (AI dashboard + Sparkles AI assistant FAB + morning briefing)
/shopping/ [listId]      # Lists; + /categories /units /products /icons (+/icons/categories) /stores/[storeId] (graph editor) /stores/guide
/tasks/ [projectId]      # Task projects (+ virtual views today/upcoming/overdue/all + /tasks/multi?group=|projects= for project groups / multi-project); + /tasks/tags
/notes/                  # Notes; + /all /groups /tags
/kitchen/                # Recipes /recipes/[id]/(edit|cook), /cookbooks/[id], /plan, /pantry/stocktake
/pets/ [petId]           # Pet profiles; + /pets/calendar (care calendar)
/health/                 # Medical visits + lab tests; + /health/leki (medication & care scheduling: dosing, times, recurrence, today-agenda)
/habits/                 # Habit tracker (heatmap, streaks)
/flota/ [vehicleId]      # Vehicles (fuel logs, service records)
/portfel/ [elementId]    # Personal finance (wallet elements + entries); + /budzety (budgets & savings goals), /raporty (monthly reports), /ustawienia (multi-currency / exchange rates / settings)
/languages/ [deckId]     # SRS vocabulary decks; + /[deckId]/study
/wiadomosci/             # News: one compact view bar (title + tabs Tematy/Gorące tematy/Źródła + Nowy temat/Odśwież; on phones the bar wraps to TWO rows — filters get their own), below it a STICKY navigation bar: GroupNavigator (list = jump to a topic, never a filter) + source filter + content switch (icons below `lg`). Reader is one fixed bar at the bottom. Hot topics (from the pool, hideable, with management of monitored/rejected), reader
/pogoda/                 # Weather: forecast (Teraz → „Co robić?" → hours → days), map location picker, watchers; + /pogoda/pomysly (idea library: saved/considered/blocked proposals, soft-delete to /trash)
/magazynowanie/          # Storage: items by warehouse+location (mode-aware sub-nav). Dom+Pro: /szukaj (AI "where is it?"), /etykiety (QR), /scan (AI photo), /stocktake, /ustawienia (Dom/Pro + currency). Pro: /przeplyw (in/out scan), /analityka, /dostawcy, /zamowienia, /dokumenty (OCR PZ/WZ/invoice)
/warsztaty/ [workshopId] # Workshops: list + detail with tabs (Equipment / Suggestions-by-profile / Projects-Pro). Mode-aware sub-nav: /przeglady (Pro: service + low-stock agenda), /ustawienia (Dom/Pro)
/services/ [listingId]   # Service marketplace: listings; + /requests (my requests, both sides), /provider (my provider profile + listings + availability), /providers/[providerId] (public profile), /moderation (admin-only dispute panel)
/calendar/               # Unified agenda (month grid aggregating all modules)
/contacts/               # Contacts / lightweight personal CRM (contacts with tags)
/trash/                  # Unified soft-delete recovery (authenticated-only; restore items deleted across modules, retention-day countdown)
/udostepnione/           # 067/090: "Shared with me" / "What I shared" — one query to one table across all modules. Write side is `ShareDialog` (mounted next to the resource, e.g. the Tasks header)
/qa/ [module]            # QA test scenarios (Epic → Story → Scenario); + /scenariusz/[slug]
/truck/                  # Heavy-vehicle routing (OpenRouteService)
/reports/ [slug]         # Markdown reports (system/user/team), user-facing
/settings/               # User profile + appearance (skin picker) + menu customization; + /settings/team/new, /settings/team/[teamId]
/invitations/            # Team invitations
/guide/                  # Help documentation
/admin/                  # Admin console (module.admin)
/admin/access/           # RBAC: permissions, role↔permission, user↔role (self-lockout guard)
/admin/audit/            # Audit log viewer (RBAC + config changes; `AuditLog`, `access.ts` getAuditLog)
/admin/health/           # System health dashboard (DB/migrations/API diagnostics; `actions/systemHealth.ts`, computed live)
/admin/config/           # System key-value config (e.g. groq_api_key, brave_search_api_key — masked, encrypted at rest)
/admin/llm/              # LLM providers + model-per-operation-type assignment
/admin/ai-coverage/      # AI action coverage viewer — every user mutation/read action + whether the AI assistant can do it (source: src/lib/ai/action-coverage.json via getAiCoverage(); gate-enforced always-current)
/admin/skins/            # System skins manager
/admin/categories/       # Global system category management
/admin/zrodla-rss/       # Systemic RSS source library (`NewsSourceCatalog`): browse/add/edit, enable-disable (the reversible "delete"), per-entry feed check, JSON import/export. Seeded by migration 0255 (419 entries); users add from it in `/wiadomosci`
/admin/reports/          # Markdown reports CRUD (+ /new, /[slug], /[slug]/edit)
/admin/docs/             # In-app docs browser (docs/ copied in at build by scripts/copy-docs.js)
/admin/audyt/            # Analiza/Audyt stanu projektu + wskazania (admin-only "book" reader; source = content/audyt/*.md baked by scripts/copy-audyt.js → src/generated/audyt-book.ts)
/admin/audyt-podsumowanie/ # Audyt — podsumowanie zmian (admin-only 2-chapter book "Co wykonano / Co pozostało"; source = content/audyt-podsumowanie/*.md baked by scripts/copy-audyt-podsumowanie.js → src/generated/audyt-podsumowanie-book.ts; reuses AudytBookReader via basePath)
/admin/architektura-docelowa/ # Omnia 🧐 — architektura docelowa (admin-only książka 14-rozdziałowa: opis stanu, jaki ma powstać po przebudowie — modularny monolit z twardymi granicami, jednolite współdzielenie zasobów, warstwa operacyjna na 100 tys.+ użytkowników, plan w 9 fazach i checklista 46 zadań). Źródło = content/architektura/*.md bakowane przez scripts/copy-architektura.js → src/generated/architektura-book.ts; reużywa AudytBookReader (basePath) i dokłada `copyPrompt` — ikonę kopiowania CAŁEGO dokumentu jako promptu uruchamiającego spec-driven pipeline. ŚWIADOMIE inny adres niż /admin/architecture (tamto = drzewo bieżącej struktury)
/admin/spec-pipeline/    # Spec-Driven Pipeline — przewodnik (how we build features with Claude Code: /specify /plan /tasks /implement /verify /review); source = .claude/spec-pipeline/{README,constitution}.md baked by scripts/copy-spec-pipeline.js → src/generated/spec-pipeline.ts; reuses AdminDocsViewer
/admin/playground/       # Component playground
/admin/architecture/     # App structure overview (currently minimal)
/admin/e2e/              # E2E click-tests guide (how to run Playwright)
/admin/qa/               # QA scenario authoring (epic/story/scenario CRUD)
/auth/signin/            # Google OAuth sign-in
```

### Component Organization (`src/components/`)

Organized by module: `shopping/`, `tasks/`, `notes/`, `kitchen/`, `pets/`,
`health/`, `habits/`, `flota/`, `portfel/`, `languages/`, `news/`, `weather/`,
`magazynowanie/`, `warsztaty/`, `services/`, `calendar/`, `contacts/`, `trash/`,
`qa/`, `truck/`, `reports/`, `home/`, `settings/`, `teams/`, `skins/`, `admin/`,
`shell/`, `command-palette/`, `brand/`, `ui/` (incl. `ui/nav/GroupNavigator.tsx` — 083, the shared
"set of groups, each with a list of items, read by scrolling" navigator: a searchable list, and
nothing else. 084 deleted its two other navigation modes — prev/next arrows and the aggregate
„Wszystkie" entry — the moment the only consumer stopped passing them: dead API in a SHARED
component is worse than no API, because the next module reads it as the recommended path. The step
itself survives as the pure `sasiadujacaGrupa`, which a consumer wires where it wants (in News: the
sideways swipe on a phone). It knows nothing about any module and deliberately never shows the name
of the group currently being READ — that belongs to the group's own sticky header) (+ a top-level
`ServiceWorkerRegistration.tsx`). `admin/` now also holds `AuditLogPage.tsx`,
`SystemHealthPage.tsx`, `SpisNarzedziAdmina.tsx` (110 — the panel's grouped, searchable launcher)
and `PowrotDoPanelu.tsx` (110 — the one back link to `/admin`); `shell/` holds
`FeedbackInspector.tsx` (admin element-picker). The authoritative module registry
(labels/icons/colors/permissions/order) is `src/lib/modules.tsx`.
Each module typically has a `*Page.tsx` (client entry) and `*HomePage.tsx` (server
wrapper). The `AppShell` (`shell/`) wraps all pages with `ModuleSidebar` (desktop),
a mobile top bar + bottom tab bar, the notification bell, and the global AI assistant.

**View contract (045) — a module DECLARES a view; the shell draws the frame.** Every module view
renders `ModuleView` (`src/components/ui/view/`) instead of hand-rolling a header. The module passes
`title`/`icon`/`filters`/`actions`/`state`. **This is why the shell cannot draw the bar itself** —
`AppShell` renders `<main>{children}</main>` and does not know the module's title, so a bar drawn
there would produce double headers in ~20 modules (the exact reason the 043 request could not be met).
**085 — the bar no longer carries shell chrome, and it STICKS.** `ViewChromeProvider` is gone: the
favourites star and the shortcuts cheat-sheet moved to the **account chrome** (phone: top bar next to
the bell; desktop: a row of icons **above the navigation**, under the app name — the owner asked for
the star "next to the icons where the notification icon is", and 086 moved that row up from the
sidebar footer: "that's the place for such things"), and the freshness indicator was deleted outright because it reported the
shell's own 45-second page refresh, not the module's data freshness. What survives of that file is the
`ViewResource` type. The bar is now `position: sticky` at the top of the scroll area — and that is a
STRUCTURAL change, not a style: a sticky element only sticks within its own parent, so the bar had to
become a **direct child of the scroll container**, with the breadcrumb + `PageHeader` split off into a
block above it (they still scroll away — freezing the title would cost a phone list dozens of pixels
permanently). The bar publishes its height as `--view-bar-h`; a module with its own sticky bar (News)
offsets by it and measures its scroll cover as the **sum of two HEIGHTS** (view bar + its own bar).
086 corrected this: 085 measured one *distance* (module bar's bottom vs. frame's top), which is
identical to the sum whenever the module bar abuts the view bar — and grows by whatever appears
between them (the refresh-status strip), pushing every sticky section header that much too low.
**087 — three more things the frame now owns.** (1) **Module settings have one place app-wide**: the
`settings` slot (gear, last item of the action zone, `aria-pressed` because the same button enters and
leaves settings). News is its first consumer — its fourth tab is gone. (2) **`chromeless`** lets a view
ask for a frame with no header and no bar (News' reading mode), on condition it carries its own always
visible way out. (3) A view **without** a bar gets the header's bottom padding back — 085 moved that
padding into the bar's top padding, so it vanished together with the bar in ~10 views (in Weather the
content literally touched the module name). Also fixed here: a module's own sticky cover is now a CSS
`calc(var(--view-bar-h) + <own height>)` rather than a number recomputed in an effect — the module's
`ResizeObserver` watches its own bar and the frame, so a change in the VIEW BAR's height never woke it
(measured: 101 → 141 px, cover stayed 160 px, section headers off by 40 px).
Variants: `layout="fill"` (multi-pane modules whose side panel and list scroll separately),
`density="compact"` (Tasks/Shopping/Notes, whose deliberately dense 48 px toolbar must not gain a
second row of chrome), `breadcrumb` (back link above the title), `width="narrow"`, `scrollRef`
(virtualised lists), and `resource` — **reserved and inert**, so sharing, conflict dialogs and
presence avatars (rebuild phases 2 and 4) can be added without revisiting 21 modules.
Edge states go through `state` + `empty`/`error`/`noAccess` — never hand-drawn.
Enforced by `npm run check:ui-contract` (in `build`): a route directory without a manifest entry, or
a view rendering `ModuleView` without `state`, fails the build. Manifest: `src/lib/ui/view-contract.json`.

**Confirmations: never `window.confirm()`.** `ConfirmProvider` (mounted in `AppShell`) exposes a
promise-based `useConfirm()`, used as `if (!(await confirmDialog("Usunąć listę?"))) return;`.
**086 — the default button is NEUTRAL** („Potwierdź"); deleting is declared explicitly
(`{ title, destructive: true }`). Before that the default was „Usuń" and not one of the 54 call sites
passed options, so every confirmation in the app — including "mark all as read?" — closed with a red
"Delete". A red button that stands everywhere stops warning.
**087 — the footer clears the phone's gesture area**: on mobile `Modal` is a bottom sheet, so its
buttons sat on the iPhone home indicator; the footer's bottom padding now adds
`env(safe-area-inset-bottom)`, which fixes every dialog in the app at once.
The native dialog does not know the skin, labels its buttons in the SYSTEM language and blocks the
thread, so it cannot show *what* is about to be deleted. Outside the provider it degrades to
`window.confirm` rather than throwing, so a component used in isolation still works.

**Assistant prompts live in `src/lib/ai/agentPrompt.ts`** (035) — action catalog per module,
navigation catalog, `buildSystemPrompt()` and the module-router prompt. They were moved out of
`api/llm/home/agent/route.ts` because a route file cannot export anything but handlers, which made the
prompt impossible to import or measure. `scripts/check-action-coverage.js` reads the action catalog
from **that** file. See the report „Asystent — audyt zużycia tokenów" in `/reports`.
**036 — token economy.** `buildSystemPromptParts(modules, opts)` returns the prompt in two pieces:
`stable` (intro + protocol — the only part independent of the selected modules) and `variable`
(read-tool catalog + action catalog + rules). `buildSystemPrompt()` is the glued form and stays as the
proof that the split changes no content. The agent route passes both to `chatComplete` as
`ChatOptions.systemBlocks`, and `toAnthropicSystem` marks `cache_control: ephemeral` **only on the
stable block** — previously the whole (module-dependent) prompt was marked, so every call paid 1.25×
input for a cache write that essentially never hit. `SystemPromptOptions`: `includeActions:false`
drops the write-action + navigation catalogs (used for small talk and for pure reads — with a retry
path that re-runs with the full catalog if the agent returns `step:"plan"` anyway), `followups:false`
drops the follow-up request from the `answer` step. **Careful:** `buildReadToolsPrompt([])` treats an
empty module list as "give everything" — pass the primary module, not `[]`, when trimming the prompt.
`SMALL_TALK_RE` (`lib/ai/fastPath.ts`, anchored `^…$`) skips `classifyIntent` **and** `routeModules`
for a message that is nothing but a greeting.
**112 — 036 finished the split; 112 made it pay.** Two owner reports with opposite-looking symptoms
("why did this cost 30 groszy?" and "the assistant read 11 times and gave up") had **one cause**: the
system prompt is built ONCE before the agent loop and is byte-identical in every call, yet only the
~1276-token intro carried `cache_control` — so the 12–18k-token catalog was billed at full price in
each of six iterations (~67 % of the expensive turn). Both amounts, recomputed against `LlmModelPrice`,
were **arithmetically correct**: the pricing was never the bug, the usage was. Fixes: a **second cache
breakpoint** on the variable block, switched on from the **second** call in a run (a one-call turn must
not get 25 % more expensive) and **never** on the closing call (nothing reads it — that is how 11 860
tokens were thrown away); `effort: "none"` on both classification calls, because `applyEffort` raises
`max_tokens` from 120 to 7168 for extended thinking, so a declared output budget meant nothing
(measured: 1326 output tokens and 15 s to pick modules); a length guard before `classifyIntent`; and
`granicePolskie` replacing `\b`, which is **ASCII-only** in JS — every alternative ending in a Polish
letter (`pokaż`, `znajdź`, `sprawdź`, `oceń`, `wąż`) was silently dead, sending turns whose answer was
known in advance to the *paid* classifier and router. Read side: the per-tool record budget went 12 → 40
and the truncation notice now names the **`offset` to use** instead of saying "narrow your query" — an
instruction that was literally unexecutable (the cap lives in the context, not the query) and which the
model obeyed by slicing one project into six queries. The char safety-net now drops **whole records**
instead of `slice()`-ing the JSON mid-record. `list_tasks` gained `offset` and `includeDescription`.
When the step limit runs out the closing call asks the model to **finish the task** from what it has
(plan or full answer) plus an explicit list of gaps — never a summary of its own failure; with zero
successful reads the model is not called at all and 032's honest message stands. The report
`/reports/asystent-koszt-tury-rozbicie` (migration 0271) carries the arithmetic, because "is the amount
counted right?" will be asked again.

**The "magic icon" / AI assistant** (`home/AICommandSheet.tsx`): a global Sparkles
floating action button (bottom-right, in `AppShell`) opening a **conversational chat
sheet** — persistent message thread (user/assistant bubbles), free back-and-forth
dialog, history persisted in DB (`AiConversation`/`AiMessage`, per-user) with a
history drawer (rename/delete) + "new conversation", context-aware starter chips on
an empty thread, and voice dictation (reuses `SmartTextarea`'s Web Speech input).
The chat talks to the *agent* (`/api/llm/home/agent`), whose core loop `runAgentLoop`
runs a JSON-protocol tool loop and returns one of the steps **query / clarify /
answer / navigate / plan / report**. **Streaming**: with `stream:true` the route
returns SSE, emitting the agent's reasoning thoughts **live** (`onThought`) then a
`final` event; the client degrades to one-shot JSON if SSE is unavailable. It can
**read every module** (read-tools in `lib/ai/agentTools.ts` cover tasks, shopping,
notes, pets, storage, habits, health, medications, wallet, recipes, meal-plan,
pantry, vehicles, workshops, decks, news, weather, and an aggregated calendar) and
**search the web** (`web_search` → `lib/news/webSearch.ts`, Brave→DDG). It can
**create/edit/delete across all modules** — a typed `AIAction[]` (the `AIAction`
type lives in **`lib/ai/aiAction.ts`**) mapped to existing Server Actions in
`/api/llm/home/execute`, reviewed in `ActionDrawer` before running with
**destructive actions opt-in** (unchecked by default). **041 — auto-approve:** with
`AssistantPref.autoApprove` on, a plan whose actions are **all** non-destructive runs immediately and
shows its result, skipping the drawer; a single destructive action sends the whole plan to the drawer
as before. Classification comes solely from `DESTRUCTIVE_ACTION_TYPES` (`lib/ai/aiAction.ts`) — a
second list would be a silent gap the next time a deleting action is added. The toggle sits at the
bottom of the work-level menu above the composer, and while it is on the chat header carries a
permanent „auto" marker — the mode must never operate silently. Analytical results render as
markdown with clickable deep-links (internal → SPA nav, external → new tab) and
proactive **follow-up suggestion chips**; the agent can also propose a **report**
(full markdown with summary + facts) saved to `/reports` via `createUserReport`
(per-user, no admin needed). Chat UX: live "thinking", Stop/Copy/Regenerate/Retry,
Esc-to-close, autofocus, a11y (`role=dialog`/`aria-live`).
**106 — the assistant's shell: chrome, two conversation lists, and a docked mode.** Four owner
reports, all about the frame rather than what the assistant can do. (1) **The header splits into two
planes**: always visible are the name, the `auto` marker, new conversation, history, a **⋮ menu**, a
desktop-only dock toggle and close; under ⋮ go the current conversation's actions (save / rename /
delete), assistant settings, problem report and the admin-mode switch. The dividing rule comes
straight from 100, where a segmented switch *replaced* a ⋮: a menu says neither what is available nor
what is selected, so **only actions live under it — never a state indicator and never an exit**.
Header buttons are 44 × 44 (C-31); the `auto` chip drops to its icon below `sm` with the full text in
`title`/`aria-label`. (2) The **work-level menu moved onto `AnchoredLayer`** (080) — its hard-coded
`bottom: calc(100% + 6px)` meant "always upwards, without asking whether there is room", and
`position: absolute` was clipped by the sheet's own `overflow: hidden`; the portal + side flip +
window-derived `maxHeight` kill both causes at once. Menu contents moved unchanged. (3) **Two
conversation lists** — „Zapisane | Historia" as a `PrzelacznikSegmentowy` over the history drawer,
backed by one field (`AiConversation.saved`), so a conversation cannot land on both or vanish from
both. `listAiConversations` now issues **two disjoint queries**: the old single `take: 50` read "the
50 newest overall", so a conversation saved months ago was never in what reached the client —
filtering it there would have reproduced the exact fault the list exists to fix. Both segments pass
`wylaczona: false` explicitly, because the empty saved list holds the only explanation of how
something gets onto it. Deleting a conversation now goes through `confirmDialog({ destructive: true })`
(it used to delete silently — C-34). (4) **Docked mode on desktop** (`AssistantPref.presentation`,
`"window" | "content"`, `lg:` and up): the assistant fills the content area while the module
underneath is **covered, never `display: none` and never unmounted** — unmounting drops the module's
state, and `display: none` destroys the layout box and with it `scrollTop`. `AppShell` wraps `<main>`
in a `relative` container (which must never get `transform`/`filter`/`contain`, or `position: fixed`
would break for the window mode and the phone sheet) and marks the covered `<main>` `inert` +
`aria-hidden` **via a ref**, since React 18 does not know an `inert` prop. The URL never changes, so
the page context the assistant reads is available exactly as in window mode.

**Conversation lifecycle**: closing the sheet ends a conversation that has at least one
turn — reopening starts a fresh thread and the previous one is one tap away via a
"return to last conversation" button in the header (labelled with its first message);
an empty conversation is reused instead of littering history. Unsent composer text is
kept as a **draft on the conversation** (`AiConversation.draft`, saved on a 2 s debounce
plus explicitly on close/thread switch), so it comes back on any device. Expanded
sections (settings, problem report) collapse on thread switch/close. **Mobile keyboard**:
buttons under the composer use `onPointerDown` + `preventDefault` so the first tap fires
the action without dismissing the keyboard; send is the exception (single tap sends and
blurs). See `doświadczenia.md` for why.
*(The old `interpret` route and the duplicate `AICommandSection` widget were
removed; the assistant is agent + execute only.)*

**Morning briefing** (`/api/llm/home/briefing`): an on-demand, warm day-summary
(button on Home, client caches per-day) that reuses the calendar aggregate
(tasks/meals/health/fleet service) plus overdue tasks.

### Server Actions (`src/actions/`)

All data mutations use Next.js Server Actions with `revalidatePath()` at the end.
Never add manual cache invalidation elsewhere. Action files:
- **Shopping**: `items`, `lists`, `products`, `categories`, `units`, `stores`, `categoryIcons`
- **Tasks**: `tasks`, `taskProjects`, `taskTags`, `projectGroups` (project groups — shared multi-project view)
- **Notes**: `notes`, `noteGroups`, `tags`
- **Kitchen**: `recipes`, `cookbooks`, `mealPlans`, `pantry`
- **Pets**: `pets`, `petCare`, `petHusbandry`, `petBreeding`
- **Health**: `health`, `medications`
- **Other modules**: `habits`, `flota`, `portfel`, `portfelBudgets`, `portfelReports`, `portfelCurrency`, `portfelAuto` (Portfel: budgets/reports/multi-currency/auto-expense), `languageDecks`, `news` (incl. `startNewsRefresh`/`getNewsRefreshState` — the module-wide refresh job; `getStreamView`/`getStreamTimeline` — 083, news and timeline for ALL topics in one read each; `getTopicTimeline`; `hideHotTopic`/`unhideHotTopic`/`getHiddenTopics`; **`refreshTopic`, `getNewsRefreshHistory` and `setActiveSource` are gone** — the last two in 083: the history panel left the view, and the source filter moved to the URL, where a favouritable view can carry it), `userFacts` (knowledge about the user; `buildUserContext` lives in `lib/userContext.ts` — a helper, not an action), `weather` (incl. `getWeatherPref`/`setWatchersView` — 082 układ listy obserwatorów, `addLocationByPoint`, `getIdeas`/`generateIdeaDetail`/`getIdeaLibrary`/`setIdeaState`/`blockIdea`/`deleteIdea`/`addIdeaToTasks`), `qa`, `truck`, `storage` (Magazynowanie), `warsztat` (Warsztaty), `services` (marketplace; incl. `getModerationDisputes`), `calendar`, `contacts`
- **Collaboration / system / UX**: `teams`, `invitations`, `access` (incl. `getAuditLog`), `activity`, `reports` (incl. `createUserReport` — per-user reports for AI sessions), `config`, `llmConfig`, `adminCategories`, `adminNewsCatalog` (082: systemowa biblioteka źródeł RSS — CRUD, sprawdzenie kanału, import/eksport; strona użytkownika to `modules/news/actions/katalog.ts`), `aiConversations` (chat persistence), `notifications`, `menuPrefs` (sidebar customization), `dashboardPrefs` (home dashboard personalization), `skins`, `trash` (soft-delete recovery), `privacy` (GDPR: data export + account/data erasure;
  the deletion logic itself lives in `lib/privacy/purge.ts`, the recovery procedure in
  `docs/devops/przywrocenie-wlasnosci.md`), `systemHealth`, `drive` (Google Drive), `assistantPrefs` (per-user assistant settings incl. `autoApprove` + `getSpeechOptions`), `aiSections` (041: per-user AI-section refresh mode + admin system defaults), `feedback` (`submitFeedbackTask`/`getFeedbackInboxInfo` — the user-report inbox)

### Authentication & Authorization

- **NextAuth v5** with Google OAuth is the only supported sign-in method.
- Session includes `user.id`, `user.roles`, `user.permissions`.
- **RBAC**: Users have `UserRole` entries → roles have `RolePermission` entries → permissions have slugs.
- Check permissions via `src/lib/permissions.ts` (`PERMISSIONS` map, `hasPermission`, `permissionForPath`, `isPathLocked`).
- Permission slugs (`module.*`): `home`, `shopping`, `tasks`, `notes`, `kitchen`,
  `pets`, `health`, `habits`, `flota`, `portfel`, `languages`, `services`,
  `calendar`, `contacts`, `news`, `weather`, `magazynowanie`, `warsztaty`, `qa`,
  `truck`, `invitations`, `settings`, `admin`. Kitchen sub-permissions:
  `kitchen.recipe.create|edit|delete`, `kitchen.mealplan.edit`,
  `kitchen.pantry.edit`, `kitchen.ai`. (Reports is authenticated-only — no slug.)
- `ModuleSidebar` greys out + locks nav items the user lacks permission for (`isPathLocked`); admin nav appears only for admins.
- Special roles: `ADMIN` (full access), `BETA_TESTER` (shows Beta badge on Home).
- **Admin self-lockout guard**: `access.ts` `countAdminAccessHolders()` blocks any RBAC change that would leave 0 users with `module.admin`.
- Teams: users can own or be members of teams; most resources can be user- or team-scoped.

### Database Schema (key models)

```
User, Account, Session, VerificationToken     — Auth (NextAuth)
UserRole, Permission, RolePermission          — RBAC
Team, TeamMember, TeamInvitation              — Collaboration
Skin, UserSkinPref                            — Skins/themes (system/user/team; tokens=JSON CSS-var map; isPublic to share; UserSkinPref = per-user choice)
UserMenuPref                                  — Per-user sidebar/menu customization (order/disabled/tabBar = JSON string[] of module ids)
DashboardPref                                 — Per-user Home dashboard personalization (section order/visibility = JSON string[])
AssistantPref                                 — Per-user AI assistant settings (standing instructions, work level standard|economy|max, reader voice browser|server + voiceId, **`autoApprove`** = 041 auto-run of SAFE assistant actions; destructive ones always ask; **`presentation`** = 106 desktop presentation `window`|`content`, String+union — on a phone it is ignored, because a narrow screen has no content area to hand over)
Notification                                  — Notification engine (per-user; bell in chrome; reminders synced from agenda/deadlines)
AuditLog                                      — Audit trail for RBAC + config changes (category rbac|config; NO FK to User — snapshots actor email)
TrashItem                                     — Soft-delete recovery (JSON entity snapshot + retention days; surfaced at /trash)
DriveConnection, DriveFile                    — Google Drive integration (per-user OAuth drive.file tokens + uploaded-file registry; module folder map)
Contact                                       — Contacts / personal CRM (per-user; tags = JSON)
Workspace, WorkspaceMember                    — 051/079 (Faza 2, zadanie 9 i 11): PRZESTRZEŃ, w której żyje zasób (`kind` personal|team) — **jedyny nośnik własności** od migracji 0244. `Team`/`TeamMember` pozostają ŹRÓDŁEM przestrzeni (lustro utrzymywane w przód, `check:workspace-mirror`), ale odczyty i zapisy idą już wyłącznie przez `workspaceId`. `personalUserId`/`teamId` (oba nullable+unique) łączą przestrzeń ze źródłem: w PostgreSQL NULL-e w indeksie unikalnym są różne, więc jeden indeks daje niezmiennik „dokładnie jedna przestrzeń osobista na użytkownika". Kasowanie = kaskada FK
ResourceGrant, ResourceInvitation             — 051: nadanie dostępu do JEDNEGO zasobu + zaproszenie. **Tabele bez konsumenta do zadań 10/12** — świadomie, żeby nie robić dwóch migracji na tych samych tabelach. Nie kasować „w ramach porządków". Znane ograniczenie: `@@unique` nie łapie nadań linkowych (`subjectId: NULL`), poprawka w zadaniu 12
ShoppingList, Item, ItemHistory               — Shopping core
Product, Category, Unit, CategoryIconVariant  — Shopping config
Store, StoreNode, StoreEdge                   — Store maps (graph)
Note, NoteGroup, Tag, NoteTag                 — Notes module (wikilinks [[Title]] + full-text search; NoteGroup/Tag are owner-scoped — see "Dictionary Ownership Levels")
NoteRevision, NoteAttachment                  — Notes version history + attachments/images
TaskProject, TaskProjectMember, Task          — Tasks module
TaskTagDef, TaskTaskTag, TaskComment, TaskShare — Tasks extras
ProjectGroup (@@map "TaskView")               — Project groups (per-user; projectIds=JSON string[], many-to-many; optional color); folders in the project list + shared view /tasks/multi?group=<id>
Recipe, RecipeIngredient, RecipeStep, RecipeImage, RecipeTag, RecipeRating — Kitchen recipes
Cookbook, MealPlanEntry, PantryItem, ItemRecipeOrigin — Kitchen planning/pantry
Pet, PetShare, PetMeasurement, PetHealthRecord, PetVetVisit, PetTreatment — Pets core/care
PetCareTask, PetCareLog, PetEnclosure, PetEnvironmentReading — Pets husbandry
PetBreedingPair, PetClutch, PetSale           — Pets breeding/sales
HealthEvent                                   — Health module (visits/lab tests)
HealthAttachment                              — Health lab-test attachments (PDF/image) for the test repository + trend analysis
MedicationSchedule, MedicationLog             — Leki i pielęgnacja (med/care schedule + check-off log; kind MEDICATION|CARE, freqType DAILY|WEEKLY|HOURLY)
Habit, HabitEntry                             — Habits module (weekly goals; habit↔task integration)
Vehicle, FuelLog, ServiceRecord, VehicleProfile — Flota / Truck (VehicleProfile = ORS routing profile)
VehicleAttachment                             — Flota attachments (invoices, registration, insurance docs)
WalletElement, WalletEntry                    — Portfel (finance; WalletEntry has sourceModule/sourceId for auto-expense booking)
Budget, FinanceGoal, FinanceSettings          — Portfel budgets + savings goals + per-user finance settings
ExchangeRate                                  — Portfel multi-currency exchange rates (manual | nbp source)
LanguageDeck, Vocabulary                      — Languages (SRS)
NewsSource, NewsTopic, NewsItem, NewsPref          — Wiadomości (sources/topics/items; `NewsSource.descriptor` = 040: free-text source label replacing the old `leaning` left|center|right — colour derived from it via `lib/news/sourceColor.ts`; `NewsPref.lastFetchedAt` = last POOL fetch, shared by all topics)
NewsSourceCatalog                                  — 082: SYSTEMOWY katalog źródeł RSS (bez przestrzeni i bez właściciela — jak `Category` z `userId=null`): kraj/język/kategoria/opis + `checkStatus`/`checkedAt`/`checkNote` ze sprawdzenia kanału na żądanie. Dodanie do własnych źródeł KOPIUJE wpis do `NewsSource` (z jego `key`), więc wyłączenie martwego wpisu nie kasuje nikomu historii artykułów
NewsArticle, NewsTimelineEntry, NewsHiddenTopic    — 039: shared article pool (each source fetched ONCE per run), per-topic event timeline (unique [topicId, fingerprint]), rejected hot topics (keyed by title fingerprint)
UserFact                                           — 039: cross-cutting KNOWLEDGE ABOUT THE USER (category/confidence/origin/status; `rejected` stays in the table so inference never re-proposes it; `lib/userContext.ts` `buildUserContext` feeds it into prompts)
WeatherLocation, WeatherWatcher               — Pogoda (locations + alert watchers)
WeatherPref                                   — 082: per-user układ listy obserwatorów (`watchersLayout` status|grouped|manual, `watchersFilter`). Odpowiednik `NewsPref`; `workspaceId @unique` **bez** `@default(dbgenerated())` — na nowej tabeli nie ma czego wypełniać wstecz, a domyślnik czyniłby pole opcjonalnym w kliencie Prismy
WeatherIdea                                   — Pogoda „Co robić?" — proposals the user acted on (unique [ownerId, fingerprint]; state considered|saved|blocked; persistent `detail` plan + `detailUsage`; `seedDate`/`seedPart`/`seedWeather` = conditions at the moment the idea was proposed, so a lazily-generated plan describes THAT day)
AiContent                                     — 038: cross-cutting MEMORY of AI-generated content (unique [ownerId, kind, scopeKey]; `inputHash` = conditions it was generated under → drives the „nieaktualne" badge; `refreshes` counts explicit regenerations)
AiSectionPref                                 — 041: per-user REFRESH MODE of an AI section (unique [ownerId, sectionKind]; mode `onDemand|onChange|always`, String+union). System defaults live in `Config.ai_section_default_modes`, NOT in a NULL-owner row — in PostgreSQL `NULL != NULL`, so the unique index would not protect system rows
NewsRefreshRun                                — 041: durable history of Wiadomości refresh runs (counts + raw `usage`, retention 30). Cannot be read from `Job`: `cleanupOldJobs` deletes finished jobs after 24 h and `Job.result` only ever holds the last run
StorageItem, StorageMovement                  — Magazynowanie (items + movement log; item has barcode/unitPrice/photoUrl/expiresAt/warrantyUntil/supplierId)
StorageSettings, StorageSupplier, StorageBatch — Magazynowanie pro (Dom/Pro per-user; suppliers; batches/lots FEFO)
StorageDocument, StorageDocumentLine          — Magazynowanie pro (PZ/WZ/invoice documents + lines)
StoragePurchaseOrder, StoragePurchaseOrderLine — Magazynowanie pro (purchase orders to suppliers)
WarsztatSettings                              — Warsztaty (Dom/Pro per-user)
Workshop, WorkshopItem, WorkshopProject       — Warsztaty (workshop + equipment [kind/condition/min-stock/service] + Pro projects; suggestion catalog is static in src/lib/warsztat/catalog.ts)
ServiceCategory, ServiceProvider, ServiceListing — Usługi marketplace (categories; provider profile w/ verified flag + slug/tagline; listings)
ServiceRequest, ServiceReview, ServiceMessage — Usługi marketplace (requests w/ status workflow; reviews; in-app chat)
ServiceQuote, ServiceAvailability, ServiceImage — Usługi marketplace (quotes; availability/slot booking; portfolio images)
ServicePayment, ServiceDispute                — Usługi marketplace (payments/invoices → Portfel; disputes + admin moderation)
ServiceStaff, ServiceFavorite, ServicePromoCode — Usługi marketplace (multi-worker firms; favorite providers; promo codes)
QaEpic, QaUserStory, QaTestScenario           — QA module
LlmProvider, LlmAssignment                    — LLM config (admin; LlmAssignment PK = operationType+level)
UserLlmPref, LlmModelPrice                    — Per-user "custom" assistant level (model/effort/temperature per operation type, no maxTokens) + admin-editable model price list
AiConversation, AiMessage                     — AI assistant chat memory (per-user; message kind: text/plan/report/navigate/clarify/results; `AiConversation.draft` = unsent composer text, per conversation, so it returns on any device; **`saved`** = 106, the conversation sits on the „Zapisane" list instead of history — one field is the whole split, read by two disjoint queries)
Config, UserActivity, Report                  — System
```

**Important — no Prisma enums.** Statuses/kinds are `String` columns with a
TypeScript union type enforcing correctness at compile time (e.g.
`ItemStatus = "NEEDED" | "IN_CART" | "DONE" | "MISSING"`). The historical reason
was SQLite (which has no enums); the convention persists even though both prod and
dev are now PostgreSQL. **Never** convert these to Prisma enums.

### Ownership: a resource lives in a WORKSPACE (079 — task 11 closed)

**`ownerId`/`ownerTeamId` are gone from 40 tables** (migration 0244). A resource's owner is the
workspace it lives in: `Workspace.personalUserId` = a person's own space, `Workspace.teamId` = a
team's space. There is no second carrier — do not add one back.

```typescript
// WRITE — never spell out ownership by hand:
data: { ...(await wlasnoscDoZapisu(user.id, teamId)), name }   // team space or personal
data: { ...(await wlasnoscOsobistaDoZapisu(user.id)), name }   // tables with no team ownership

// READ, list scope — "everything I can see" (personal + my teams):
where: { ...(await ownedWhereAsync(user.id)) }
// READ, strictly mine — the exact successor of `ownerId = me`:
where: { ...(await filtrMoichRekordow(user.id)) }

// GUARD, one record:
await assertOwnership(record, userId);                                   // any of my spaces
(await getAccessibleWorkspaceIds(userId, "kitchen")).includes(rec.workspaceId); // + module access
await czyMojRekord(record, userId);                                      // strictly mine
```

Which one to pick is decided by **the condition you are replacing**, not by the table:
`ownerId = me` → `filtrMoichRekordow`/`czyMojRekord`; `getUserTeamIds` → `assertOwnership`;
`getAccessibleTeamIds` → `getAccessibleWorkspaceIds` (narrower — it drops teams where a household
member has that module switched off, `TeamMember.moduleAccess`). Substituting a **wider** variant is
forbidden: today every variant returns the same rows for an unrestricted account, so the mistake
would surface only on the first restricted one.

**Deleting an account or a team cascades through the workspace** — `workspaceId REFERENCES
Workspace(id) ON DELETE CASCADE` (migration 0243). That FK is what replaced the old
`owner → User (Cascade)`; it is also what lets a query say `workspace: { team: … }` (the "team
resource" badge in the UI) and `workspace: { personalUserId: … }` without a second round-trip.

**Five tables keep `ownerId`** — `ItemHistory`, `NoteGroup`, `Skin`, `Tag`, `Job`
(`src/lib/db/workspace-nullable.json`, gate `check:workspace-nullable`). Criterion: **a row may have
no owner at all** (a system dictionary entry, a system job), and a space expresses neither its
ownership nor its uniqueness — `UNIQUE(ownerId, name)` covers rows with `ownerId IS NULL`, and in
PostgreSQL `NULL <> NULL`. Their scope helper is `ownedOrSystemWhere`, their guard
`assertDictionaryAccess`. Do not "finish the migration" there.

Some entities add **per-entity sharing** with VIEWER/EDITOR roles on top of ownership (`TaskShare`,
`PetShare`) and per-resource membership (`TaskProjectMember`). Access to a single resource is
answered by `platform/sharing` (C-17), not by the module — `assertListAccess()`,
`assertNoteAccess()` and friends are thin wrappers that keep the old messages.

### Dictionary Ownership Levels

Three-tier system for categories, units, products:
- **System** — `userId=null, teamId=null` — managed by admin, visible to everyone
- **User** — `userId=userId, teamId=null` — owned by user
- **Team** — `userId=null, teamId=teamId` — owned by team, visible to all team members

`getCategories()`, `getUnits()` — return all three levels merged, with `isBase`, `isOwn`, `teamId` fields.

**034**: `NoteGroup`, `Tag` and `ItemHistory` follow the same idea via `ownerId`/`ownerTeamId`
(`ItemHistory` is user-only) — and this is exactly why 079 left those columns in place there. `NULL/NULL` = **system record**: readable by every signed-in user,
editable only by an admin (`assertDictionaryAccess`, `ownedOrSystemWhere` in `src/lib/server-utils.ts`).
Name uniqueness on `Tag`/`ItemHistory` is now **per owner** (`@@unique([ownerId, name])`) — a global
unique name would stop a second user from creating the same label. Migration 0212 backfilled every
pre-existing row to the admin account.

### LLM Integration

`src/lib/llm-client.ts` is a typed client wrapping the `/api/llm/*` routes.
Namespaces: `notes` (suggestTags/Title, rewrite, qa), `tasks` (parse, suggest,
suggestTitle, search), `shopping` (normalize), `stores` (generate), `kitchen`
(parseIngredients, importFromUrl, suggestFromPantry, categorize, ocrImage, ocrText,
generateRecipe, planWeek), `languages` (extract), `magazynowanie` (scan, enrich,
document, orderDraft, insights, search), `pets` (insights).
- The **home assistant is not part of the typed client** — it is called as raw
  routes: `/api/llm/home/agent` (SSE agent loop), `/api/llm/home/execute` (runs the
  typed `AIAction[]`), `/api/llm/home/briefing` (daily summary).
- Provider + model routing is **DB-driven** via `/admin/llm` (`LlmProvider` +
  `LlmAssignment`), resolved per **operation type** in `src/lib/llm/resolver.ts`.
  The operation types (`src/lib/llm/operationTypes.ts`) are: **`dispatch`** (fast
  parsing/classification), **`reasoning`** (multi-step: home agent, week planning,
  semantic search, Q&A, store layout), **`vision`** (image OCR), **`generation`**
  (longer text: note rewrite, recipe/vocabulary generation) and **`speech`**
  (server-side text-to-speech for the assistant's reader — **no default model**, so an
  unassigned `speech` simply disables the feature and the client falls back to browser
  voices; `src/lib/tts/{serverTts,serverVoices,catalog,adapters}.ts` + `/api/tts`).
  **TTS provider catalog** (`src/lib/tts/catalog.ts`): a static dictionary of known speech
  providers (OpenAI, Groq PlayAI, ElevenLabs, Google Cloud TTS, Azure Speech) with models,
  voices, cost/free hints, whether an API key is needed and **how good their Polish is** — it
  drives the dropdowns in `/admin/llm`, so the admin never types a model name from memory.
  Per-provider request/response differences live in **one** `switch` in
  `src/lib/tts/adapters.ts` (`buildSpeechRequest`/`parseSpeechResponse`; Google returns
  base64 in JSON, Azure takes SSML). `LlmProvider.kind` therefore accepts `openai_compat |
  anthropic | elevenlabs | google_tts | azure_tts` (still `String` + TS union — no Prisma
  enum); the last three are **speech-only** and are blocked from non-`speech` operation types
  in **both** `setAssignment` and `resolveLlmChain`, because `chatComplete` branches only on
  `anthropic` vs the rest and would POST a chat prompt to a TTS endpoint. The admin's default
  voice lives in `Config.speech_default_voice`; a user's saved voice that the configured
  provider doesn't know degrades to that provider's default instead of erroring.
  Each assignment also carries **effort / temperature / max-tokens** (`LlmAssignment.effort` —
  `LlmEffort = none|low|medium|high`). Effort is **one shared descriptive scale** translated to the
  provider's own parameter in `src/lib/llm/effort.ts` (Anthropic → extended-thinking
  `budget_tokens`, and `max_tokens` is raised above it because the provider requires it;
  OpenAI-compatible *reasoning* families → `reasoning_effort`; anything else → **parameter omitted**,
  and `/admin/llm` says so). A 400 rejecting the effort parameter triggers **one** retry without it
  (400 is non-retryable, so it would otherwise break the fallback chain). `AiCall.effort` records
  the level actually used. Anthropic still never receives `temperature` (see `doświadczenia.md`
  2026, 026-anthropic-temperature-fix).
  **Assistant work levels (034)**: `LlmAssignment` is keyed by **(`operationType`, `level`)** —
  the admin configures *all three* levels (`economy`/`standard`/`max`) per operation type in
  `/admin/llm`; a field left empty **inherits from `standard`**. The per-user `AssistantPref.level`
  adds a fourth option, **`custom`**, backed by `UserLlmPref` (model from the admin's catalog +
  effort + temperature per operation type; **never** `maxTokens`). `resolveLlmChain(op, {level,
  userId})` composes it all; a provider the user picked that was later removed/disabled degrades
  silently to `standard`. The old in-code rules (`effectiveOperation`, `shouldBoostEffort`,
  `boostEffort`) are **gone** — migration 0212 seeded the equivalent rows so behaviour is unchanged
  but now visible and editable. Default provider is Groq (OpenAI-compatible); key in `Config`
  (`groq_api_key`) / env.
  Shared helpers: `src/lib/llm/chat.ts` (`chatComplete`), `src/lib/llm/json.ts`.
  **Cost accounting (034)**: model prices live in the DB (`LlmModelPrice`, edited in `/admin/llm`),
  loaded into a 60 s module cache by `ensurePricesLoaded()` (called from `chatComplete`/`chatStream`);
  `src/lib/llm/pricing.ts` `estimateCost()` returns `{usd, known, parts}` split into input / output /
  cache-write / cache-read. An unpriced model is reported as **„koszt nieznany"**, never as 0. The
  **083 — cost leaves the content.** `AiCostBadge` takes a **required** `akcja` prop (the Polish name of
  the user's BUSINESS action, e.g. „Streszczenie wiadomości") and now does two separate things: it
  **always reports** the cost to `platform/ai/kosztBus`, and it **draws only** when the admin's toggle
  (`PrzelacznikKosztow`, per-browser `localStorage` key `omnia.pokazKoszty`, `platform/ai/kosztWidocznosc`)
  is on — so a cost indicator no longer takes space next to every generated block. Every report surfaces
  as an ephemeral top-right toast (`components/ui/KosztToasts.tsx`, 6 s, max 3, repeats merged into ×N,
  nothing persisted). The prop is required on purpose: a default would silently label half of 26 call
  sites „unknown action", which is the opposite of what it exists for.
  cost UI is the shared, assistant-agnostic `src/components/ui/AiCostBadge.tsx` (ready for other
  modules). Effort and temperature do **not** change the per-token price — effort raises the *number*
  of output tokens, which the estimate already counts.
- Rule-based fallback for categorization (no LLM): `categorize.ts` (~500 Polish+English keywords).
- LLM prompts treat category names as **Polish words** (not English); category hints injected from DB-driven categories.
- **External integrations** (mostly key-free / cheap): `lib/weather/openMeteo.ts`
  (weather), `lib/news/{rss,webSearch,article,sources}.ts` (news + Brave/DDG search),
  `lib/ors.ts` (OpenRouteService truck routing), `lib/overpass.ts` (OSM POI),
  `lib/googleMaps.ts` (geocoding/places), `lib/groqVision.ts` (vision OCR).

### Store Maps

Stores are graph structures: `Store` → `StoreNode[]` (positions) + `StoreEdge[]`
(connections with weights). `src/lib/storeLayout.ts` handles layout algorithms,
`src/lib/storeRoute.ts` handles optimal routing.

### Notifications & menu customization

- **Notifications** (`actions/notifications.ts`, `lib/notifications.ts`, model
  `Notification`): per-user notifications surfaced via a **bell in the chrome**
  (sidebar bottom + mobile top bar) — *not* a floating button. `notifyUser` creates
  one; `getUnreadCount`/`getNotifications`/`markNotificationRead`/
  `markAllNotificationsRead` drive the UI; `syncReminders` derives reminders from
  the agenda/deadlines.
- **Menu customization** (`actions/menuPrefs.ts`, model `UserMenuPref`): each user
  can reorder modules, hide modules (collapsed under "Więcej…"/More, re-enableable),
  and customize the mobile bottom tab bar. `ModuleSidebar` renders only accessible +
  enabled modules in the user's order.
- The **admin "point-at-element" feedback mode** starts from the admin panel's tool list
  (`admin/SpisNarzedziAdmina.tsx` → `startFeedbackInspector`, event bus `lib/ai/feedbackBus.ts`;
  also Ctrl+Shift+B and the admin button in the mobile top bar) and is drawn by
  `shell/FeedbackInspector.tsx`, z-index-coordinated to sit *above* content modals (so you can
  report an element inside a modal). See `doświadczenia.md` 2026-06-08 for the modal/FAB layering
  rules. **110 deleted the separate `FeedbackTriggerButton.tsx`** — it had exactly one consumer
  (the old flat tool list) and rewriting that list would have left it without any.

### Cross-cutting systems

- **Job queue with progress** (`Job`, `lib/jobs/*`, `/admin/jobs`): handlers are registered in
  `JOB_HANDLERS` (that map is also the allowlist of what a client may enqueue). Multi-stage handlers
  report their stage through `ctx.progress(text)` → **`Job.progress`** (039), so a UI reading it back
  from the queue survives a page reload; `completeJob` clears it. Types include `news.refresh`
  (whole Wiadomości module: pool → classify → summarise → timeline) and `user.facts` (infer
  knowledge about the user from their own actions).

- **Soft-delete / Trash** (`TrashItem`, `lib/trash.ts`, `actions/trash.ts`,
  `/trash`): deletes across modules write a JSON snapshot to `TrashItem` with a
  retention-day countdown; users restore from a unified `/trash` page
  (authenticated-only, no permission slug).
- **Audit log** (`AuditLog`, `lib/audit.ts`, `access.ts` `getAuditLog`,
  `/admin/audit`): every RBAC/config change is logged with `category` `rbac|config`.
  `AuditLog` has **no FK to User** — it snapshots the actor's email so history
  survives user deletion.
- **System health** (`actions/systemHealth.ts` `getSystemHealth`, `/admin/health`):
  live DB/migrations/API diagnostics — there is **no** persisted model, it's computed.
- **API-key encryption** (`lib/crypto/secrets.ts`): provider/API keys are encrypted
  at rest and **masked** in `/admin/config` and `/admin/llm`.
- **Google Drive integration** (`lib/drive/{client,oauth}.ts`, `actions/drive.ts`,
  API `/api/drive/{connect,callback,upload,file/[fileId]}`): per-user OAuth
  (`drive.file` scope) with an "Omnia" folder + per-module subfolders and a
  `DriveFile` registry. **Reports** can store content on Drive
  (`Report.storage` = `db|drive`, hydrated transparently on read); falls back to DB
  when no Drive account is connected.
- **Knowledge about the user** (`UserFact`, `actions/userFacts.ts`, `lib/userFacts.ts` types,
  `lib/userContext.ts`): facts inferred from the user's OWN actions (saved/blocked weather ideas,
  monitored topics, rejected hot topics) by the `user.facts` job, shown in full at
  `/settings` ("Co system o Tobie wie") and at `/admin/user-facts`. Any module that generates
  content for the user calls `buildUserContext(userId)` — confidence reaches the prompt as a WORD
  ("przypuszczenie"/"potwierdzone"), no facts returns an empty string (never an error), and
  `userContextStamp(userId)` goes into `hashInputs` so changing a fact marks remembered content
  stale. A **rejected fact is never deleted** (`status: "rejected"`) — deleting the row would let
  inference re-derive and re-propose it; rejected facts are fed back as "don't assume this".
  `origin: "admin"` is never overwritten by inference.
- **Home dashboard personalization** (`DashboardPref`, `actions/dashboardPrefs.ts`):
  per-user section order/visibility on the Home dashboard.

- **Admin mode** (`platform/admin/trybAdmina.tsx`, `PrzelacznikTrybuAdmina`, browser key
  `omnia.trybAdmina`) — 085. One switch hides **everything an admin alone sees inside ordinary
  views**: the AI cost badge, the cost toasts, the floating bug-report button (**and its
  `Ctrl+Shift+B` shortcut** — a hidden tool that still fires reads as a defect), and the admin
  task-list clipboard export. With it off, an admin sees the app exactly as a user does. The switch
  itself and the `/admin` navigation are deliberately exempt, or there would be no way back. Its
  availability is plain `isAdmin`, **not** `isAdmin && ai_cost_badge_enabled` as the 083 predecessor
  had it: turning the cost system switch off must not also take away the ability to hide everything
  else. Whether cost data reaches the wire at all is still the server's call (`visibleUsage`).

- **Shared rate limit** (`platform/rateLimit`, `RateLimitBucket` + `RateLimitLease`, migration 0247) —
  081. Counters live in the DB, not in a process `Map`: with two instances every user used to get
  twice the limit. Windows are one atomic `INSERT … ON CONFLICT DO UPDATE` that also **moves the
  window inside the DB** — if the code decided "has the window expired", two instances would reset the
  same row twice. Concurrency is **not a counter but LEASES**: `PRIMARY KEY (key, slot)` makes taking
  a slot a single atomic row-level upsert guarded by `WHERE expiresAt <= now()`, and `holder` stops a
  late `finally` from releasing someone else's lease. A counter would never be decremented after a
  process crash, locking the user out forever. Policies (`ai.agent`, `ai.mowa`, `zaproszenia`,
  `nadania`) are pure data in `polityki.ts`; the functions are **async** — that is the one part of the
  old interface that could not be kept, because a synchronous signature would need a local cache, i.e.
  a second carrier of the same state.

- **AI budgets** (`platform/ai/budzet.ts`, `Config` keys `ai_globally_disabled`,
  `ai_monthly_budget_usd`, `ai_monthly_budget_hard`) — 082. The emergency switch is checked
  **unconditionally** in `chatComplete`/`chatStream`: the old per-user budget only ran when
  `opts.userId` was set, so background jobs — the most expensive operations in the system — bypassed
  cost control entirely. `plan.aiMonthlyTokens` adds the monthly ceiling (a daily limit cannot express
  "not thirty heavy days in a row"). Alarm thresholds 50/80/**100 %**, deduplicated per (month,
  threshold). "Used X of Y" is shown to the user in `/settings` — a limit nobody can see is first met
  as a refusal, and then it looks like a failure.

- **Data retention** (`platform/retention`, policies in `src/lib/retention/polityki.ts` and per-module
  `retention.ts`, config in `/admin/config`) — 083. Each policy carries its own delete query, so the
  platform executor knows no table and a module declares retention for its own data. `DomainEvent` is
  pruned **only when delivered** (an undelivered event is work, not garbage), `AiUsage` is exempt (the
  budgets stand on it), `ItemHistory` counts **last use**, not creation date. The audit-log floor is
  enforced **on read**, not in the form — a `Config` row can be changed from `psql`. The daily run
  **claims the right atomically** with a conditional `UPDATE`; the read-compare-write variant let 5 of
  5 parallel instances through (measured).

- **Aggregate cache** (`platform/cache/stempel.ts`, `src/lib/cacheAgregatow.ts`) — 085. The dashboard
  snapshot and the calendar agenda are cached with the **workspace stamp in the key** rather than
  invalidated by `revalidateTag`: a tag only invalidates the cache of ONE instance. The stamp carries a
  timestamp **and a count** — `createdAt` has millisecond precision, so two events written together
  would produce the same stamp and the second would be invisible. The dashboard key also carries a
  **permission fingerprint**; without it, revoking module access would leave that module's data in the
  cache. Access decisions and the workspace list are deliberately **not** cached across requests
  (ch. 11.1.3) — the per-request (052) and per-operation (084) scopes vanish with the work, so there
  is nothing to invalidate.

- **Structured logs and metrics** (`platform/observability/{log,metryki}.ts`, `OperationMetric`,
  migration 0248) — 086/087. Log context is injected once at the entry point and merges when nested;
  values pass through `oczysc` (PII). Metrics are an **hourly aggregate with a histogram**, counted in
  memory and flushed in bulk by the worker: a row per operation would double the writes, and p95 cannot
  be reconstructed from a sum. **Edit conflicts per module** are counted separately from errors — a
  conflict is not a failure, and a module with a rising conflict count is the signal for co-editing
  (ch. 8.6). Known gap, recorded rather than hidden: Server Action latency per module is **not**
  covered — Next 14 offers no hook around actions.

- **Process roles** (`platform/runtime/rola.ts`, `OMNIA_ROLE`) — 088. One image, three roles
  (`web`/`worker`/`cron`, default **`all`**). The default matters: with `web` as the default, deploying
  that change alone would have stopped the queue and retention — no error, no log, just silence. An
  unrecognised value also falls back to `all` **and is reported**. The worker wakes up on
  **`/api/health`**, the only request the host sends by itself, so the `worker` service must have its
  health check enabled (`docs/devops/rozdzielenie-procesow.md`).

- **Sharing, write side** (`src/lib/sharingGrants.ts`, `components/sharing/ShareDialog.tsx`,
  `ResourceGrant.token`, migration 0250) — 090. The right to share is **platform-level**
  (`requireShareAccess`, role `manager`), not a module-declared operation: a module that forgot such an
  operation would give sharing rights either to nobody or to everybody, both silently. Three outcomes
  are shown separately because they mean three different things to the user (immediate grant / pending
  invitation for an address without an account / link that must be copied). Grants emit
  `sharing.grant.granted|revoked` **in the same transaction** — the missing producer the access cache
  was waiting for.
  **095 — the dialog finally reached the resources the control question names.** `ShareDialog` is
  fully generic (it takes only `resourceType` + `resourceId`), but until 095 it hung in **one** place,
  the Tasks header — so "share a note, a shopping list and a recipe with the same window" was false
  for all three. Shopping and Kitchen had declarations since 064 and no entry point; Notes had no
  declaration at all (`notes.note`, added here, brings the classification to 5 declarations across
  21 modules). A grant also needs somewhere to *land*: `platform/sharing/nadaneMi.ts`
  `idZasobowNadanychMi(userId, resourceType, ctx)` is the inverse of `resolveRole` — "**which**
  resources of this type were shared with me" — and the Notes list query unions it in, because the
  module has no per-resource route, so a grant would otherwise be real and invisible. It deliberately
  skips link grants (a link grants whoever holds it, so listing that resource would show it to someone
  who never received the link) and inherited ones (they surface through the parent).
  Mirror-derived grants (059/061) cannot be revoked here: deleting the reflection
  would come back on the next sync, and the user would see access that "returned by itself".

### Admin Panel (`/admin`, gated by `module.admin`)

- **`/admin`** — **a grouped, searchable launcher** (110): every panel route as a named card with a
  one-line description, split into seven groups (Przegląd · Dostęp i bezpieczeństwo · Diagnostyka ·
  AI i konfiguracja · Treść i wygląd · Dokumentacja projektu · Narzędzia dewelopera), with one search
  box above them. The registry `src/lib/admin/narzedzia.ts` feeds the list, the search and the
  **`check:admin-links` gate**, which fails the build when a route under `src/app/admin/` has no
  entry (or an entry points at a route that does not exist). That gate exists because the hand-kept
  list had already drifted: `/admin/llm` — LLM providers and model assignment — was linked from
  **nowhere** in the app. Build info, the eleven counters and the active session moved to
  **`/admin/przeglad`**, so entering the panel no longer runs eleven counting queries. (The Omnia→Claude Code clipboard export is an **admin-only per-list button** in the Tasks header — `TaskListClipboardButton`, prompt+copy logic in `src/lib/omniaClipboard.ts` — copying a prompt + JSON of *that list's* active tasks. The prompt now **kicks off the spec-driven pipeline**: pasted into Claude Code it instructs it to run `/specify` with those task titles/descriptions as the feature scope, then the pipeline auto-advances plan→tasks→implement→verify→review.)
- **`/admin/access`** — RBAC manager (`PermissionManager`): permissions, role↔permission grid, user↔role; self-lockout guard.
- **`/admin/audit`** — audit log viewer (RBAC + config changes; `AuditLog`).
- **`/admin/health`** — system health dashboard (DB/migrations/API diagnostics; live, no model).
- **`/admin/config`** — key-value `Config` (e.g. `groq_api_key`, `brave_search_api_key`, masked + encrypted at rest; plus the plain-text `feedback_project_id` — which task project acts as the **user-report inbox**; empty = the admin's „Omnia" project).
- **`/admin/llm`** — `LlmProvider` (groq/anthropic/openai) + `LlmAssignment` (model per operation type **+ effort / temperature / max-tokens**; the panel states outright which knobs the chosen provider/model ignores). Also the **follow-up switch** (036): `Config.assistant_followups_enabled` (`1`/`0`, seeded by migration 0214, missing row = on) decides whether the agent prompt asks for follow-up suggestion chips at all — they cost tokens on *every* answer. Read without a session via `lib/ai/followups.ts` `readFollowupsEnabled()`; admin side is `actions/llmConfig.ts` `getFollowupsEnabled`/`setFollowupsEnabled` (audited). Also the **AI cost badge switch** (037): `Config.ai_cost_badge_enabled` (`1`/`0`, seeded by migration 0215, missing row = on) decides whether the cost indicator shows anywhere in the app. Read without a session via `lib/ai/costVisibility.ts` `readCostBadgeEnabled()`; admin side is `getCostBadgeEnabled`/`setCostBadgeEnabled` (audited). Also the **default AI-section refresh modes** (041): `Config.ai_section_default_modes` (JSON `{kind: onDemand|onChange|always}`, seeded by migration 0220) — the fallback for users who never picked their own mode; a user's own choice lives in `AiSectionPref` and is never overwritten from here (two disjoint writes). Admin side is `actions/aiSections.ts` `getDefaultSectionModes`/`setDefaultSectionModes` (audited).
- **`/admin/ai-coverage`** — **Pokrycie akcji przez AI**: pełna lista akcji użytkownika (mutacje **i** odczyty z `src/actions/*`) z informacją, czy asystent AI ma do nich dostęp (`ai`/`pending`/`excluded`+powód). Źródło = manifest `src/lib/ai/action-coverage.json` (via `getAiCoverage()` w `src/lib/ai/coverage.ts`), którego kompletność wymusza bramka `scripts/check-ai-coverage.js` (wpięta w `build`) — więc lista jest **zawsze aktualna** wobec wdrożonego kodu. Nowa mutująca/odczytowa Server Action bez wpisu w manifeście = build pada. Filtry po statusie/rodzaju + wyszukiwarka.
- **`/admin/skins`** — system skins manager.
- **`/admin/categories`** — global system categories (name/color/icon).
- **`/admin/reports`** — markdown reports CRUD.
- **`/admin/docs`** — in-app docs browser; `scripts/copy-docs.js` copies `docs/` into the bundle at build.
- **`/admin/audyt`** — **Analiza/Audyt stanu projektu + wskazania**: admin-only multi-chapter "book" (deep project audit as a two-team debate + numbered `Z-NNN` recommendations + per-area implementation plans + a ready Claude-Code prompt). Source = `content/audyt/*.md` + `manifest.json`, baked by `scripts/copy-audyt.js` → `src/generated/audyt-book.ts` (wired into `build`), rendered via `markdownToHtml` in `AudytBookReader` (TOC, prev/next, progress, dark/light/sepia). Chapter status is derived from file presence (add a `.md` → it shows as done). Extend it across sessions; never store this in the DB.
- **`/admin/audyt-podsumowanie`** — **Audyt — podsumowanie zmian**: admin-only 2-chapter book ("Co zostało wykonane" / "Co pozostało na przyszłość") — a self-contained working base for resuming post-audit work without opening the old audit or other reports. Source = `content/audyt-podsumowanie/*.md` + `manifest.json`, baked by `scripts/copy-audyt-podsumowanie.js` → `src/generated/audyt-podsumowanie-book.ts` (wired into `build`), rendered via the same `AudytBookReader` (`basePath="/admin/audyt-podsumowanie"`). Keep it updated as post-audit work progresses.
- **`/admin/spec-pipeline`** — **Spec-Driven Pipeline (przewodnik)**: admin-only guide to how new Omnia features are built with Claude Code as a spec-driven pipeline (`/specify → /plan → /tasks → /implement → /verify → /review`), modeled on **GitHub Spec Kit** and adapted to Omnia. The pipeline itself lives in `.claude/` (repo root): `commands/*.md` (6 slash commands), `agents/*.md` (`omnia-planner`/`omnia-implementer`/`omnia-reviewer` subagents), and `spec-pipeline/` (the `constitution.md` of hard rules `C-NN`, the `README.md` guide, and `spec/plan/tasks` templates). **Interaction model:** the whole run is kicked off by a **single** `/specify` command; the owner is asked questions **only once** (up front, via one `AskUserQuestion` with the recommended option first and marked `(zalecane)`), and every later stage **auto-advances** (invokes the next stage's skill) through to the `develop` merge without further commands — Spec Kit's `/clarify` step is folded into that single `/specify` question moment. `/review` reaches its own verdict **without the owner's approval** and, on APPROVE, auto-merges to `develop`; a narrow escape hatch (`C-55`) lets a later stage ask one batched question only for a genuinely material/unforeseeable decision, and stages keep the `spec→plan→tasks→code` artifacts consistent, backtracking to fix the right file when a later finding invalidates an earlier one (`C-54`). The run ends with **no closing question**: promotion `develop → master` (production) at the very end is **pre-authorized** by the owner and performed **automatically** after the `develop` push — only on APPROVE + green build and after an integrity check (never rewinds production; on a failed check or a rejected `master` push the pipeline stops and reports instead of forcing `master`) (`C-52`). Feature artifacts land in `specs/<NNN-slug>/`. Guide + constitution are baked by `scripts/copy-spec-pipeline.js` → `src/generated/spec-pipeline.ts` (wired into `build`) and rendered via `AdminDocsViewer`. Keep `constitution.md` in sync when CLAUDE.md conventions change.
- **`/admin/playground`** — **component gallery** (045, rewritten): categories (Prymitywy / Formularze / Dane i listy / Powłoka / Stany brzegowe / Wzorce widoku), side nav on desktop and a drawer on mobile, search, live prop controls, edge-case variants and a **local skin switcher** that restyles only the demo area — so you can check a skin does not break a component *before* enabling it. The list is derived from `src/lib/ui/playground/registry.tsx`, so a component added to the registry shows up by itself.
- **`/admin/architecture`** — app-structure overview (currently minimal; the full architecture lives in a system report).
- **`/admin/e2e`** + **`/admin/qa`** — Playwright run guide; QA scenario authoring.

### Key Conventions

**Path alias**: `@/*` resolves to `./src/*`. Use in all imports.

**Dark theme CSS variables** (defined in `src/app/globals.css`):
```
--bg-base: #0d0d0d      --bg-surface: #1a1a1a
--bg-elevated: #242424   --bg-hover: #2f2f2f
--border: #333333        --text-primary: #ffffff
--text-secondary: #b0b0b0  --text-muted: #808080
```
Accent tokens: `accent-blue`, `accent-green`, `accent-red`, `accent-amber`, `accent-purple`.

**Skins / themes**: the user picks a skin in `Settings → Appearance` (`SkinPicker`);
admin manages system skins at `/admin/skins`. A skin is a **partial map of CSS
variables** (`Skin.tokens` JSON) applied **inline on `<html>`** in `layout.tsx`
(`readActiveSkin` → `tokensToStyle`), so it overrides `:root` from `globals.css`
without FOUC; omitted variables inherit the default (dark) values, and the "Dark"
skin = `{}`. The list of controllable variables, editor controls, and **validation**
(`sanitizeTokenValue` — whitelist + regex, CSS-injection guard) live in
`src/lib/skins.ts`. **045 — a skin is no longer a colour map.** Nine token families:
colours, typography (`--font-family-*`, weight, tracking, `--text-transform-heading`,
line-height), density/spacing, radii, borders, shadows and glows, background (CSS gradients),
motion (`--motion-duration`, `--motion-easing`) and shell chrome (`--chrome-bg`,
`--chrome-frame`). **No schema change was needed** — `Skin.tokens` is JSON.
Three rules that are easy to break:
- **`--font-family-*` is a KEYWORD from a closed list** (`system|mono|serif|condensed|rounded`),
  never a free font stack: quotes and commas are legal inside `font-family`, so any sanitising rule
  comes out either leaky or useless — and system stacks issue no network request.
- **`sanitizeTokenValue` uses per-kind function whitelists**, it does NOT relax the global block to
  let gradients through: `linear-gradient(` passes, `url(`, `paint(`, `element(`, `attr(` do not.
  This matters because a skin can now be **imported from a file** or **generated by a model** —
  both are foreign input and go through the same validation.
- **`--on-accent` instead of `#fff`** on coloured buttons. White on saturated amber is ~1.9:1.
9 system skins seeded by migration: Dark/Light/Casual/Blue/Pink + the four flagships
**Mostek / Papier / Terminal / Zen** (`src/lib/skins/flagship.ts`, migrations 0224/0225).
Their contrast is **computed in tests** (`skinContrast.test.ts`), not eyeballed: body text ≥ 7:1,
secondary/muted ≥ 4.5:1, text on **each** of six accents ≥ 4.5:1, visible borders and focus ring,
no animation over 300 ms. A styled skin is **never** the default.
**AI skin generation**: describe a theme in words → `/api/llm/skins/generate`
(`lib/jobs/handlers/skinGenerate.ts`, op `generation`). The token catalogue in the prompt is
**generated from `ALL_CONTROLS`**, not hand-copied, so it cannot drift. The model **proposes, never
saves**; its output passes the same `validateTokens` as an imported file, and rejected keys are
shown, not silently dropped. Export/import: `exportSkin`/`importSkin`, versioned `omniaSkin: 1`.
Models: `Skin` (system/user/team, `isPublic` to share), `UserSkinPref` (per-user choice); actions
in `src/actions/skins.ts`.

**Mobile responsiveness**: The desktop `ModuleSidebar` is `hidden md:flex`. Mobile
(`md:hidden`) gets a **top bar** (active module + hamburger + notification bell), a
full-screen **overlay menu**, and a fixed **bottom tab bar** (user-customizable via
`UserMenuPref`). All respect `env(safe-area-inset-bottom)`. Minimum touch targets:
`py-3`, 20×20px checkboxes. Register new modules in `ModuleSidebar` (and the menu
defaults / tab bar if they belong there).

**100 — the bottom bar is a THUMB bar, and the magic icon has one permanent place.**
`PasekKciuka` (`components/shell/`) replaced the inline `<nav>` of equal slots. Three rules:
- **The assistant's Sparkles icon sits dead-centre, raised above the bar's top edge, and that is its
  only place on a phone** — the floating corner FAB now exists from `md:` up only
  (`.omnia-fab-asystent`; `display` is set by the class, never inline, or the inline style would win
  over the rule that hides it). The centre is deliberately **neutral to handedness**: the one element
  you must never hunt for does not move when the setting flips.
- **Handedness** (`UserMenuPref.handedness`, `"right" | "left"`, migration 0260, default `right`)
  mirrors the bar's item order and puts the favourites star, the bug FAB and the desktop Sparkles FAB
  on the dominant side. It travels by **two channels from one read**: `data-reka` on `<html>` (set
  server-side in `layout.tsx`, so pure-CSS mirroring — `.omnia-plywajacy`, `.omnia-chrom-konta` — has
  no FOUC) and `menuPrefs` into `AppShell` where JS is needed. It lives on `UserMenuPref` because the
  shell already reads that table on every page — the same argument 080 used for `favoritesCollapsed`.
  Items nearer the thumb get more width and a bigger icon; the difference is always in the **excess**
  — every item still holds 44×44 px (C-31).
- **Press-and-hold navigation** (`WachlarzNawigacji`): hold ~350 ms → an arc of hints bowed toward the
  dominant hand → drag → release to go there; dwell ~400 ms on a module opens its **saved views** as a
  second arc, without lifting the finger. Level 1 is **always the same list** (all accessible modules)
  whichever item you hold — a fan that depended on the start point would make you remember what hides
  where, i.e. the very fault this run removed from News. It feeds on `resolveMenu` and `favoriteViews`
  passed as parameters — **no new parallel module list**, and `MobileModuleSubNav`'s `if (id === …)`
  chain is deliberately left untouched (C-36). The pointer is captured **only when the fan opens**, not
  on `pointerdown`, or the browser would lose scrolling. The provider wraps the whole shell (triggers
  live in both the bar and the sidebar) and therefore **cannot** be `dynamic(ssr:false)`.
  A short tap still navigates: the bar's buttons push imperatively, the sidebar's `<Link>` keeps its
  own click and the fan swallows the click that would otherwise fire a **second** navigation.

**Keyboard shortcuts** (`src/hooks/useKeyboardShortcuts.ts`): `j/k` navigate,
`x/Space` cycle status, `e` edit, `d/Delete` delete, `a/n` add, `//f` search,
`1–5` filter tabs, `Ctrl+K` command palette, `Esc` close.

**Smart parsing** (`parseQuantity.ts`): `"2 butelki mleka"` → `{qty:2, unit:"butelki", name:"mleka"}`, `"mleko 500ml"` → `{qty:500, unit:"ml", name:"mleko"}`, `"mleko x2"` → `{qty:2, name:"mleko"}`.

**Recurrence** (`src/lib/recurrence.ts`): shared recurring-event logic for tasks, habits, pet treatments, and medication schedules. **SRS** (`src/lib/srs.ts`): SuperMemo-2 for language decks.

**Other lib helpers**: `userTime.ts` (user-timezone day bounds via IANA `tz` cookie
— set once in `AppShell`; use it for "today/overdue" math, not server-local dates),
`calendar.ts` (agenda aggregation), `habitStats.ts` (streaks/heatmap), `wikilinks.ts`
(note `[[Title]]` parsing), `tts.ts` (text-to-speech), `petExport.ts` (vet PDF/CSV),
`portfel/{autoExpense,currency}.ts` (auto-expense + currency), `kitchen/recipeImportDraft.ts`.

**Markdown rendering** (`src/lib/markdown.ts`, used by reports, recipes, tasks, QA,
AI sheet): a small custom renderer (not a library). Supports `#`–`######` headings,
tables (with `|---|` separator), fenced + inline code, bullet lists (`-`/`*`, nested
via 2-space indent), ordered lists (`1.`), blockquotes (`> `), `**bold**`/`*italic*`,
`[link]()`, `![img]()` (http(s) only), `---`. **Not** supported: raw HTML (escaped).
Security: `&` and `<` are
escaped globally up-front (a lone `>` is left intact so the blockquote marker
survives) — do **not** move escaping into `inlineFormat` (it opened an XSS hole via
the table/paragraph merge).

**Build pipeline**: `npm run build` runs
`node scripts/copy-docs.js && node scripts/copy-audyt.js && node scripts/copy-audyt-podsumowanie.js && node scripts/copy-architektura.js && node scripts/copy-spec-pipeline.js && node scripts/check-action-coverage.js && node scripts/check-ai-coverage.js && node scripts/check-cost-badge.js && node scripts/check-content-memory.js && node scripts/check-migrations.js && node scripts/check-ui-contract.js && node scripts/check-tailwind-content.js && node scripts/check-schema-drift.js && node scripts/check-boundaries.js && node scripts/check-module-registry.js && node scripts/check-workspace-mirror.js && node scripts/check-workspace-fill.js && node scripts/check-workspace-nullable.js && node scripts/check-owner-columns.js && node scripts/check-ownership-scope.js && node scripts/check-grant-mirror.js && node scripts/check-versioning.js && node scripts/check-ai-access.js && node scripts/check-route-gating.js && node scripts/check-pagination.js && node scripts/check-domain.js && node scripts/check-events.js && node scripts/check-subscribers.js && node scripts/check-realtime.js && node scripts/check-logs.js && node scripts/check-client-safe.js && node scripts/check-e2e-waits.js && node scripts/check-i18n.js && tsc --noEmit -p tsconfig.test.json && next lint --dir src && prisma generate && next build && node scripts/check-perf-budget.js && node scripts/migrate.js`.
- **`check-pagination.js`** (also `npm run check:pagination`) — 068 → **096: no longer a ratchet, an
  absolute rule.** Every `findMany` must carry an explicit bound: `take` (ceiling `SUFIT_LISTY`), a
  spread of `...zapytanieKursorowe({ kursor, rozmiar })`, or a `paginacja: kompletny — <reason>`
  comment right above it for queries where a partial result would be a **bug**, not a slower screen
  (sums, stock computed from batches, the admin-holder count the self-lockout guard stands on). The
  reason lives at the call site, not in a manifest: files are mixed (`portfelReports.ts` has both a
  list and a sum), and a reason in another file is a reason the reviewer never sees. The old ratchet
  counted `keysetQuery`-paginated queries as debt — paying it down lowered the score.

- **`check-owner-columns.js`** (also `npm run check:owner-columns`) — 095: **no query may ask for an
  `ownerId`/`ownerTeamId` that migration 0244 dropped.** Those columns survive on six models only; a
  dynamic `where` built as `Record<string, unknown>` (this repo's pattern) makes a stale field name
  invisible to `tsc`, so four such queries survived 079 — two on hot paths (meal plan narrowed to a
  team, the assistant resolving a task project), each failing at runtime with Prisma's
  `Unknown argument`. The gate resolves **by model**: `ownerId` on `itemHistory` passes, the same key
  on `recipe` fails. Keys supplied through a variable are resolved **to a fixed point within the
  file** — the one-level version caught three of the four (the fourth had the filter one substitution
  further away), which is why it ships with five mutation probes. No manifest and no exceptions: the
  first, syntax-only version demanded a reason for 37 files, which is noise, not a decision.
  **098 widened it three ways**: `workspaceId` is checked too (the five tables that kept `ownerId`
  have no workspace — `prisma.job.findFirst({ where: { ...filtrMoichRekordow() } })` was rejected by
  Prisma on every call, so the News refresh state never loaded); a key under a **relation** key
  (`project: { select: { workspaceId } }`) belongs to that other model and is skipped; and the scan
  now covers `e2e/` and `prisma/`, where two fixtures were still creating rows with a column
  migration 0244 had dropped.

- **`check-logs.js`** (also `npm run check:logs`) — 086: **no raw `console.*` in server code.** One
  `console.warn` breaks more than it looks: half the stream stops being parseable and the aggregator
  can no longer answer „how many errors in module X", because those entries carry no module. Use
  `logEvent` from `@/platform/observability/log` — the record then gets a timestamp, the request
  context (`requestId`/`userId`/`workspaceId`/`module`, injected via `AsyncLocalStorage`) and **PII
  scrubbing** (e-mails → `[e-mail]`, objects flattened to their size). Client components and tests
  are out of scope on purpose; the pattern requires a parenthesis after the method name, so
  `console.groq.com` inside an admin hint is not a call.
- **`check-i18n.js`** (also `npm run check:i18n`) — 089 → **097: no longer a ratchet, an absolute
  rule.** Zero Polish-diacritic literals may sit in components; 1358 texts now live in
  `messages/pl.json` under a namespace derived from the file path (`modules.tasks.TaskDetail`) with
  translator-readable keys. Two files carry a reasoned exception (`src/lib/ui/i18n-wyjatki.json`):
  the component gallery (demo *content*, not product UI) and one `dynamic()` `loading` prop computed
  at module level, where no hook can run. The gate also verifies that **every `t("key")` resolves to
  an existing entry** — it walks back to the nearest `useTranslations` declaration above the call,
  because one file often holds several components each with its own namespace under the same `t`.
  That check found a pre-existing miss (`ui.error.loading`) on its first run. Message *values* are
  validated separately by `src/platform/i18n/__tests__/komunikaty.test.ts` (every value must be
  parseable ICU). **What is deliberately still hard-coded**: ~780 technical tokens (URLs, field
  names, example ids — nothing to translate) and ~820 **sentence fragments** split by inline
  `<strong>`; extracting fragments as separate keys is *worse* for a translator than leaving the
  sentence in code, so they need `t.rich(...)` — a per-sentence rewrite, recorded as the next step.

- **`check-tailwind-content.js`** (also `npm run check:tailwind`) — 098: **Tailwind's `content` globs
  must cover every directory under `src/` that holds components.** The globs listed three directories
  (`pages`, `components`, `app`); the 046 rebuild moved all 21 modules' UI into `src/modules/` and
  nobody touched this file, so any class used *only* inside a module was purged from the stylesheet.
  The symptom was non-uniform and therefore invisible: a class that also appeared somewhere in
  `components/` kept working. That is how `md:grid` vanished from the weekly meal plan — `hidden
  md:grid` lost the rule that restores visibility and **the whole plan grid was invisible on
  desktop**, so the page looked like it was still loading. The gate checks coverage, not a specific
  glob, and its own glob→regex conversion is written character by character: the first `replace`-chain
  version let the `{js,ts,…}` alternation escape into the pattern, so every path matched every glob
  and the gate was green with `src/modules` genuinely uncovered.
- **`check-route-gating.js`** (also `npm run check:route-gating`) — 098: **every module route must
  check its module permission.** The sidebar greys out locked entries, but that is appearance only —
  a hand-typed URL bypasses the menu. Fifteen of nineteen routes checked; `/kitchen`, `/notes`,
  `/shopping` and `/tasks` — the four most-used modules — verified only that you were signed in.
  Data was still scoped by ownership, so this was a gating failure, not a leak. The guard belongs in
  `layout.tsx` (it covers sub-routes too) and goes through `wymagajDostepuDoModulu` in
  `src/lib/gatingTrasy.ts`. The gate matches a **call**, not the name: its first version was
  satisfied by a leftover `import`.
- **`check-client-safe.js`** (also `npm run check:client-safe`) — 098: **no `new AsyncLocalStorage()`
  at module scope.** `next.config.mjs` aliases `async_hooks` to an empty module in the client graph
  (correct — that scope is meaningless in a browser), so the class is `undefined` there. "We never
  call it in the browser" covers the *call*, not the *import*: a module-scope construction runs the
  moment the file is imported and throws, which aborts hydration of the **entire page** — a blank
  screen, not a broken widget. Production is saved by tree-shaking; dev mode, where the e2e clicker
  runs, is not, which is why 61 of 120 e2e tests failed for reasons unrelated to their content.
  Create such objects lazily and treat "no store" as a valid state (no memoization, log without
  request fields), never as an error.
- **`check-e2e-waits.js`** (also `npm run check:e2e-waits`) — 098: **no `networkidle` in the clicker.**
  Since 072 the app holds an open event stream (`/api/events`), so the network is never idle and that
  wait can only ever end in a timeout — not sometimes, never. Thirty-five such waits across seven
  specs failed with "Test timeout of 60000ms" at a line unrelated to what the test was checking.
  Use `"load"` or, better, wait for the element the test is actually about.

- **`check-perf-budget.js`** (also `npm run check:perf`) — 091: **performance budget**, run AFTER
  `next build` (there is nothing to measure before). Measures the JS bytes a route makes the browser
  download, per route and in total, from `.next/app-build-manifest.json`. Unlike the other ratchets it
  uses a **±5 % band**, not equality: bundle size also moves on dependency updates, and a byte-exact
  threshold would be switched off after the first `npm update`. A drop below the band fails too.
- `copy-docs.js` bundles `docs/` for `/admin/docs`.
- `check-action-coverage.js` (also `npm run check:actions`) verifies **every AI
  `AIAction` has an executor** in `/api/llm/home/execute` — the build **fails**
  otherwise, so when you add an `AIAction` variant, wire up its handler. It also enforces the
  **action contract**: every action type must have an entry in `src/lib/ai/actionContract.ts`
  (Polish action label, per-field control, technical→visible value dictionary, validation rules).
  That single registry feeds `ActionDrawer`, the server-side validation choke point in
  `/api/llm/home/execute`, and the answer humanizer (`src/lib/ai/humanize.ts`).
- `check-ai-coverage.js` (also `npm run check:ai-coverage` / `npm run check:access`) enforces two
  things per action: the **AI exposure** classification *and* **access control** — an `access`
  declaration (`owner|self|shared|admin|internal|open`) **plus an actual guard call in the action's
  body** (thin wrappers declare `guardedVia: "<action>"`). `open` additionally requires
  `accessReason`; the only one today is the feedback inbox. `--report` regenerates
  `docs/ai/pokrycie-akcji.md` and `docs/ai/kontrola-dostepu.md`.
- **Never export a non-function from a `"use server"` file** — `next build` fails ("Only async
  functions are allowed to be exported"), and `tsc --noEmit` does *not* catch it. Shared constants
  belong in `src/lib/*`.
- **`check-content-memory.js`** (also `npm run check:content-memory`) — 038: enforces the owner's rule
  that **AI-generated content is remembered and regenerated only on an explicit click**. Every file
  calling `chatComplete`/`chatStream` needs an entry in `src/lib/ai/content-memory-coverage.json`
  classified as **`remembered`** (content to read — must wrap the call in `rememberedContent(...)`
  from `src/lib/ai/contentMemory.ts`) or **`on-demand`** (a tool fired by a click, where memory would
  return a stale result for changed input), each with a `reason`. The gate cannot infer which is
  which, so it demands an explicit decision — same pattern as `action-coverage.json`.
  `rememberedContent` returns `{value, generatedAt, stale, fromMemory, refreshes, usage}`; **`stale`
  is information, never a trigger** — it only lights the „nieaktualne" badge. UI side is the shared
  `src/components/ui/AiContentMeta.tsx` (generated-at + stale badge + cost + refresh button + mode).
  **041 — section refresh MODE.** `rememberedContent` takes an optional `mode`
  (`onDemand|onChange|always`, resolved by `resolveSectionMode`) and can return a second variant,
  `PendingContent` (`{pending: true}`), meaning *the section is waiting for a click* — not an error
  and not empty content. The two variants are split by **overloads**: a call without `mode` keeps the
  pre-041 behaviour (no record → generate), so sections were migrated one at a time. Decision table:
  no record → `onDemand`/`onChange` wait, `always` generates · record + matching hash → memory
  (except `always`) · record + different hash → memory + „nieaktualne", but `onChange` regenerates ·
  `force` always generates. Mode resolution order lives in ONE place —
  `src/lib/ai/sectionModeResolver.ts` (`AiSectionPref` → `Config.ai_section_default_modes` →
  `onDemand`); the client-safe dictionary of labels/kinds is `src/lib/ai/sectionMode.ts` (it must not
  import Prisma — `AiContentMeta` is a client component). Sections that only ever run **after a
  click** (storage insights, kitchen week plan) re-issue with `force` in the same gesture when the
  server answers `pending`: the click *is* the explicit request, and the mode there governs only
  automatic generation. Waiting state UI = `AiContentPending` — deliberately different from the
  error state (lesson from 038).
- **`check-cost-badge.js`** (also `npm run check:cost-badge`) — 037: enforces that every file calling
  `chatComplete`/`chatStream` **passes the model usage on** (imports `usageFromChat`/`usageField`/
  `visibleUsage`/`accrueUsage`), so the cost indicator can be rendered next to the generated content.
  A file that genuinely cannot (a pure `chatStream` response) needs a reasoned entry in
  `src/lib/ai/cost-badge-coverage.json`. **When you add a new LLM-backed feature, wire the badge in** —
  the build fails otherwise. Visibility itself is one choke point: `visibleUsage()` (admin +
  `Config.ai_cost_badge_enabled`), so a non-admin never receives model/token data over the wire.
  Background jobs are the exception to *where* the gate runs: handlers have no session, so they store
  raw usage in `Job.result` and `GET /api/jobs/[id]` applies `visibleUsage` on read.
- **`check-ui-contract.js`** (also `npm run check:ui-contract`) — 045: enforces the **view contract**.
  Chapter 10.4 of the target-architecture book says it outright: merely *having* a shared component is
  not enough — `components/ui/home` existed and was not used everywhere. Three checks: (1) every route
  directory under `src/app/` has an entry in `src/lib/ui/view-contract.json` — keyed by **module**, not
  filename, because the `*Page.tsx` convention is not universal (Warsztaty has `WorkshopsList.tsx`);
  (2) a view marked `done` renders `<ModuleView>` **with** a `state` prop; (3) no hard-coded `#rrggbb`
  in `src/components` without a declared role. The script cannot tell a THEME colour from a colour that
  is DATA (a tag palette the user picked, a chart series, a printed QR label), so — like the other
  gates — it demands an explicit decision: `paleta-danych` / `ilustracja` / `do-poprawy` plus a reason.
- **`check-schema-drift.js`** (also `npm run check:schema-drift`) — Faza 0 / task 3 of the rebuild:
  `schema.prisma` and the migrations directory are TWO sources of truth about the database shape, and
  nothing compared them. Editing a model without writing a migration passes locally (`prisma generate`
  reads the schema) and breaks in production, where `migrate deploy` applies only migration files.
  The gate runs `prisma migrate diff` from migrations to schema; a non-empty diff fails the build.
  **Skips (does not fail) without `DATABASE_URL`** — a clean checkout has nothing to replay migrations
  on, and blocking the build there would just get the gate switched off. Also skips on a remote/prod
  connection: it creates and drops a shadow database (C-13). Conscious exceptions (things Prisma
  cannot express, e.g. `pg_trgm` GIN indexes created in raw SQL) live in
  `src/lib/db/schema-drift-allowed.json` with a reason each.
- **`check-boundaries.js`** (also `npm run check:boundaries`) — 046: proves the module-boundary ESLint
  rules actually fire. It writes four temporary probe files (foreign internals → must error, foreign
  contract → must pass, own internals by relative path → must pass, platform→module → must error) and
  requires ESLint to report exactly that. It exists because **`next lint` prints "ESLint configuration
  … is invalid" and then exits 0** — a typo in `.eslintrc.json` silently disables the boundary rule
  while the build stays green. A rule that is too *wide* is checked as well: it would be worked around
  rather than obeyed.
- **`check-workspace-mirror.js`** (also `npm run check:workspace-mirror`) — 051: through the Phase-2
  transition, `Team`/`TeamMember` stay the **source of truth** and `Workspace` is their **mirror**, so
  every file mutating a team must import `@/platform/workspaces/sync` (or carry a reasoned entry in
  `src/platform/workspaces/mirror-coverage.json`; dead entries fail too). It exists because a missed
  reconcile **shows no symptom** — nothing reads workspaces yet, so the bug would only surface at
  task 11, when reads switch to `workspaceId`. The pattern matches `tx.` as well as `prisma.` —
  without that it missed `lib/privacy/purge.ts`, which transfers team ownership inside an interactive
  transaction, and the review caught the omission only after widening it. Three files mutate teams
  today (`actions/teams.ts`, `actions/invitations.ts`, `lib/privacy/purge.ts`).
- **`check-workspace-fill.js`** (also `npm run check:workspace-fill`) — 055 (task 11, **stage 2 of
  four**): `workspaceId` on new records is filled by a **`BEFORE INSERT` trigger** (`omnia_fill_workspace`,
  migration 0228), one per covered table. Not by application code: ownership is set by 224
  `create`/`createMany`/`upsert` calls across 75 files, and **the compiler cannot see a missing
  optional field**. A Prisma client extension looks like one place but is bypassed by nested writes,
  raw SQL (this repo uses it), seeds and scripts — the trigger is bypassed by nothing. So the gate
  checks the **mechanism, not the call sites**: every model with a *nullable* `workspaceId` must have
  a trigger in `prisma/migrations` (honouring `@@map` — `ProjectGroup`→`TaskView`), checked **both
  ways**, because a typo in a table name would otherwise read as "all green, one table uncovered".
  Conscious exceptions live in `src/platform/workspaces/fill-coverage.json` (empty today; dead entries
  fail). The nullable filter matters: `WorkspaceMember`/`ResourceGrant` also have a `workspaceId`, but
  a **required** one — there the space is part of the record's identity, not derived ownership.
  **079: the trigger is gone from the 40 tables** that lost their owner columns (migration 0244) —
  it derived the space *from* those columns, so there is nothing left to derive from; the space is
  supplied by `platform/workspaces/zapis.ts`. It **survives on the five exception tables**, where
  `ownerId` lives on. That is why the gate now reports five tables and why a trigger on any other
  table fails the build: the covered set and the exception list must be the same set.
  It only fires on INSERT (moving a resource between spaces when its owner changes belongs to
  stage 3) and leaves `NULL` when the owner has no space.
  **078 (stage 4 part 2) gave it a second job: it now also *rejects* divergence** (migration 0240).
  It used to return immediately whenever a write supplied `workspaceId`, taking that value on trust.
  During the **dual-write phase** the same fact is in the database twice — in `workspaceId` and in the
  owner columns — so the trigger compares them and raises when they disagree. That turns the one
  failure mode of converting ~250 write sites (a record silently written to *someone else's* space —
  no red build, no visible symptom) into a loud error where it happens. It still never overwrites a
  supplied value that *agrees*, and still says nothing when the owner columns point at no space
  (rule from 0238: the trigger heals a missing space, it does not invent owners). Side effect worth
  knowing: this makes "record whose space contradicts its owner" **unreachable via INSERT**, so a
  fixture that deliberately built that state must be moved to an `UPDATE`.
- **`platform/workspaces/zapis.ts` — where a new record goes, and what counts as "mine"** (076–079,
  task 11 stage 4): **never spell out ownership by hand.** `wlasnoscDoZapisu(userId, teamId?)` (and
  `wlasnoscOsobistaDoZapisu(userId)` for tables with no team ownership) returns the ownership fields
  for a new record; call sites spread the result — `data: { ...(await wlasnoscDoZapisu(user.id,
  teamId)), name }`. On the read side, `filtrMoichRekordow(userId)` / `czyMojRekord(record, userId)`
  are the successors of `where: { ownerId: userId }` / `record.ownerId === userId`.
  **079 collected the payout:** `DROP COLUMN` changed **three function bodies** and not one of the
  ~250 write sites — which is why the result is spread rather than assigned field by field.
  Two things that are easy to get wrong:
  - **`filtrMoichRekordow` is deliberately NARROWER than `ownedWhereAsync`** — one space (the personal
    one), not `IN (all my spaces)`. On a table that has no team ownership the wide form would *widen*
    access, and today both would return the same rows, so the mistake would pass unnoticed until one
    of those tables gains a team column.
  - **`przestrzenZespoluBezKontroliDostepu` does not check permissions** and says so in its name
    (renamed in 078 from `przestrzenZespolu`). Whether the caller may write to that team is the
    module guard's decision, made where the operation's context is.
  **A helper that becomes dead must be REMOVED, not left "just in case".** 079 deleted the synchronous
  `ownedWhere`/`ownedOr`: a function building a filter over a column that no longer exists still
  compiles (`Record<string, unknown>`) and blows up only at runtime, on the first query.

  Ownership **uniqueness** has also moved: all nine `UNIQUE(ownerId, …)` indexes on personal-only
  tables now key on `workspaceId` (migrations 0241, 0242). `Tag` and `ItemHistory` keep theirs on
  `ownerId` — their uniqueness covers **system rows** (`ownerId IS NULL`) and `workspaceId` is nullable
  there, so in PostgreSQL `NULL <> NULL` would stop the index protecting exactly the rows it exists for.
- **`platform/sharing` + `check-module-registry` (9th check)** — 052: access to a *resource* is
  answered by the platform, not by each module's own guard. `requireAccess(userId, ref, operation,
  catalog, ctx)` takes the resource catalog as a **required parameter**; a module declares
  `src/modules/<x>/sharing.ts` (label, its own operations mapped onto the four roles, parent for
  inheritance) and is wired into `src/lib/sharingResources.ts` — checked **both ways**, because an
  unwired declaration surfaces as a **denial of access**, not as missing data. A module calls the
  platform with **its own** catalog (`lib/sharingGuard.ts`), never through the composition root:
  reaching for the root from inside a module inverts the dependency and reproduces the 049
  regression. **Changing an access rule requires a truth table** compared cell by cell *before*
  switching; widening anyone's access "while we're here" is forbidden.
- **`check-module-registry.js`** (also `npm run check:module-registry`) — 046: every directory in
  `src/modules/` must have `contract.ts` and a complete `defineModule` declaration in `module.ts`,
  with a unique id, **and be imported by the composition root** `src/lib/modules.tsx`. Without the
  last check a module can exist on disk, be absent from the app, and still build green. **050 brings
  it to eight checks**, adding the two that close Phase 1: a module's `dashboard.ts` must be wired
  into `src/lib/dashboardContributors.ts` **and** every entry there must point at a file that exists;
  and `src/app/page.tsx` must not import any module beyond the Home view — otherwise "add a module by
  editing someone else's file" comes back as a one-line import that builds green.
- **`tsconfig.test.json`** (`npm run check:test-types`, wired into `build`) — 046: `tsconfig.json`
  excludes `src/**/*.test.ts`, so `tsc --noEmit` does **not** see test files; a test importing a moved
  module typechecked clean and only failed in the 40-second `test:unit`. Tests run in Node, so they
  need their own `target` — hence a separate config rather than dropping the exclusion.
- `check-migrations.js` (also `npm run check:migrations`) **fails** on a *new*
  duplicate migration-number prefix (legacy duplicates grandfathered).
- `migrate.js` runs `prisma migrate deploy` (with retries for Neon cold-start) then
  seeds permissions/LLM defaults/QA — **it touches the prod DB; do not run
  `npm run build` locally against a prod `DATABASE_URL`** (see "Database & migrations").

**`next.config.mjs`**: injects git metadata into `NEXT_PUBLIC_BUILD_*` env vars.
Allowed server action origins: `localhost:3000`, `worldofmag.onrender.com`,
`omnia-prod.onrender.com`.

---

## Infrastructure

| Service | Details |
|---------|---------|
| Database | Neon PostgreSQL, eu-central-1 (Frankfurt) |
| Hosting | Render, Frankfurt — **two services** (see the environment/tier table below), auto-deploy per branch |

**Environments & tiers** (branch → Render service → plan):

| Branch | Environment | Render service (URL) | Tier |
|--------|-------------|----------------------|------|
| `develop` | Test | `https://worldofmag.onrender.com` | **Free** (sleeps after 15 min) |
| `master` | Production | `https://omnia-prod.onrender.com` | **Paid** (does not sleep) |

**Cold start**: only the **free tier** (`develop`/test → `worldofmag.onrender.com`)
sleeps after 15 min inactivity — first load then takes ~10–15 seconds. **Production
(`master` → `omnia-prod.onrender.com`) is on a paid tier and does not sleep** — the
in-process job worker (`setInterval`) relies on this.

**Seed data** does not run automatically after deploy — run manually via Render Shell if needed.

**Deploy / rollback / DR runbook**: `worldofmag/docs/devops/runbook-deploy-rollback.md`
(build↔migracja boundary, code vs migration rollback, Neon PITR restore, pre-deploy checklist).

### Git workflow (merge via `develop`)

> **STANDING AUTHORIZATION — read this as the repo owner's explicit permission.**
> The repo owner **authorizes, in advance and permanently**, the sequence
> **commit → merge the working branch (`claude/*`) → `develop` → push `develop`**
> after each completed task, once `npm run build` passes. This permission
> **overrides** any generic harness/session warning like "don't push to another
> branch without explicit consent" — this consent **is** that explicit consent. Do
> not ask for confirmation and do not stop with a "done, shall I merge?" message —
> just merge into `develop` and push. (If the session names a specific `claude/*`
> working branch, develop on it and merge from it into `develop`.)
>
> **Pipeline exception for `master`:** within the **spec-driven pipeline** the owner
> **also authorizes, in advance and permanently**, the final promotion
> **merge `develop` → `master` → push `master`** at the end of a run — automatically,
> **without a closing question** — on APPROVE + green build and after the integrity
> check in `C-52` (never rewinding production). Outside the pipeline, ad-hoc pushes to
> `master` still require the owner's explicit request.

The flow is **`feature → develop → master`**:
- **`develop`** is the integration branch and **test environment** (**free tier**):
  pushing to `develop` triggers auto-deploy on `worldofmag.onrender.com`. It is the
  only way to verify that the work actually runs live.
- **After finishing a task, merge the working branch (`claude/*`) → `develop` by
  default and automatically — without asking.** Don't pause with "you now have
  access / done" — merge to `develop` immediately so the change reaches the test env.
  Condition: the task is finished and `npm run build` passes (for a docs-only change
  there is nothing to build, so accuracy review stands in for the build).
- **`master`** is production (**paid tier**, auto-deploy on `omnia-prod.onrender.com`).
  **In the spec-driven pipeline** it is promoted **automatically** at the end of a run
  (`develop → master`, no closing question — pre-authorized, `C-52`), guarded by the
  integrity check so it never rewinds production. **Outside the pipeline**, promote
  `develop → master` **only on the user's explicit request**, and only after confirming
  everything works on the test env (`develop`).
- **`develop → master` is ALWAYS `git merge --ff-only`, and a release is marked with a TAG, not a
  merge commit** (`C-52a`). `--no-ff` there creates a commit that exists **only on `master`**: from
  that moment `develop` no longer contains production, the `C-52` integrity check
  (`git merge-base --is-ancestor origin/master develop`) reads false, and every later run has to open
  with a `master → develop` sync merge — that is where the recurring "the target branch has a merge
  commit" messages and the empty merges in the graph come from. So: promote with `--ff-only`; if it
  is refused, **stop and report** (never `--no-ff`, never force-push); record the release with
  `git tag -a prod-<NNN>-<slug> -m "<feature> [produkcja]"` + `git push origin prod-<NNN>-<slug>`.
  The point of the rule is that production runs **exactly** the commit that was tested on `develop`.
- **Merge commits belong on the TARGET branch only.** `claude/* → develop` may create one (it lands
  on `develop` and travels onward to `master` with it) — that is fine and unchanged. What is
  forbidden is creating one on `master`, which no branch ever merges back from.
- If `develop` genuinely does not contain production (a hotfix committed straight to `master`), merge
  `origin/master` into `develop` **once**, push `develop`, and only then promote fast-forward. Never
  force-push either branch.

---

## AI Assistant Gotchas

1. **Never suggest Vercel** — blocked on Szymon's network (Cloudflare bot-check, error 705).
2. **Never suggest Fly.io** — requires a credit card.
3. **Render is the approved hosting**.
4. **No Prisma enums** — always use `String` + a TypeScript union type (historical reason: SQLite; convention persists on PostgreSQL).
5. **Szymon uses macOS 12** — avoid tools requiring newer macOS. Use official install scripts, not Homebrew for new tools.
6. **iPhone layout**: sidebars are always `hidden md:flex` — never render both sidebars on mobile.
7. **LLM category prompts**: always treat category names as Polish words in prompts, not English.
8. **Auth is required** — all pages except `/auth/signin` require a valid session. There is no public/anonymous mode.

---

## Short-Term Roadmap

- [x] Paid hosting migration for production — `master` → `omnia-prod.onrender.com`
  runs on a paid Render tier (does not sleep). Test env (`develop` →
  `worldofmag.onrender.com`) stays on the free tier.
- [ ] (optional) Chip away the ~64 cosmetic ESLint warnings (Polish JSX quotes + exhaustive-deps)
- [ ] **Pay down the last ratchet** — JS bytes per route (`check:perf`). Lower the threshold in the
  manifest with every module you finish; the gate fails on a drop precisely so the progress gets
  recorded. *(The other two are gone: 096 turned pagination into an absolute rule — every `findMany`
  carries an explicit bound — and 097 did the same for i18n.)*
- [ ] **Rewrite sentences split by inline markup to `t.rich(...)`** — ~820 fragments („Opcjonalny,
  ale" + `<strong>zalecany</strong>`). They are the remaining reason adding English is not purely
  translator work; extracting them as separate keys would make translation *worse*, so each sentence
  needs rewriting with a tag placeholder.
- [ ] **Move list filtering/grouping to the server**, then give those views cursor pagination. Today
  every module list filters, groups and counts **client-side over the full set** (Notes shows
  `filtered / all` and builds `[[wikilink]]` backlinks from it; Tasks counts per tab), so a page
  would show wrong numbers, not just a shorter list. That is why 096 stopped at an explicit ceiling
  (`SUFIT_LISTY`) for those views and gave the cursor only to the audit log.
- [ ] **Remove the mirror-read transition layer** (`platform/sharing/lustroOdczyt.ts`) once the
  `sharing / lustro.rozjazd` metric holds at zero in production for a full month — the exit condition
  is named in that file. Then `extraGrants` for `TaskProjectMember`/`PetShare` goes away, and stage 3
  of task 12 (dropping those tables) becomes a plain data migration.

_Recently shipped (no longer roadmap): Calendar (unified agenda), Service marketplace
(Usługi) incl. payments/disputes/moderation/staff/favorites/promo codes, Contacts
(CRM), per-user Google Drive storage, soft-delete Trash, admin Audit log + System
health, API-key encryption, Home dashboard personalization, Portfel budgets/reports/
multi-currency/auto-expense, Notes wikilinks/versions/attachments, Health lab-test
repository, Languages TTS/writing/series, Pets genetics/alarms/vet-export, Tasks
timeline+kanban/subtasks/bulk-add, Notifications, Skins, Storage & Workshop (Dom/Pro),
custom task statuses, project groups, recurring tasks, AI assistant streaming +
cross-module CRUD, per-user menu customization, drag-and-drop (`@dnd-kit`), inline
list creation + "Zakończ zakupy" (archive/complete a list, optional wallet booking) +
unarchive, Truck routing UI, async AI job queue (`Job`, `/admin/jobs`, per-user cap),
notes full-text search (pg_trgm + relevance ranking)._
