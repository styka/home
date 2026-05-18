import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookOpen, ChevronRight, ChevronLeft, Tag, Calendar } from "lucide-react";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  refactoring: { label: "Refaktoryzacja", color: "var(--accent-purple)" },
  architecture: { label: "Architektura", color: "var(--accent-blue)" },
  security: { label: "Bezpieczeństwo", color: "var(--accent-red)" },
  performance: { label: "Wydajność", color: "var(--accent-green)" },
  general: { label: "Ogólny", color: "var(--text-muted)" },
};

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function ReportsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, category: true, createdAt: true },
  });

  const catInfo = (cat: string) => CATEGORY_LABELS[cat] ?? CATEGORY_LABELS.general;

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} />
          Admin
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <BookOpen size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Raporty
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 32, marginTop: 4 }}>
          Archiwum raportów technicznych, analiz i dokumentacji projektowej.
        </p>

        {/* Reports list */}
        {reports.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              border: "1px dashed var(--border)",
              borderRadius: 12,
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            Brak raportów. Dodaj pierwszy raport przez seed lub bezpośrednio do bazy danych.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reports.map((report) => {
              const cat = catInfo(report.category);
              return (
                <Link
                  key={report.id}
                  href={`/admin/reports/${report.slug}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="report-card"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: `${cat.color}18`,
                        border: `1px solid ${cat.color}40`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <BookOpen size={16} style={{ color: cat.color }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                          {report.title}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 7px",
                            borderRadius: 999,
                            background: `${cat.color}18`,
                            color: cat.color,
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            flexShrink: 0,
                          }}
                        >
                          {cat.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Calendar size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {formatDateTime(report.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>

      <style>{`
        .report-card:hover {
          background: var(--bg-elevated) !important;
        }
      `}</style>
    </div>
  );
}
