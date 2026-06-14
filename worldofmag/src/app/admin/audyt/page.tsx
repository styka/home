import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getAudytChapters } from "@/lib/audyt"
import Link from "next/link"
import { ChevronLeft, BookMarked, Clock, Eye } from "lucide-react"

export default async function AudytPage() {
  const session = await auth()
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/")

  const chapters = getAudytChapters()

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Back link */}
        <Link
          href="/admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          <ChevronLeft size={14} />
          Admin
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <BookMarked size={20} style={{ color: "var(--accent-blue)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Audyt — Analiza stanu projektu
          </h1>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 32,
            marginTop: 4,
          }}
        >
          Wyczerpująca analiza projektu WorldOfMag (Omnia) na 2026-06-14. Zawiera opisy, analizy, debaty dwóch zespołów, marketing, oraz 10 konkretnych zaleceń z planami implementacji dla Claude Code.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text-muted)",
                marginBottom: 8,
                fontSize: 12,
              }}
            >
              <BookMarked size={13} />
              <span>Rozdziały</span>
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                fontFamily: "monospace",
              }}
            >
              {chapters.length}
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text-muted)",
                marginBottom: 8,
                fontSize: 12,
              }}
            >
              <Clock size={13} />
              <span>Oczekiwany czas</span>
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                fontFamily: "monospace",
              }}
            >
              ~2 godz.
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text-muted)",
                marginBottom: 8,
                fontSize: 12,
              }}
            >
              <Eye size={13} />
              <span>Dostęp</span>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--accent-purple)",
              }}
            >
              Admin only
            </div>
          </div>
        </div>

        {/* Table of Contents */}
        <h2
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}
        >
          Spis treści
        </h2>

        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <style>{`.audyt-link:hover { background-color: var(--bg-hover); }`}</style>

          {chapters.map((chapter, idx) => (
            <Link
              key={chapter.slug}
              href={`/admin/audyt/${chapter.slug}`}
              className="audyt-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                color: "var(--text-primary)",
                textDecoration: "none",
                borderBottom:
                  idx < chapters.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{chapter.title}</div>
                {chapter.estimatedReadTime && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    ~{chapter.estimatedReadTime} min
                  </div>
                )}
              </div>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>→</span>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <div
          style={{
            marginTop: 32,
            padding: "16px",
            background: "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.3)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          <p style={{ marginTop: 0 }}>
            <strong>Instrukcja użycia:</strong> Każdy rozdział zawiera analizy, debaty, oraz zalecenia.
            Dodatek (Rozdział 6) zawiera 10 konkretnych planów implementacji dla Claude Code.
            Skopiuj plan dla interesującego Cię zalecenia i wklej w nowej sesji Claude Code.
          </p>
          <p style={{ marginBottom: 0, marginTop: 10 }}>
            <strong>Data audytu:</strong> 2026-06-14 | <strong>Następny audyt:</strong> 2026-12-31
          </p>
        </div>
      </div>
    </div>
  )
}
