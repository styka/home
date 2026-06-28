"use client";

import Link from "next/link";
import { ChevronLeft, Activity, CheckCircle2, XCircle, Database, Cpu, Plug, Gauge } from "lucide-react";
import type { SystemHealth, HealthCheck } from "@/actions/systemHealth";

export function SystemHealthPage({ health }: { health: SystemHealth }) {
  const { build, db, llm, integrations, counts, audit, queryDiagnostics } = health;

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} /> Admin
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <Activity size={20} style={{ color: "var(--accent-green)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Zdrowie systemu</h1>
        </div>

        {/* Baza danych */}
        <Card title="Baza danych" icon={<Database size={15} style={{ color: "var(--accent-blue)" }} />}>
          <Row label="Połączenie" value={<StatusDot ok={db.ok} text={db.ok ? `OK (${db.latencyMs} ms)` : "Brak połączenia"} />} />
          <Row label="Zastosowane migracje" value={String(db.migrations)} />
          <Row label="Ostatnia migracja" value={<span className="mono" style={{ fontSize: 12 }}>{db.lastMigration ?? "—"}</span>} />
        </Card>

        {/* LLM */}
        <Card title="Modele LLM" icon={<Cpu size={15} style={{ color: "var(--accent-purple)" }} />}>
          <Row label="Status" value={<StatusDot ok={llm.ready} text={llm.ready ? "Skonfigurowane" : "Brak działającego modelu"} />} />
          <Row label="Dostawcy (aktywni / wszyscy)" value={`${llm.enabledProviders} / ${llm.providers}`} />
          {llm.legacyGroq && <Row label="Klucz Groq (legacy)" value={<StatusDot ok text="ustawiony" />} />}
          <div style={{ marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            {llm.assignments.map((a) => <CheckRow key={a.label} c={a} />)}
          </div>
        </Card>

        {/* Integracje */}
        <Card title="Integracje" icon={<Plug size={15} style={{ color: "var(--accent-amber)" }} />}>
          {integrations.map((c) => <CheckRow key={c.label} c={c} />)}
        </Card>

        {/* Build */}
        <Card title="Wersja (build)">
          <Row label="Gałąź" value={<span className="mono" style={{ fontSize: 12 }}>{build.branch}</span>} />
          <Row label="Commit" value={<span className="mono" style={{ fontSize: 12 }}>{build.commit}</span>} />
          <Row label="Data buildu" value={<span style={{ fontSize: 12 }}>{build.buildDate}</span>} />
          <Row label="Opis commita" value={<span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{build.commitMsg}</span>} />
        </Card>

        {/* Dane */}
        <Card title="Dane">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {counts.map((c) => (
              <div key={c.label} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{c.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.label}</div>
              </div>
            ))}
          </div>
          <Row label="Wpisy audytu" value={`${audit.total}${audit.last ? ` · ostatni ${new Date(audit.last).toLocaleString("pl-PL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}`} />
        </Card>

        {/* Diagnostyka zapytań (Z-037) — EXPLAIN typowych list, monitor regresów wydajności bazy. */}
        <Card title="Diagnostyka zapytań (EXPLAIN)" icon={<Gauge size={15} style={{ color: "var(--accent-blue)" }} />}>
          {queryDiagnostics.length === 0 ? (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak danych do próbki (pusta baza).</span>
          ) : (
            <>
              {queryDiagnostics.map((q) => (
                <div key={q.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "2px 0" }}>
                  <ScanBadge scanType={q.scanType} />
                  <span style={{ color: "var(--text-primary)", flex: 1 }}>{q.label}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    koszt ~{Math.round(q.estCost)}{q.indexes.length ? ` · ${q.indexes.join(", ")}` : ""}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                Monitor regresów. „Seq" na małych tabelach jest normalny; sygnałem jest Seq Scan na dużej, gorącej liście (utracony indeks).
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        {icon}
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
      </div>
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function CheckRow({ c }: { c: HealthCheck }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "2px 0" }}>
      {c.ok ? <CheckCircle2 size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} /> : <XCircle size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      <span style={{ color: "var(--text-primary)", flex: 1 }}>{c.label}</span>
      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{c.detail}</span>
    </div>
  );
}

function StatusDot({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: ok ? "var(--accent-green)" : "var(--accent-red)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }} />
      {text}
    </span>
  );
}

function ScanBadge({ scanType }: { scanType: string }) {
  const map: Record<string, { label: string; color: string }> = {
    index: { label: "index", color: "var(--accent-green)" },
    seq: { label: "seq", color: "var(--accent-amber)" },
    other: { label: "—", color: "var(--text-muted)" },
  };
  const s = map[scanType] ?? map.other;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: s.color, border: `1px solid ${s.color}`, borderRadius: 4, padding: "1px 5px", flexShrink: 0, minWidth: 40, textAlign: "center" }}>
      {s.label}
    </span>
  );
}
