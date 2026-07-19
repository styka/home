import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { Shield, GitBranch, GitCommit, Clock, Hammer, MessageSquare, Settings, BookOpen, Map, Tag, MousePointerClick, FileText, Users, Activity, Database, ListChecks, StickyNote, ShoppingCart, ChefHat, PawPrint, Boxes, Palette, ClipboardList, LineChart, Sparkles } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { FeedbackTriggerButton } from "@/components/admin/FeedbackTriggerButton"

function fmtDate(iso: string | undefined) {
  if (!iso || iso === "unknown") return "—"
  const s = iso.slice(0, 19).replace("T", " ")
  return s
}

const BUILD = {
  commit:     process.env.NEXT_PUBLIC_BUILD_COMMIT      ?? "?",
  branch:     process.env.NEXT_PUBLIC_BUILD_BRANCH      ?? "?",
  buildDate:  process.env.NEXT_PUBLIC_BUILD_DATE        ?? "?",
  commitDate: process.env.NEXT_PUBLIC_BUILD_COMMIT_DATE ?? "?",
  commitMsg:  process.env.NEXT_PUBLIC_BUILD_COMMIT_MSG  ?? "—",
}

interface Row {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}

export default async function AdminPage() {
  const session = await auth()
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/")
  const safeSession = session!

  // ── Metrics (parallel counts) ──────────────────────────────────────────────
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [
    users, teams, reports, permissions, activity7d,
    shoppingItems, tasks, notes, recipes, pets, storageItems,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.report.count(),
    prisma.permission.count(),
    prisma.userActivity.count({ where: { createdAt: { gte: since7d } } }),
    prisma.item.count(),
    prisma.task.count(),
    prisma.note.count(),
    prisma.recipe.count(),
    prisma.pet.count(),
    prisma.storageItem.count(),
  ])

  const systemMetrics: { icon: React.ReactNode; label: string; value: number }[] = [
    { icon: <Users size={15} />,      label: "Użytkownicy",            value: users },
    { icon: <Users size={15} />,      label: "Zespoły",                value: teams },
    { icon: <BookOpen size={15} />,   label: "Raporty",                value: reports },
    { icon: <Shield size={15} />,     label: "Uprawnienia",            value: permissions },
    { icon: <Activity size={15} />,   label: "Aktywność (7 dni)",      value: activity7d },
  ]

  const contentMetrics: { icon: React.ReactNode; label: string; value: number }[] = [
    { icon: <ShoppingCart size={15} />, label: "Pozycje zakupowe", value: shoppingItems },
    { icon: <ListChecks size={15} />,   label: "Zadania",          value: tasks },
    { icon: <StickyNote size={15} />,   label: "Notatki",          value: notes },
    { icon: <ChefHat size={15} />,      label: "Przepisy",         value: recipes },
    { icon: <PawPrint size={15} />,     label: "Zwierzęta",        value: pets },
    { icon: <Boxes size={15} />,        label: "Pozycje magazynu", value: storageItems },
  ]

  const rows: Row[] = [
    { icon: <GitBranch size={15} />, label: "Branch",       value: BUILD.branch,              mono: true },
    { icon: <GitCommit size={15} />, label: "Commit",       value: BUILD.commit,              mono: true },
    { icon: <MessageSquare size={15} />, label: "Wiadomość", value: BUILD.commitMsg },
    { icon: <Clock size={15} />,     label: "Data commitu", value: fmtDate(BUILD.commitDate), mono: true },
    { icon: <Hammer size={15} />,    label: "Data buildu",  value: fmtDate(BUILD.buildDate),  mono: true },
  ]

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <Shield size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Panel Administratora
          </h1>
        </div>

        {/* Build info card */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}>
            Informacje o buildzie
          </h2>

          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            {rows.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : undefined,
                }}
              >
                {/* Icon + label */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  minWidth: 140,
                  color: "var(--text-muted)",
                  flexShrink: 0,
                }}>
                  {row.icon}
                  <span style={{ fontSize: 13 }}>{row.label}</span>
                </div>

                {/* Value */}
                <span style={{
                  fontSize: 13,
                  color: "var(--text-primary)",
                  fontFamily: row.mono ? "monospace" : undefined,
                  wordBreak: "break-all",
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Metrics */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <Database size={13} /> Metryki — system
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 10, marginBottom: 16,
          }}>
            {systemMetrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          <h2 style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <Boxes size={13} /> Metryki — zawartość
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 10,
          }}>
            {contentMetrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>
        </section>

        {/* Quick links */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}>
            Konfiguracja
          </h2>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            <style>{`.admin-config-link:hover { background-color: var(--bg-hover); }`}</style>
            <Link href="/admin/config" className="admin-config-link" style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              color: "var(--text-primary)",
              textDecoration: "none",
            }}>
              <Settings size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Konfiguracja LLM (klucz Groq)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
          </div>
        </section>

        {/* Tools links */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
            Narzędzia
          </h2>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <style>{`.admin-tool-link:hover { background-color: var(--bg-hover); }`}</style>
            <FeedbackTriggerButton />
            <Link href="/admin/access" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <Shield size={15} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Zarządzanie dostępem (role & uprawnienia)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/audit" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <Shield size={15} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Dziennik audytu (RBAC & konfiguracja)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/health" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <Activity size={15} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Zdrowie systemu (DB / LLM / build)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/metrics" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <LineChart size={15} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Ekonomika jednostkowa (koszt AI / MAU)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/ai-coverage" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <Sparkles size={15} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Pokrycie akcji przez AI (mutacje + odczyty)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/jobs" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <ListChecks size={15} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Kolejka zadań (OCR / AI w tle)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/services/moderation" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <Shield size={15} style={{ color: "var(--accent-red)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Moderacja sporów (Usługi)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/playground" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <Shield size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Component Playground</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/architecture" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <Map size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Architektura aplikacji</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/docs" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <FileText size={15} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Dokumentacja projektu (CLAUDE.md, doświadczenia.md)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/audyt" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <ClipboardList size={15} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Analiza / Audyt stanu projektu + wskazania</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/audyt-podsumowanie" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <ClipboardList size={15} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Audyt — podsumowanie zmian (wykonane / pozostałe)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/spec-pipeline" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <GitBranch size={15} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Spec-Driven Pipeline — przewodnik (jak budujemy funkcje)</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/categories" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <Tag size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Kategorie systemowe</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/skins" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <Palette size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Skórki systemowe</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/reports" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
              <BookOpen size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Raporty</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
            <Link href="/admin/e2e" className="admin-tool-link" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "var(--text-primary)", textDecoration: "none" }}>
              <MousePointerClick size={15} style={{ color: "var(--accent-red)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Testy klikacze E2E — jak uruchomić</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
          </div>
        </section>

        {/* Session info card */}
        <section>
          <h2 style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}>
            Aktywna sesja
          </h2>

          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            {[
              { label: "Email",    value: safeSession.user?.email ?? "—" },
              { label: "Rola",     value: safeSession.user?.role  ?? "—" },
              { label: "User ID",  value: safeSession.user?.id    ?? "—", mono: true },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : undefined,
                }}
              >
                <span style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 140, flexShrink: 0 }}>
                  {row.label}
                </span>
                <span style={{
                  fontSize: 13,
                  color: row.label === "Rola" ? "var(--accent-purple)" : "var(--text-primary)",
                  fontFamily: row.mono ? "monospace" : undefined,
                  fontWeight: row.label === "Rola" ? 600 : undefined,
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 12 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>
        {value.toLocaleString("pl-PL")}
      </div>
    </div>
  )
}
