import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Shield, GitBranch, GitCommit, Clock, Hammer, MessageSquare, Settings } from "lucide-react"
import Link from "next/link"

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
  if (session?.user?.role !== "ADMIN") redirect("/")

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
            <Link href="/admin/config" style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              color: "var(--text-primary)",
              textDecoration: "none",
            }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
            >
              <Settings size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>Konfiguracja LLM (klucz Groq)</span>
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
              { label: "Email",    value: session.user?.email ?? "—" },
              { label: "Rola",     value: session.user?.role  ?? "—" },
              { label: "User ID",  value: session.user?.id    ?? "—", mono: true },
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
