"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Wallet, Plus, Loader2, Target, Trash2, ChevronLeft, PiggyBank, Check } from "lucide-react";
import { PageHeader, SectionHeading, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { formatMoney } from "@/lib/portfel";
import {
  createBudget, deleteBudget, type BudgetWithSpending,
  createGoal, deleteGoal, contributeGoal,
} from "@/actions/portfelBudgets";
import type { FinanceGoal } from "@prisma/client";

interface Props {
  budgets: BudgetWithSpending[];
  periodLabel: string;
  goals: FinanceGoal[];
  teams: { id: string; name: string }[];
}

export function BudgetsPage({ budgets, periodLabel, goals, teams }: Props) {
  const [isPending, startTransition] = useTransition();

  // budżet form
  const [bOpen, setBOpen] = useState(false);
  const [bCat, setBCat] = useState("");
  const [bLimit, setBLimit] = useState("");
  const [bTeam, setBTeam] = useState("");

  // cel form
  const [gOpen, setGOpen] = useState(false);
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState("");
  const [gCurrent, setGCurrent] = useState("");
  const [gDeadline, setGDeadline] = useState("");
  const [gTeam, setGTeam] = useState("");

  function addBudget() {
    if (!bCat.trim() || !bLimit) return;
    startTransition(async () => {
      await createBudget({ category: bCat.trim(), limitAmount: parseFloat(bLimit), ownerTeamId: bTeam || null });
      setBCat(""); setBLimit(""); setBTeam(""); setBOpen(false);
    });
  }

  function addGoal() {
    if (!gName.trim() || !gTarget) return;
    startTransition(async () => {
      await createGoal({
        name: gName.trim(),
        targetAmount: parseFloat(gTarget),
        currentAmount: gCurrent ? parseFloat(gCurrent) : 0,
        deadline: gDeadline || null,
        ownerTeamId: gTeam || null,
      });
      setGName(""); setGTarget(""); setGCurrent(""); setGDeadline(""); setGTeam(""); setGOpen(false);
    });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/portfel" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 4 }}>
          <ChevronLeft size={14} /> Portfel
        </Link>
        <PageHeader
          icon={<Target size={22} />}
          iconColor="var(--accent-amber)"
          title="Budżety i cele"
          href="/portfel/budzety"
          subtitle={`Limity wydatków (${periodLabel}) i cele oszczędnościowe`}
        />

        {/* ── Budżety ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SectionHeading>Budżety miesięczne</SectionHeading>
            <button onClick={() => setBOpen((v) => !v)} style={smallBtn}>
              <Plus size={13} /> Budżet
            </button>
          </div>

          {bOpen && (
            <div style={formRow}>
              <input autoFocus value={bCat} onChange={(e) => setBCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBudget()} placeholder="Kategoria (np. jedzenie)" style={inputStyle} />
              <input value={bLimit} onChange={(e) => setBLimit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBudget()} placeholder="Limit / mies." type="number" step="0.01" style={{ ...inputStyle, maxWidth: 150 }} />
              {teams.length > 0 && (
                <select value={bTeam} onChange={(e) => setBTeam(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }}>
                  <option value="">Mój (prywatny)</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <button onClick={addBudget} disabled={isPending || !bCat.trim() || !bLimit} style={primaryBtn}>
                {isPending ? <Loader2 size={13} className="animate-spin" /> : null} Dodaj
              </button>
              <button onClick={() => setBOpen(false)} style={cancelBtn}>Anuluj</button>
            </div>
          )}

          {budgets.length === 0 ? (
            <EmptyState icon={<Target size={28} />} message="Brak budżetów" hint="Ustaw miesięczny limit dla kategorii — postęp liczony jest z wydatków zaksięgowanych w Portfelu" cta={{ label: "+ Budżet", onClick: () => setBOpen(true), color: "var(--accent-amber)" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {budgets.map((b) => {
                const over = b.spent > b.limitAmount;
                const near = !over && b.pct >= 80;
                const barColor = over ? "var(--accent-red)" : near ? "var(--accent-amber)" : "var(--accent-green)";
                return (
                  <div key={b.id} style={card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1, textTransform: "capitalize" }}>{b.category}</span>
                      <span style={{ fontSize: 13, color: over ? "var(--accent-red)" : "var(--text-secondary)" }}>
                        {formatMoney(b.spent, b.currency)} / {formatMoney(b.limitAmount, b.currency)}
                      </span>
                      <button onClick={() => startTransition(() => { deleteBudget(b.id); })} title="Usuń budżet" style={iconBtn}><Trash2 size={13} /></button>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: "var(--bg-base)", overflow: "hidden", marginTop: 6 }}>
                      <div style={{ width: `${Math.min(100, b.pct)}%`, height: "100%", background: barColor, transition: "width .2s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.pct}% wykorzystane</span>
                      <span style={{ fontSize: 11, color: over ? "var(--accent-red)" : "var(--text-muted)" }}>
                        {over ? `Przekroczono o ${formatMoney(b.spent - b.limitAmount, b.currency)}` : `Zostało ${formatMoney(b.remaining, b.currency)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Cele ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SectionHeading>Cele oszczędnościowe</SectionHeading>
            <button onClick={() => setGOpen((v) => !v)} style={smallBtn}>
              <Plus size={13} /> Cel
            </button>
          </div>

          {gOpen && (
            <div style={formRow}>
              <input autoFocus value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Nazwa (np. Wakacje)" style={inputStyle} />
              <input value={gTarget} onChange={(e) => setGTarget(e.target.value)} placeholder="Cel (kwota)" type="number" step="0.01" style={{ ...inputStyle, maxWidth: 140 }} />
              <input value={gCurrent} onChange={(e) => setGCurrent(e.target.value)} placeholder="Już mam" type="number" step="0.01" style={{ ...inputStyle, maxWidth: 120 }} />
              <input value={gDeadline} onChange={(e) => setGDeadline(e.target.value)} type="date" title="Termin (opcjonalnie)" style={{ ...inputStyle, maxWidth: 160 }} />
              {teams.length > 0 && (
                <select value={gTeam} onChange={(e) => setGTeam(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }}>
                  <option value="">Mój (prywatny)</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <button onClick={addGoal} disabled={isPending || !gName.trim() || !gTarget} style={primaryBtn}>
                {isPending ? <Loader2 size={13} className="animate-spin" /> : null} Dodaj
              </button>
              <button onClick={() => setGOpen(false)} style={cancelBtn}>Anuluj</button>
            </div>
          )}

          {goals.length === 0 ? (
            <EmptyState icon={<PiggyBank size={28} />} message="Brak celów" hint="Wyznacz cel oszczędnościowy (np. wkład własny) i odkładaj wpłaty — pasek pokaże postęp" cta={{ label: "+ Cel", onClick: () => setGOpen(true), color: "var(--accent-amber)" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {goals.map((g) => <GoalCard key={g.id} goal={g} onChange={startTransition} pending={isPending} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalCard({ goal, onChange, pending }: { goal: FinanceGoal; onChange: (cb: () => void) => void; pending: boolean }) {
  const [add, setAdd] = useState("");
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
  const done = !!goal.achievedAt || goal.currentAmount >= goal.targetAmount;

  function contribute(sign: 1 | -1) {
    const v = parseFloat(add);
    if (!v || isNaN(v)) return;
    onChange(async () => { await contributeGoal(goal.id, sign * Math.abs(v)); setAdd(""); });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
          {done && <Check size={13} style={{ color: "var(--accent-green)", display: "inline", marginRight: 4 }} />}
          {goal.name}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {formatMoney(goal.currentAmount, goal.currency)} / {formatMoney(goal.targetAmount, goal.currency)}
        </span>
        <button onClick={() => onChange(() => { deleteGoal(goal.id); })} title="Usuń cel" style={iconBtn}><Trash2 size={13} /></button>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: "var(--bg-base)", overflow: "hidden", marginTop: 6 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: done ? "var(--accent-green)" : "var(--accent-amber)", transition: "width .2s" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {pct}%{goal.deadline ? ` · do ${new Date(goal.deadline).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
        </span>
        {!done && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && contribute(1)} placeholder="kwota" type="number" step="0.01" style={{ ...inputStyle, maxWidth: 90, padding: "5px 8px", fontSize: 12 }} />
            <button onClick={() => contribute(1)} disabled={pending || !add} style={{ ...primaryBtn, padding: "5px 10px" }}>+ Wpłać</button>
            <button onClick={() => contribute(-1)} disabled={pending || !add} title="Wycofaj" style={{ ...cancelBtn, padding: "5px 8px" }}>−</button>
          </div>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" };
const formRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", marginTop: 6, marginBottom: 6 };
const inputStyle: React.CSSProperties = { flex: 1, minWidth: 110, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 14, outline: "none" };
const smallBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" };
const primaryBtn: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent-amber)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 };
const cancelBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" };
const iconBtn: React.CSSProperties = { background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" };
