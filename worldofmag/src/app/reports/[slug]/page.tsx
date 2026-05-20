import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserReport } from "@/actions/reports";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { BookOpen, ArrowLeft, Calendar, Tag } from "lucide-react";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  refactoring: { label: "Refaktoryzacja", color: "var(--accent-purple)" },
  architecture: { label: "Architektura", color: "var(--accent-blue)" },
  security: { label: "Bezpieczeństwo", color: "var(--accent-red)" },
  performance: { label: "Wydajność", color: "var(--accent-green)" },
  general: { label: "Ogólny", color: "var(--text-muted)" },
  proposal: { label: "Propozycja", color: "var(--accent-amber)" },
  ux: { label: "UX", color: "var(--accent-purple)" },
};

function formatDateTimeFull(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export default async function UserReportPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  let report;
  try {
    report = await getUserReport(params.slug);
  } catch {
    redirect("/reports");
  }
  if (!report) notFound();

  const cat = CATEGORY_LABELS[report.category] ?? CATEGORY_LABELS.general;
  const html = markdownToHtml(report.content);

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
      <style>{MARKDOWN_STYLES}</style>

      {/* Top bar */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg-surface)",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <Link href="/reports" style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "var(--text-muted)", textDecoration: "none",
        }}>
          <ArrowLeft size={14} />
          Raporty
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span style={{
          fontSize: 12, color: "var(--text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {report.title}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: "28px 16px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `${cat.color}18`, border: `1px solid ${cat.color}40`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <BookOpen size={18} style={{ color: cat.color }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>
              {report.title}
            </h1>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <span style={{
              fontSize: 11, padding: "3px 9px", borderRadius: 999,
              background: `${cat.color}18`, color: cat.color,
              fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" as const,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <Tag size={10} />
              {cat.label}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Calendar size={12} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {formatDateTimeFull(report.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--border)", marginBottom: 24 }} />

        <div
          className="md-content"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ lineHeight: 1.7 }}
        />
      </div>
    </div>
  );
}
