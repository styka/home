"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Calendar, User, Plus, Layers, Search } from "lucide-react";
import { PageHeader, StatTile, SectionHeading, ManagementGrid, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { getCategoryInfo } from "@/lib/reportCategories";
import { searchReports } from "@/actions/reports";

export interface ReportSummary {
  id: string;
  title: string;
  slug: string;
  category: string;
  authorId: string | null;
  teamId: string | null;
  authorName: string | null;
  createdAt: string;
}

interface ReportsHomePageProps {
  reports: ReportSummary[];
  myCount: number;
  teamCount: number;
  isAdmin: boolean;
}

export function ReportsHomePage({ reports, myCount, teamCount, isAdmin }: ReportsHomePageProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReportSummary[] | null>(null);
  const [pending, startTransition] = useTransition();

  // R2: szukanie po tytule ORAZ treści — serwerowo, z debounce. Pusta fraza → pełna lista.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); return; }
    const h = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchReports(q);
        setResults(rows.map((r) => ({
          id: r.id, title: r.title, slug: r.slug, category: r.category,
          authorId: r.authorId, teamId: r.teamId, authorName: r.authorName ?? null,
          createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
        })));
      });
    }, 300);
    return () => clearTimeout(h);
  }, [query]);

  const filtered = query.trim() ? (results ?? []) : reports;
  const total = reports.length;
  const latest = reports[0];

  const byCategory = new Map<string, number>();
  for (const r of reports) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
  }
  const categoryEntries = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);

  const subtitle =
    total === 0
      ? "Brak raportów do podglądu"
      : latest
      ? `${total} ${pluralizePolish(total, "raport", "raporty", "raportów")} · ostatni ${relativeTime(latest.createdAt)}`
      : `${total} ${pluralizePolish(total, "raport", "raporty", "raportów")}`;

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<BookOpen size={22} />}
          iconColor="var(--accent-purple)"
          title="Raporty"
          subtitle={subtitle}
          action={
            isAdmin ? (
              <Link
                href="/admin/reports"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                <Plus size={13} />
                Nowy raport
              </Link>
            ) : undefined
          }
        />

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <StatTile value={total} label="Wszystkie" color="var(--accent-purple)" />
          {myCount > 0 && (
            <StatTile value={myCount} label="Moje" color="var(--accent-blue)" icon={<User size={14} />} />
          )}
          {teamCount > 0 && (
            <StatTile value={teamCount} label="Zespołowe" color="var(--accent-green)" />
          )}
          <StatTile
            value={categoryEntries.length}
            label="Kategorie"
            color="var(--accent-amber)"
            icon={<Layers size={14} />}
          />
        </div>

        {/* Wyszukiwarka */}
        {total > 0 && (
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              type="search"
              placeholder="Szukaj raportu…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Wszystkie raporty — pełna, klikalna lista (każdy wiersz → szczegóły) */}
        <div>
          <SectionHeading>
            {query.trim() ? `Wyniki (${filtered.length})` : "Wszystkie raporty"}
          </SectionHeading>
          {reports.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={28} />}
              message="Brak raportów"
              hint={isAdmin ? "Utwórz pierwszy raport w panelu admina" : "Raporty zostaną tu pokazane gdy się pojawią"}
              cta={isAdmin ? { label: "Otwórz panel", href: "/admin/reports", color: "var(--accent-purple)" } : undefined}
            />
          ) : query.trim() && pending && results === null ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "12px 0" }}>Szukam…</p>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "12px 0" }}>Brak wyników dla „{query}" (przeszukano też treść)</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((r) => (
                <ReportRow key={r.id} report={r} />
              ))}
            </div>
          )}
        </div>

        {/* By category */}
        {categoryEntries.length >= 2 && (
          <div>
            <SectionHeading>Według kategorii</SectionHeading>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              {categoryEntries.map(([cat, count]) => {
                const info = getCategoryInfo(cat);
                return (
                  <div
                    key={cat}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--bg-surface)",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: info.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {info.label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: info.color,
                        background: `${info.color}1a`,
                        padding: "2px 8px",
                        borderRadius: 10,
                        flexShrink: 0,
                      }}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Management — pokazujemy tylko gdy są realne miejsca do przejścia.
            Wcześniej kafelek „Wszystkie raporty" linkował do /reports (tej samej
            strony) — martwy link, przez który „nie dało się nigdzie przejść". */}
        {isAdmin && (
          <div>
            <SectionHeading>Zarządzanie</SectionHeading>
            <ManagementGrid
              items={[
                { href: "/admin/reports", icon: <Plus size={16} />, label: "Panel admina", color: "var(--accent-purple)" },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ReportRow({ report }: { report: ReportSummary }) {
  const info = getCategoryInfo(report.category);
  return (
    <Link
      href={`/reports/${report.slug}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        textDecoration: "none",
        transition: "background 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
        e.currentTarget.style.borderColor = "var(--border-focus)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: `${info.color}18`,
          border: `1px solid ${info.color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <BookOpen size={15} style={{ color: info.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {report.title}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 999,
              background: `${info.color}18`,
              color: info.color,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {info.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={10} />
            {formatDate(report.createdAt)}
          </span>
          {report.authorName && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <User size={10} />
              {report.authorName}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
    </Link>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "dziś";
  if (diffDays === 1) return "wczoraj";
  if (diffDays < 7) return `${diffDays} dni temu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tyg. temu`;
  return `${Math.floor(diffDays / 30)} mies. temu`;
}

function pluralizePolish(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few;
  return many;
}
