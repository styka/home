"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Wallet, Plus, Loader2, ChevronRight, TrendingUp, TrendingDown, Users, PiggyBank, Target, BarChart3 } from "lucide-react";
import { PageHeader, SectionHeading, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { LineChart } from "@/components/ui/LineChart";
import { createElement, type WalletOverview } from "@/actions/portfel";
import { ELEMENT_KIND_LABELS, formatMoney } from "@/lib/portfel";

interface Props {
  overview: WalletOverview;
  teams: { id: string; name: string }[];
}

export function PortfelHomePage({ overview, teams }: Props) {
  const { elements, totalNet, currency, series, monthlyRate, projection6m, missingRates } = overview;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("account");
  const [initial, setInitial] = useState("");
  const [ownerTeamId, setOwnerTeamId] = useState("");
  const [isPending, startTransition] = useTransition();

  const active = elements.filter((e) => !e.archived);

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createElement({ name: name.trim(), kind, initialBalance: initial ? parseFloat(initial) : 0, ownerTeamId: ownerTeamId || null });
      setName(""); setKind("account"); setInitial(""); setOwnerTeamId(""); setAdding(false);
    });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<Wallet size={22} />}
          iconColor="var(--accent-green)"
          title="Portfel"
          href="/portfel"
          subtitle="Majątek netto i historia oszczędzania"
          action={
            <button onClick={() => setAdding((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
              <Plus size={13} /> Nowy element
            </button>
          }
        />

        {/* Podsumowanie */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          <div style={tile}>
            <span style={tileLabel}>Majątek netto</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: totalNet >= 0 ? "var(--text-primary)" : "var(--accent-red)" }}>{formatMoney(totalNet, currency)}</span>
          </div>
          <div style={tile}>
            <span style={tileLabel}>{monthlyRate >= 0 ? <><TrendingUp size={12} style={{ display: "inline" }} /> Tempo / mies.</> : <><TrendingDown size={12} style={{ display: "inline" }} /> Tempo / mies.</>}</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: monthlyRate >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>{monthlyRate >= 0 ? "+" : ""}{formatMoney(monthlyRate, currency)}</span>
          </div>
          <div style={tile}>
            <span style={tileLabel}><PiggyBank size={12} style={{ display: "inline" }} /> Prognoza 6 mies.</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text-secondary)" }}>{formatMoney(projection6m, currency)}</span>
          </div>
        </div>

        {missingRates && missingRates.length > 0 && (
          <Link href="/portfel/ustawienia" style={{ display: "block", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--accent-amber)", background: "rgba(245,158,11,0.08)", textDecoration: "none", fontSize: 12, color: "var(--text-secondary)" }}>
            ⚠ Brak kursu dla: <strong style={{ color: "var(--text-primary)" }}>{missingRates.join(", ")}</strong> — te konta liczone 1:1 do {currency}. Ustaw kursy w Ustawieniach.
          </Link>
        )}

        {/* Szybkie wejście: budżety i cele */}
        <Link href="/portfel/budzety" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", textDecoration: "none" }}>
          <Target size={18} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "block" }}>Budżety i cele</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Limity wydatków per kategoria + cele oszczędnościowe</span>
          </div>
          <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </Link>

        {/* Szybkie wejście: raporty miesięczne */}
        <Link href="/portfel/raporty" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", textDecoration: "none" }}>
          <BarChart3 size={18} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "block" }}>Raporty miesięczne</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Gdzie poszły pieniądze — podział wydatków na kategorie</span>
          </div>
          <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </Link>

        {/* Wykres majątku */}
        {series.length >= 2 && (
          <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <SectionHeading>Majątek w czasie</SectionHeading>
            <LineChart points={series} color="var(--accent-green)" height={170} formatY={(y) => formatMoney(y, currency)} />
          </div>
        )}

        {adding && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Nazwa (np. Konto ROR)" style={inputStyle} />
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle, maxWidth: 150 }}>
              {Object.entries(ELEMENT_KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={initial} onChange={(e) => setInitial(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Saldo początkowe" type="number" step="0.01" style={{ ...inputStyle, maxWidth: 160 }} />
            {teams.length > 0 && (
              <select value={ownerTeamId} onChange={(e) => setOwnerTeamId(e.target.value)} style={{ ...inputStyle, maxWidth: 170 }}>
                <option value="">Mój (prywatny)</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <button onClick={handleCreate} disabled={isPending || !name.trim()} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent-green)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {isPending ? <Loader2 size={13} className="animate-spin" /> : null} Dodaj
            </button>
            <button onClick={() => setAdding(false)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Anuluj</button>
          </div>
        )}

        <div>
          <SectionHeading>Elementy portfela</SectionHeading>
          {active.length === 0 ? (
            <EmptyState icon={<Wallet size={28} />} message="Brak elementów" hint="Dodaj konto, oszczędności, inwestycję lub dług — każda zmiana salda jest zapisywana w historii" cta={{ label: "+ Nowy element", onClick: () => setAdding(true), color: "var(--accent-green)" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {active.map((el) => {
                const isDebt = el.kind === "debt";
                return (
                  <Link key={el.id} href={`/portfel/${el.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", textDecoration: "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{el.name}</span>
                        {el.ownerTeamId && <Users size={11} style={{ color: "var(--accent-purple)" }} />}
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ELEMENT_KIND_LABELS[el.kind] ?? el.kind}</span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: isDebt ? "var(--accent-red)" : "var(--text-primary)" }}>
                      {isDebt ? "−" : ""}{formatMoney(el.balance, el.currency)}
                    </span>
                    <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const tile: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" };
const tileLabel: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 };
const inputStyle: React.CSSProperties = { flex: 1, minWidth: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 14, outline: "none" };
