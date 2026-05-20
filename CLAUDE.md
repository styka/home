# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> For full historical context, session notes, and infrastructure credentials, read:
> `worldofmag/CONTEXT.md`

---

## Zasada: Lessons Learned

**Za każdym razem gdy naprawiamy błąd lub rozwiązujemy nieoczywisty problem, dopisz lekcję do pliku `doświadczenia.md` w katalogu głównym repozytorium.**

Moment do dopisania lekcji: build failuje i naprawiamy → zepsuta logika i ją poprawiamy → merge conflict i go rozwiązujemy → błąd bezpieczeństwa i go łatamy.

Format wpisu:
```
## YYYY-MM-DD — Krótki tytuł problemu
**Problem:** co się stało / jaki był błąd
**Rozwiązanie:** co naprawiliśmy i jak
**Lekcja:** co robić inaczej następnym razem
```

Nie pytaj o pozwolenie — po prostu dopisz i commituj razem z poprawką.

---

## Project Overview

**WorldOfMag** is a modular personal life/work management system for **Szymon Tyka** (tyka.szymon@gmail.com). The name means "World of the Mage" — Szymon's personal digital world.

### UX Philosophy
- Keyboard-first (vim-style shortcuts: j/k, x, e, d)
- Dark theme, minimalist (Linear/GitHub/VS Code aesthetic)
- Zero unnecessary clicks or animations
- Designed for a developer power user

### Module Status
| Module | Status |
|--------|--------|
| Shopping List | Done and deployed |
| Tasks | Done and deployed |
| Notes | Done and deployed |
| Calendar | Stub (sidebar icon only) |
| Home (AI dashboard) | Beta — gated behind `BETA_TESTER` role |

---

## Repository Layout

```
/home/user/home/
├── CLAUDE.md               # This file
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

# Local dev (SQLite)
echo 'DATABASE_URL="file:./dev.db"' > .env.local
echo 'DIRECT_URL="file:./dev.db"' >> .env.local
npm install
npm run db:push    # apply schema to local SQLite
npm run db:seed    # populate seed data (ItemHistory + Products)
npm run dev        # → http://localhost:3000

# Database
npm run db:push      # apply schema changes without migrations (dev)
npm run db:migrate   # apply migrations to production DB
npm run db:studio    # Prisma Studio UI

# Build (also runs prisma generate + post-migration script)
npm run build
```

### Required environment variables
```
DATABASE_URL          # Neon PostgreSQL connection string (prod) or file:./dev.db (local)
DIRECT_URL            # Same as DATABASE_URL (required by Prisma for Neon)
AUTH_SECRET           # NextAuth secret
AUTH_URL              # Base URL for auth callbacks (e.g. https://worldofmag.onrender.com)
GOOGLE_CLIENT_ID      # Google OAuth
GOOGLE_CLIENT_SECRET  # Google OAuth
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI | React 18 + Tailwind CSS + CSS variables |
| Auth | NextAuth v5 (beta) + Google OAuth + Prisma adapter |
| Components | Radix UI (headless), cmdk (palette), Lucide React (icons) |
| ORM | Prisma 5 |
| DB (local) | SQLite via `file:./dev.db` |
| DB (prod) | PostgreSQL on Neon (eu-central-1, Frankfurt) |
| Hosting | Render (Frankfurt, free tier) |

---

## Architecture

### Route Structure (`src/app/`)

```
/                        # Home page (AI dashboard, beta-gated)
/shopping/               # Shopping lists
/shopping/[listId]/      # Specific list
/shopping/categories/    # Category management
/shopping/units/         # Unit management
/shopping/products/      # Product catalog
/shopping/icons/         # Category icon/emoji management
/shopping/stores/        # Store maps list
/shopping/stores/[storeId]/  # Store map editor (node/edge graph)
/tasks/                  # Task inbox
/tasks/[projectId]/      # Specific task project
/notes/                  # Notes list
/settings/               # User settings
/guide/                  # Help documentation
/invitations/            # Team invitations
/admin/                  # Admin console (role-gated)
/admin/config/           # System key-value config
/admin/access/           # RBAC access control
/admin/categories/       # Global category management
/admin/reports/          # Markdown reports (slug-based)
/admin/playground/       # Component playground
/auth/signin/            # Google OAuth sign-in
```

### Component Organization (`src/components/`)

Components are organized by module: `shopping/`, `tasks/`, `notes/`, `home/`, `shell/`, `command-palette/`, `admin/`, `teams/`, `ui/`. Each module has a `*Page.tsx` (client entry) and `*HomePage.tsx` (server wrapper). The `AppShell` wraps all pages with sidebar navigation.

### Server Actions (`src/actions/`)

All data mutations use Next.js Server Actions with `revalidatePath()` at the end. Never add manual cache invalidation elsewhere. Key action files: `items`, `lists`, `tasks`, `taskProjects`, `notes`, `noteGroups`, `categories`, `units`, `products`, `stores`, `teams`, `invitations`, `access`, `adminCategories`, `categoryIcons`, `config`, `activity`, `reports`, `tags`.

### Authentication & Authorization

- **NextAuth v5** with Google OAuth is the only supported sign-in method
- Session includes `user.id`, `user.roles`, `user.permissions`
- **RBAC**: Users have `UserRole` entries → roles have `RolePermission` entries → permissions have slugs
- Check permissions via `src/lib/permissions.ts`
- Special roles: `ADMIN` (full access), `BETA_TESTER` (beta features like Home dashboard)
- Teams: users can own or be members of teams; lists/projects can be team-scoped

### Database Schema (key models)

```
User, Account, Session, VerificationToken   — Auth (NextAuth)
UserRole, Permission, RolePermission        — RBAC
Team, TeamMember, TeamInvitation            — Collaboration
ShoppingList, Item, ItemHistory             — Shopping core
Product, Category, Unit, CategoryIconVariant — Shopping config
Store, StoreNode, StoreEdge                 — Store maps (graph)
Note, NoteGroup, Tag, NoteTag               — Notes module
TaskProject, TaskProjectMember, Task        — Tasks module
TaskTagDef, TaskTaskTag, TaskComment, TaskShare — Tasks extras
Config, UserActivity, Report                — System
```

**Important**: `Item.status` is a `String` (not Prisma enum) because SQLite doesn't support enums. TypeScript union `ItemStatus = "NEEDED" | "IN_CART" | "DONE" | "MISSING"` enforces correctness at compile time. Never change this to a Prisma enum.

### Team Sharing Pattern

Resources can be owned by a user OR a team (mutually exclusive). Access check pattern:

```typescript
// Always use getUserTeamIds() to get user's team memberships
const teamIds = await getUserTeamIds(userId);
// Query: ownerId=user OR ownerTeamId in teamIds
where: { OR: [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] }
```

| Module | User ownership | Team ownership | Notes |
|--------|---------------|----------------|-------|
| Shopping Lists | `ownerId` | `ownerTeamId` | ✅ Full support |
| Task Projects | `ownerId` | `ownerTeamId` | ✅ Full support |
| Notes | `ownerId` | `ownerTeamId` | ✅ Added in 0016 migration |
| Stores | `ownerId` | — | User-only |

`assertListAccess()`, `assertNoteAccess()` — pattern for checking access including team membership.

### Dictionary Ownership Levels

Three-tier system for categories, units, products:
- **System** — `userId=null, teamId=null` — managed by admin, visible to everyone
- **User** — `userId=userId, teamId=null` — owned by user
- **Team** — `userId=null, teamId=teamId` — owned by team, visible to all team members

`getCategories()`, `getUnits()` — return all three levels merged, with `isBase`, `isOwn`, `teamId` fields.

### LLM Integration

`src/lib/llm-client.ts` handles AI features:
- Smart item categorization (Polish + English keywords via `categorize.ts`)
- AI command parsing via the Home page command section
- LLM prompts treat category names as Polish words (not English)
- Category hints are injected into prompts from DB-driven categories

### Store Maps

Stores are graph structures: `Store` → `StoreNode[]` (positions) + `StoreEdge[]` (connections with weights). `src/lib/storeLayout.ts` handles layout algorithms, `src/lib/storeRoute.ts` handles optimal routing.

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

**Mobile responsiveness**: Both sidebars are `hidden md:flex`. Mobile gets a top bar with logo + `<select>` for navigation. Minimum touch targets: `py-3`, 20×20px checkboxes.

**Keyboard shortcuts** (defined in `src/hooks/useKeyboardShortcuts.ts`):
`j/k` navigate, `x/Space` cycle status, `e` edit, `d/Delete` delete, `a/n` add, `//f` search, `1–5` filter tabs, `Ctrl+K` command palette, `Esc` close.

**Smart parsing** (`parseQuantity.ts`): `"2 butelki mleka"` → `{qty:2, unit:"butelki", name:"mleka"}`, `"mleko 500ml"` → `{qty:500, unit:"ml", name:"mleko"}`, `"mleko x2"` → `{qty:2, name:"mleko"}`.

**Build pipeline**: `npm run build` runs `prisma generate && next build && node scripts/migrate.js`. The `scripts/migrate.js` handles post-build DB migrations.

**`next.config.mjs`**: Injects git metadata into `NEXT_PUBLIC_BUILD_*` env vars. Allowed server action origins: `localhost:3000` and `worldofmag.onrender.com`.

---

## Infrastructure

| Service | Details |
|---------|---------|
| Database | Neon PostgreSQL, eu-central-1 (Frankfurt) |
| Hosting | Render, Frankfurt, free tier, auto-deploy on push to `master` |
| Live URL | `https://worldofmag.onrender.com` |

**Cold start**: Free tier sleeps after 15 min inactivity — first load takes ~10–15 seconds.

**Deploy**: Push to `master` branch triggers auto-deploy on Render.

```bash
git push origin master
```

**Seed data** does not run automatically after deploy — run manually via Render Shell if needed.

---

## AI Assistant Gotchas

1. **Never suggest Vercel** — blocked on Szymon's network (Cloudflare bot-check, error 705).
2. **Never suggest Fly.io** — requires a credit card.
3. **Render is the approved hosting**.
4. **SQLite + Prisma = no enums** — always use `String` with a TypeScript union type.
5. **Szymon uses macOS 12** — avoid tools requiring newer macOS. Use official install scripts, not Homebrew for new tools.
6. **iPhone layout**: sidebars are always `hidden md:flex` — never render both sidebars on mobile.
7. **LLM category prompts**: always treat category names as Polish words in prompts, not English.
8. **Auth is required** — all pages except `/auth/signin` require a valid session. There is no public/anonymous mode.

---

## Short-Term Roadmap

- [ ] Replace `prompt()` in list creation with a proper modal
- [ ] Drag-and-drop item reordering
- [ ] "Complete shopping" — archive/close a list
- [ ] Calendar module (integrated with other modules)
- [ ] Paid hosting migration if free tier performance is insufficient ($7/mo on Render)
