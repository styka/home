"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { PageHeader, SectionHeading, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { formatMoney } from "@/lib/portfel";
import { getMonthlyReport, type MonthlyReport } from "@/actions/portfelReports";

const CAT_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

export function MonthlyReportPage({ initial }: { initial: MonthlyReport }) {
  const [report, setReport] = useState<MonthlyReport>(initial);
  const [pending, startTransition] = useTransition();

  function navigate(offset: number) {
    if (offset < 0) return; // przyszłość niedostępna
    startTransition(async () => {
      const r = await getMonthlyReport(offset);
      setReport(r);
    });
  }

  const { label, income, expense, net, currency, byCategory, expenseDeltaPct, monthOffset, hasOlder } = report;

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/portfel" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 4 }}>
          <ChevronLeft size={14} /> Portfel
        </Link>
        <PageHeader
          icon={<BarChart3 size={22} />}
          iconColor="var(--accent-blue)"
          title="Raporty miesięczne"
          href="/portfel/raporty"
          subtitle="Gdzie poszły pieniądze — przychody, wydatki i podział na kategorie"
        />

        {/* Nawigacja miesiąca */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <button onClick={() => navigate(monthOffset + 1)} disabled={pending || !hasOlder} style={navBtn(pending || !hasOlder)} title="Starszy miesiąc">
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize", display: "flex", alignItems: "center", gap: 6 }}>
            {pending && <Loader2 size={13} className="animate-spin" />} {label}
          </span>
          <button onClick={() => navigate(monthOffset - 1)} disabled={pending || monthOffset === 0} style={navBtn(pending || monthOffset === 0)} title="Nowszy miesiąc">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Podsumowanie */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          <div style={tile}>
            <span style={tileLabel}><TrendingUp size={12} style={{ display: "inline" }} /> Przychody</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-green)" }}>{formatMoney(income, currency)}</span>
          </div>
          <div style={tile}>
            <span style={tileLabel}><TrendingDown size={12} style={{ display: "inline" }} /> Wydatki</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-red)" }}>{formatMoney(expense, currency)}</span>
            {expenseDeltaPct !== null && (
              <span style={{ fontSize: 11, color: expenseDeltaPct > 0 ? "var(--accent-red)" : "var(--accent-green)" }}>
                {expenseDeltaPct > 0 ? "▲" : "▼"} {Math.abs(expenseDeltaPct)}% vs poprzedni mies.
              </span>
            )}
          </div>
          <div style={tile}>
            <span style={tileLabel}>Bilans</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: net >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
              {net >= 0 ? "+" : ""}{formatMoney(net, currency)}
            </span>
          </div>
        </div>

        {/* Podział wydatków na kategorie */}
        <div>
          <SectionHeading>Wydatki wg kategorii</SectionHeading>
          {byCategory.length === 0 ? (
            <EmptyState icon={<BarChart3 size={28} />} message="Brak wydatków w tym miesiącu" hint="Dodawaj rozchody z kategorią w elementach portfela — tu pojawi się podział" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {byCategory.map((c, i) => (
                <div key={c.category} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1, textTransform: "capitalize" }}>{c.category}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{formatMoney(c.amount, currency)}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 34, textAlign: "right" }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-base)", overflow: "hidden" }}>
                    <div style={{ width: `${c.pct}%`, height: "100%", background: CAT_COLORS[i % CAT_COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const tile: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" };
const tileLabel: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 };
function navBtn(disabled: boolean): React.CSSProperties {
  return { display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: disabled ? "var(--text-muted)" : "var(--text-secondary)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 };
}
