import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserReportsMeta } from "@/actions/reports";
import { BookOpen, ChevronRight, Calendar, User } from "lucide-react";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  refactoring: { label: "Refaktoryzacja", color: "var(--accent-purple)" },
  architecture: { label: "Architektura", color: "var(--accent-blue)" },
  security: { label: "Bezpieczeństwo", color: "var(--accent-red)" },
  performance: { label: "Wydajność", color: "var(--accent-green)" },
  general: { label: "Ogólny", color: "var(--text-muted)" },
  proposal: { label: "Propozycja", color: "var(--accent-amber)" },
  ux: { label: "UX", color: "var(--accent-purple)" },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default async function UserReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const reports = await getUserReportsMeta();
  const catInfo = (cat: string) => CATEGORY_LABELS[cat] ?? CATEGORY_LABELS.general;

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <BookOpen size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Raporty
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, marginTop: 4 }}>
          Analizy, propozycje i dokumentacja projektu.
        </p>

        {reports.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "48px 24px",
            border: "1px dashed var(--border)", borderRadius: 12,
            color: "var(--text-muted)", fontSize: 13,
          }}>
            Brak dostępnych raportów.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reports.map((report) => {
              const cat = catInfo(report.category);
              return (
                <Link key={report.id} href={`/reports/${report.slug}`} style={{ textDecoration: "none" }}>
                  <div className="report-card" style={{
                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: `${cat.color}18`, border: `1px solid ${cat.color}40`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <BookOpen size={15} style={{ color: cat.color }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                          {report.title}
                        </span>
                        <span style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 999,
                          background: `${cat.color}18`, color: cat.color,
                          fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" as const,
                          flexShrink: 0,
                        }}>
                          {cat.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={10} style={{ color: "var(--text-muted)" }} />
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(report.createdAt)}</span>
                        </div>
                        {report.authorName && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <User size={10} style={{ color: "var(--text-muted)" }} />
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{report.authorName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style>{`.report-card:hover { background: var(--bg-elevated) !important; }`}</style>
    </div>
  );
}
