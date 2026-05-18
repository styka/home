import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Map, Package, Database, Layers, Server, Cpu, Code, Shield, Globe, GitBranch } from "lucide-react";

export default async function ArchitecturePage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Map size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Architektura aplikacji
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 32, marginTop: 4 }}>
          Developer guide — WorldOfMag. Ostatnia aktualizacja: 2026-05-18.
        </p>

        {/* Tech Stack */}
        <Section title="Stack technologiczny" icon={<Layers size={15} />}>
          <TechGrid items={[
            { name: "Next.js 14", role: "Framework (App Router, Server Components, Server Actions)", category: "core" },
            { name: "React 18", role: "UI library — Client Components dla interaktywności", category: "core" },
            { name: "TypeScript 5 (strict)", role: "Język — ścisłe typowanie w całym projekcie", category: "core" },
            { name: "Tailwind CSS 3.4", role: "Styling + custom CSS variables dla dark theme", category: "ui" },
            { name: "Radix UI", role: "Headless komponenty (Dialog, Dropdown, Tabs, Tooltip…)", category: "ui" },
            { name: "Lucide React", role: "Zestaw ikon (SVG, tree-shakeable)", category: "ui" },
            { name: "cmdk", role: "Command palette (Ctrl+K)", category: "ui" },
            { name: "Prisma 5 ORM", role: "Warstwa dostępu do bazy, schema-first, typesafe", category: "db" },
            { name: "PostgreSQL (Neon)", role: "Produkcja: serverless PostgreSQL, eu-central-1 Frankfurt", category: "db" },
            { name: "SQLite (lokalne dev)", role: "Lokalne środowisko — file:./dev.db", category: "db" },
            { name: "NextAuth 5 (beta)", role: "Autentykacja — Google OAuth, JWT strategy", category: "auth" },
            { name: "Groq API", role: "LLM — funkcje AI (normalizacja, sugestie, rewrite, search)", category: "ai" },
          ]} />
        </Section>

        {/* Directory structure */}
        <Section title="Struktura katalogów" icon={<Code size={15} />}>
          <pre style={{
            fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)",
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "16px", overflowX: "auto", margin: 0,
          }}>
{`worldofmag/src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout — SessionProvider, AppShell
│   ├── page.tsx            # → redirect /shopping
│   ├── admin/              # Panel administratora (ADMIN only)
│   │   ├── page.tsx        # Build info + quick links
│   │   ├── config/         # Konfiguracja LLM (klucz Groq)
│   │   ├── playground/     # Component Playground
│   │   └── architecture/   # Ten widok
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth handlers
│   │   └── llm/            # 10 endpointów AI (POST only)
│   ├── shopping/           # Moduł zakupów
│   ├── tasks/              # Moduł zadań
│   ├── notes/              # Moduł notatek
│   └── settings/           # Ustawienia + zarządzanie teamami
├── components/
│   ├── shell/              # AppShell, ModuleSidebar
│   ├── shopping/           # 12 komponentów modułu zakupów
│   ├── tasks/              # 13 komponentów modułu zadań
│   ├── notes/              # 9 komponentów modułu notatek
│   ├── teams/              # 3 komponenty zarządzania zespołem
│   ├── home/               # 6 komponentów dashboardu
│   ├── command-palette/    # Globalna paleta komend
│   ├── admin/              # ComponentPlayground
│   └── ui/                 # SmartTextarea (shared)
├── actions/                # 15 Server Action modules
├── hooks/                  # useKeyboardShortcuts, useItemNavigation
├── lib/                    # auth, prisma, cn, categorize, parseQuantity,
│   │                       # server-utils, llm-client, categories
│   └── ...
└── types/                  # index.ts, next-auth.d.ts`}
          </pre>
        </Section>

        {/* Auth & Authorization */}
        <Section title="Autentykacja i autoryzacja" icon={<Shield size={15} />}>
          <InfoGrid rows={[
            { label: "Provider", value: "Google OAuth (tylko tyka.szymon@gmail.com ma ADMIN)" },
            { label: "Strategia sesji", value: "JWT (cookie) — bez lookupa DB przy każdym requescie" },
            { label: "Adapter", value: "PrismaAdapter — User/Account zapisywane w DB przy 1. logowaniu" },
            { label: "Middleware", value: "Edge-compatible auth guard → redirect /auth/signin dla niezalogowanych" },
            { label: "Role", value: "USER (domyślna) | ADMIN (per email w createUser event)" },
            { label: "Typ w sesji", value: "session.user.id, session.user.role — rozszerzone w next-auth.d.ts" },
          ]} />
          <CodeSnippet code={`// Wszystkie Server Actions zaczynają od:
const user = await requireAuth(); // src/lib/server-utils.ts
// Rzuca "Unauthorized" jeśli brak sesji

// Autoryzacja zasobu (np. lista zakupów):
await assertListAccess(listId, user.id);`} />
        </Section>

        {/* Data flow */}
        <Section title="Przepływ danych" icon={<Server size={15} />}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Aplikacja używa wzorca Server Actions zamiast tradycyjnych REST API dla mutacji:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FlowStep n={1} label="Server Component (page.tsx)" desc="Pobiera dane bezpośrednio przez Prisma. Przekazuje jako props do Client Component." />
            <FlowStep n={2} label="Client Component" desc="Renderuje UI z danymi. Uruchamia Server Actions przez startTransition() przy mutacjach." />
            <FlowStep n={3} label="Server Action" desc="requireAuth() → assertAccess() → Prisma mutation → revalidatePath() → optionally trackActivity()" />
            <FlowStep n={4} label="Next.js cache" desc="revalidatePath() inwaliduje cache dla ścieżki — React odświeża dane bez pełnego reload." />
          </div>
        </Section>

        {/* Database schema overview */}
        <Section title="Schemat bazy danych" icon={<Database size={15} />}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            11 modeli Prisma pogrupowanych w 5 domenach:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            <DomainCard title="Autentykacja" color="var(--accent-purple)" models={["User (id, email, role, avatarUrl)", "Account (OAuth provider links)", "Session (NextAuth)", "VerificationToken"]} />
            <DomainCard title="Zakupy" color="var(--accent-green)" models={["ShoppingList (ownerId | ownerTeamId)", "Item (status, category, qty, unit)", "ItemHistory (autocomplete, useCount)", "Product (user/team/global catalog)", "Unit (custom units)", "Category (custom + emoji)"]} />
            <DomainCard title="Zadania" color="var(--accent-blue)" models={["TaskProject (inbox concept, members)", "Task (priority, recurring JSON, subtasks)", "TaskTagDef + TaskTaskTag", "TaskComment, TaskShare"]} />
            <DomainCard title="Notatki" color="var(--accent-amber)" models={["NoteGroup (kolor, opis)", "Note (title, content, pinned)", "Tag + NoteTag (pivot)"]} />
            <DomainCard title="Zespoły" color="var(--accent-red)" models={["Team (owner, parentTeam)", "TeamMember (role: MEMBER|ADMIN|OWNER)", "TeamInvitation (status: PENDING|ACCEPTED…)"]} />
            <DomainCard title="System" color="var(--text-muted)" models={["Config (key-value store)", "UserActivity (fire-and-forget logging)"]} />
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <span style={{ fontSize: 12, color: "var(--accent-amber)" }}>
              ⚠ <strong>SQLite gotcha:</strong> Prisma enums nie działają z SQLite.
              Status jest przechowywany jako <code>String</code> w schemacie, a TypeScript union type
              (<code>ItemStatus</code>, <code>TaskStatus</code>) zapewnia type safety na poziomie kodu.
            </span>
          </div>
        </Section>

        {/* Component dependency graph */}
        <Section title="Graf zależności komponentów" icon={<GitBranch size={15} />}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Hierarchia renderowania dla głównych widoków:
          </p>
          <pre style={{
            fontSize: 11, lineHeight: 1.8, color: "var(--text-secondary)",
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "16px", overflowX: "auto", margin: 0,
          }}>
{`app/layout.tsx
└── AppShell [C]
    ├── ModuleSidebar [C]
    │   └── TasksSideNav [C]  ← widoczny tylko na /tasks
    ├── AICommandSheet [C]    ← globalny FAB
    └── {children}

/shopping/[listId]/page.tsx [S] → ShoppingPage [C]
    ├── ListDropdown [C]
    ├── FilterTabs [C]
    ├── SearchBar [C]
    ├── QuickAddBar [C]       ← uses parseQuantity + ProductManager suggestions
    ├── LLMInputSection [C]   ← calls /api/llm/normalize
    └── ItemList [C]
        └── CategoryGroup [C]
            └── ItemRow [C]
                └── StatusBadge

/tasks/[projectId]/page.tsx [S] → TasksPage [C]
    ├── TaskFilters [C]
    │   └── TaskTagBadge
    ├── QuickAddTask [C]
    ├── AITaskInput [C]       ← calls /api/llm/tasks/parse
    └── TaskList [C]
        └── TaskRow [C]
            ├── TaskTagBadge
            └── RecurringBadge
    └── TaskDetail [C] (panel boczny)
        ├── TaskTagsManager [C]
        └── RecurringBadge

/notes/all/page.tsx [S] → NotesPage [C]
    ├── QuickNoteBar [C]      ← calls /api/llm/notes/title + tags
    ├── TagSuggestions [C]    ← calls /api/llm/notes/tags
    ├── NoteGroupSection [C]
    └── NoteList [C]
        └── NoteRow [C]      ← 513 linii! calls /api/llm/notes/rewrite + tags
            ├── TagChip
            └── SmartTextarea [ui/]

[S] = Server Component, [C] = Client Component`}
          </pre>
        </Section>

        {/* AI/LLM architecture */}
        <Section title="Warstwa AI / LLM" icon={<Cpu size={15} />}>
          <InfoGrid rows={[
            { label: "Provider", value: "Groq API (klucz w Config DB — /admin/config)" },
            { label: "Model", value: "Konfigurowalny przez zmienną; zazwyczaj llama3 lub mixtral" },
            { label: "Architektura endpointów", value: "10 dedykowanych route.ts w /api/llm/**" },
            { label: "Klient", value: "src/lib/llm-client.ts — typed fetch wrapper" },
          ]} />
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Endpoint → przeznaczenie:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                ["/api/llm/normalize", "Parsowanie listy zakupów z free-form tekstu na strukturyzowane items"],
                ["/api/llm/notes/tags", "Sugestia tagów + grupy dla notatki na podstawie treści"],
                ["/api/llm/notes/title", "Generowanie tytułu notatki z treści"],
                ["/api/llm/notes/rewrite", "Przepisanie/korekta notatki (3 tryby: correct, rewrite, to_markdown)"],
                ["/api/llm/notes/qa", "Q&A — odpowiedź na pytanie na podstawie zbioru notatek"],
                ["/api/llm/tasks/parse", "Parsowanie opisu zadań z free-form tekstu na Task[]"],
                ["/api/llm/tasks/suggest", "Sugestie zadań do projektu"],
                ["/api/llm/tasks/search", "Semantyczne wyszukiwanie zadań (fuzzy match)"],
                ["/api/llm/home/interpret", "Interpretacja komendy głosowej/tekstowej → intencja + params"],
                ["/api/llm/home/execute", "Wykonanie intencji → akcja w systemie + odpowiedź tekstowa"],
              ].map(([endpoint, desc]) => (
                <div key={endpoint} style={{ display: "flex", gap: 12, alignItems: "start" }}>
                  <code style={{ fontSize: 11, color: "var(--accent-blue)", minWidth: 220, flexShrink: 0 }}>{endpoint}</code>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Keyboard shortcuts */}
        <Section title="Skróty klawiaturowe" icon={<Package size={15} />}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
            Zaimplementowane w <code>src/hooks/useKeyboardShortcuts.ts</code> — globalny dispatcher vim-style:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {[
              ["a / n", "Fokus Quick Add Bar"],
              ["j / ↓", "Nawigacja w dół"],
              ["k / ↑", "Nawigacja w górę"],
              ["Space / x", "Przełącz status"],
              ["e", "Edytuj wybrany element"],
              ["d / Delete", "Usuń wybrany element"],
              ["/ / f", "Otwórz wyszukiwanie"],
              ["1–5", "Przełącz zakładki filtrów"],
              ["Ctrl+K", "Otwórz Command Palette"],
              ["Esc", "Zamknij / anuluj"],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                <kbd style={{ fontSize: 11, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 7px", color: "var(--text-secondary)", minWidth: 70, textAlign: "center", flexShrink: 0 }}>
                  {key}
                </kbd>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Deployment */}
        <Section title="Infrastruktura produkcyjna" icon={<Globe size={15} />}>
          <InfoGrid rows={[
            { label: "Hosting", value: "Render.com — Frankfurt (EU), free tier, auto-deploy on push" },
            { label: "Baza danych", value: "Neon PostgreSQL — eu-central-1 (Frankfurt), serverless" },
            { label: "Live URL", value: "https://worldofmag.onrender.com" },
            { label: "PWA", value: "Web App Manifest + Service Worker (network-first) — zainstalowane na iPhone" },
            { label: "Cold start", value: "Free tier usypia po 15 min — pierwszy request trwa ~10-15s" },
            { label: "Deploy pipeline", value: "npm ci → prisma generate → next build → prisma migrate deploy → next start" },
            { label: "Środowiska", value: "Local: SQLite (file:./dev.db)  |  Prod: PostgreSQL (env: DATABASE_URL + DIRECT_URL)" },
          ]} />
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span style={{ fontSize: 12, color: "var(--accent-red)" }}>
              🚫 <strong>Nie używaj:</strong> Vercel (blokada Cloudflare 705), Fly.io (wymaga karty kredytowej).
              Jedyna zatwierdzona platforma to <strong>Render</strong>.
            </span>
          </div>
        </Section>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ color: "var(--text-muted)" }}>{icon}</span>
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-primary)", margin: 0, textTransform: "uppercase" }}>
          {title}
        </h2>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)", marginLeft: 8 }} />
      </div>
      {children}
    </section>
  );
}

function InfoGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            display: "flex",
            alignItems: "start",
            gap: 12,
            padding: "10px 16px",
            borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : undefined,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 160, flexShrink: 0 }}>{row.label}</span>
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function TechGrid({ items }: { items: Array<{ name: string; role: string; category: string }> }) {
  const catColors: Record<string, string> = {
    core: "var(--accent-blue)",
    ui: "var(--accent-purple)",
    db: "var(--accent-green)",
    auth: "var(--accent-amber)",
    ai: "var(--accent-red)",
  };
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {items.map((item, i) => (
        <div
          key={item.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            borderBottom: i < items.length - 1 ? "1px solid var(--border)" : undefined,
          }}
        >
          <span style={{ fontSize: 12, minWidth: 4, height: 20, width: 4, borderRadius: 2, flexShrink: 0, backgroundColor: catColors[item.category] ?? "var(--text-muted)" }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", minWidth: 180, flexShrink: 0 }}>{item.name}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.role}</span>
        </div>
      ))}
    </div>
  );
}

function DomainCard({ title, color, models }: { title: string; color: string; models: string[] }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-elevated)" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.05em" }}>{title}</span>
      </div>
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {models.map((m) => (
          <span key={m} style={{ fontSize: 11, color: "var(--text-muted)" }}>• {m}</span>
        ))}
      </div>
    </div>
  );
}

function FlowStep({ n, label, desc }: { n: number; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-blue)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>{desc}</p>
      </div>
    </div>
  );
}

function CodeSnippet({ code }: { code: string }) {
  return (
    <pre style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", overflowX: "auto", marginTop: 12, marginBottom: 0 }}>
      <code>{code}</code>
    </pre>
  );
}
