# WorldOfMag — Claude Code Guide

> For full historical context, session notes, and infrastructure credentials, read:
> `worldofmag/CONTEXT.md`

---

## Project Overview

**WorldOfMag** is a modular personal life/work management system for **Szymon Tyka** (tyka.szymon@gmail.com). The name means "World of the Mage" — Szymon's personal digital world.

### UX Philosophy
- Keyboard-first (vim-style shortcuts: j/k, x, e, d)
- Dark theme, minimalist (Linear/GitHub/VS Code aesthetic)
- Zero unnecessary clicks or animations
- Designed for a developer power user

### Module Roadmap
| Module | Status |
|--------|--------|
| Shopping List | Done and deployed |
| Calendar | Stub (sidebar icon only) |
| Notes | Stub |
| Work Tracker | Stub |

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

### `worldofmag/` structure
```
worldofmag/
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── render.yaml             # Production deployment config
├── Dockerfile              # Multi-stage build (node:22-alpine)
├── fly.toml                # Unused backup (Fly.io was abandoned)
├── .env.example            # Environment variable template
├── prisma/
│   ├── schema.prisma       # Database models
│   ├── seed.ts             # 69 Polish products for autocomplete
│   └── migrations/0001_init/
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker (network-first)
│   └── icons/              # PWA icons (192px, 512px, 180px apple)
└── src/
    ├── app/                # Next.js App Router pages
    │   ├── layout.tsx
    │   ├── page.tsx        # Redirects to /shopping
    │   └── shopping/
    │       ├── layout.tsx  # CommandPaletteProvider wrapper
    │       ├── page.tsx    # Auto-creates "Zakupy" list if none exist
    │       └── [listId]/page.tsx  # Server component, fetches data
    ├── components/
    │   ├── shell/
    │   │   ├── AppShell.tsx        # flex-col mobile / flex-row desktop
    │   │   └── ModuleSidebar.tsx   # hidden md:flex (desktop only)
    │   ├── shopping/
    │   │   ├── ShoppingPage.tsx    # Main client component
    │   │   ├── QuickAddBar.tsx     # Smart add with autocomplete
    │   │   ├── FilterTabs.tsx      # Status filter tabs with counters
    │   │   ├── ItemList.tsx        # Items grouped by category
    │   │   ├── ItemRow.tsx         # Inline edit, status toggle
    │   │   ├── CategoryGroup.tsx   # Collapsible with emoji icons
    │   │   ├── StatusBadge.tsx     # needed/in cart/done/missing
    │   │   ├── ListPicker.tsx      # hidden md:flex (desktop sidebar)
    │   │   └── SearchBar.tsx       # Real-time search overlay
    │   └── command-palette/
    │       ├── CommandPalette.tsx
    │       └── CommandPaletteProvider.tsx
    ├── hooks/
    │   ├── useKeyboardShortcuts.ts # Central vim-style keyboard dispatcher
    │   └── useItemNavigation.ts    # j/k navigation + scrollIntoView
    ├── actions/
    │   ├── items.ts        # addItem, updateItemStatus, deleteItem, bulk ops
    │   └── lists.ts        # createList, renameList, deleteList, getLists
    ├── lib/
    │   ├── categorize.ts   # 12-category auto-categorizer (PL + EN keywords)
    │   ├── parseQuantity.ts # Smart parser: "2 butelki mleka" → {qty, unit, name}
    │   ├── cn.ts           # Tailwind className merger (clsx + tailwind-merge)
    │   └── prisma.ts       # Prisma singleton client
    └── types/
        └── index.ts        # Item, ShoppingList, ItemStatus, FilterTab types
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI | React 18 + Tailwind CSS + CSS variables |
| Components | Radix UI (headless), cmdk (palette), Lucide React (icons) |
| ORM | Prisma 5 |
| DB (local) | SQLite via `file:./dev.db` |
| DB (prod) | PostgreSQL on Neon (eu-central-1, Frankfurt) |
| Hosting | Render (Frankfurt, free tier) |
| PWA | Web App Manifest + Service Worker |

---

## Development Setup

All work happens inside `worldofmag/`. Run commands from there.

### Local development (SQLite)
```bash
cd worldofmag
npm install

# Create local env
echo 'DATABASE_URL="file:./dev.db"' > .env.local
echo 'DIRECT_URL="file:./dev.db"' >> .env.local

npm run db:push    # apply schema to local SQLite
npm run db:seed    # populate 69 Polish products
npm run dev        # → http://localhost:3000
```

### Using production database (Neon PostgreSQL)
```bash
# Set .env.local to the Neon connection string (see worldofmag/CONTEXT.md §4)
npm run dev
```

### npm scripts
| Script | Purpose |
|--------|---------|
| `dev` | Start dev server |
| `build` | `prisma generate` + `next build` |
| `start` | Start production server |
| `db:push` | Apply schema changes without migrations |
| `db:migrate` | Apply migrations to production DB |
| `db:seed` | Load seed data (ItemHistory) |
| `db:studio` | Open Prisma Studio UI |

---

## Database Schema

```prisma
model ShoppingList {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  items     Item[]
}

model Item {
  id        String  @id @default(cuid())
  name      String
  quantity  Float?
  unit      String?
  category  String  @default("Other")  // set by categorize.ts
  status    String  @default("NEEDED") // see ItemStatus type below
  notes     String?
  priority  Int     @default(0)
  listId    String                      // FK → ShoppingList (cascade delete)
}

model ItemHistory {
  id        String   @id @default(cuid())
  name      String   @unique           // lowercase, for search
  category  String
  unit      String?
  useCount  Int      @default(1)       // increments on each use → autocomplete ranking
  updatedAt DateTime @updatedAt
}
```

**ItemStatus** (defined in `src/types/index.ts`):
```ts
type ItemStatus = "NEEDED" | "IN_CART" | "DONE" | "MISSING"
```

---

## Key Conventions

### Status as String, not Enum
SQLite does not support Prisma enums. `Item.status` is `String` in the schema. The TypeScript union type `ItemStatus` enforces correctness at compile time. Never change this to a Prisma enum — it would break local development.

### Server Actions
All mutations use Next.js Server Actions (`src/actions/`). They call `revalidatePath()` at the end — do not add manual cache invalidation elsewhere.

### Path alias
`@/*` resolves to `./src/*`. Use this in all imports.

### Mobile responsiveness
Sidebars are hidden on mobile:
- `ModuleSidebar` → `hidden md:flex`
- `ListPicker` → `hidden md:flex`
- Mobile gets a top bar with logo + a `<select>` dropdown for list switching
- Minimum touch targets: `py-3`, 20×20px checkboxes

### Dark theme
CSS variables defined in `src/app/globals.css`:
```
--bg-base: #0d0d0d
--bg-surface: #1a1a1a
--bg-elevated: #242424
--bg-hover: #2f2f2f
--border: #333333
--text-primary: #ffffff
--text-secondary: #b0b0b0
--text-muted: #808080
```
Use these variables via Tailwind classes, not hardcoded hex values.

### Smart parsing
`parseQuantity.ts` handles 7 patterns:
- `mleko x2` → `{qty: 2, unit: null, name: "mleko"}`
- `2 butelki mleka` → `{qty: 2, unit: "butelki", name: "mleka"}`
- `mleko 500ml` → `{qty: 500, unit: "ml", name: "mleko"}`

### Auto-categorization
`categorize.ts` maps 100+ Polish and English keywords to 12 categories: Produce, Dairy & Eggs, Meat & Fish, Bakery, Dry Goods, Drinks, Frozen, Snacks, Condiments, Spices, Cleaning, Other.

---

## Keyboard Shortcuts (implemented)

Defined in `src/hooks/useKeyboardShortcuts.ts`:

| Key | Action |
|-----|--------|
| `a` / `n` | Focus QuickAddBar |
| `j` / `↓` | Navigate down |
| `k` / `↑` | Navigate up |
| `Space` / `x` | Cycle item status |
| `e` | Inline edit selected item |
| `d` / `Delete` | Delete selected item |
| `/` / `f` | Open search |
| `1`–`5` | Switch filter tabs |
| `Ctrl+K` | Open command palette |
| `Esc` | Close/cancel |

---

## Git Workflow

- **Master branch:** untouched legacy Spring Boot code
- **Working branch:** `claude/shopping-list-app-rJieP` — auto-deploys to Render on every push
- **Documentation branch:** `claude/add-claude-documentation-IiHKi`

Push to the working branch to trigger a production deployment:
```bash
git push -u origin claude/shopping-list-app-rJieP
```

---

## Infrastructure

| Service | Details |
|---------|---------|
| Database | Neon PostgreSQL, eu-central-1 (Frankfurt), project: `worldofmag` |
| Hosting | Render, Frankfurt, free tier, auto-deploy on push |
| Live URL | `https://worldofmag.onrender.com` |
| PWA | Installed on Szymon's iPhone via Safari → Add to Home Screen |

**Build pipeline on Render:**
1. `npm ci`
2. `npx prisma generate`
3. `npm run build`
4. `npx prisma migrate deploy` (start command)
5. `next start`

**Cold start:** Free tier sleeps after 15 min inactivity — first load takes ~10–15 seconds.

---

## AI Assistant Gotchas

These are hard-won lessons — follow them:

1. **Never suggest Vercel** — it is blocked on Szymon's network (Cloudflare bot-check, error 705).
2. **Never suggest Fly.io** — requires a credit card; Szymon won't provide one.
3. **Render is the approved hosting** — use it for all deployment suggestions.
4. **SQLite + Prisma = no enums** — always use `String` with a manual TypeScript union type.
5. **Claude has no internet access** — prepare code and give Szymon instructions instead of trying to deploy or fetch URLs directly.
6. **Szymon uses macOS 12** — avoid tools or install methods that require newer macOS. Use official install scripts, not Homebrew for new tools.
7. **iPhone layout:** two sidebars (220px + 200px = 420px) exceed iPhone width (~390px). Always `hidden md:flex` for sidebars.
8. **Seed data** does not run automatically after Render deploy — must be run manually via Render Shell or added to the start command if needed.

---

## Short-Term Roadmap (Shopping module)

- [ ] Replace `prompt()` in list creation with a proper modal
- [ ] Drag-and-drop item reordering
- [ ] "Complete shopping" — archive/close a list
- [ ] User-defined custom categories
- [ ] List sharing via link

## Long-Term Roadmap (WorldOfMag)

- [ ] Notes module (tags, Markdown)
- [ ] Work Tracker module (tasks, time tracking)
- [ ] Calendar module (integrated with other modules)
- [ ] Authentication (if multi-user becomes needed)
- [ ] Paid hosting migration if free tier performance is insufficient ($7/mo on Render)
