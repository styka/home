"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import type { AiCoverage, CoverageStatus, CoverageKind, CoverageEntry } from "@/lib/ai/coverage";

// Panel admina: pełna lista akcji użytkownika (mutacje + odczyty) z informacją,
// czy asystent AI ma do nich dostęp. Dane pochodzą z manifestu pokrycia
// (`src/lib/ai/action-coverage.json`), pilnowanego przez bramkę build'u —
// więc lista jest zawsze aktualna wobec wdrożonego kodu.

const STATUS_META: Record<CoverageStatus, { label: string; color: string; bg: string }> = {
  ai: { label: "AI ma dostęp", color: "var(--accent-green)", bg: "color-mix(in srgb, var(--accent-green) 15%, transparent)" },
  pending: { label: "Do zrobienia", color: "var(--accent-amber)", bg: "color-mix(in srgb, var(--accent-amber) 15%, transparent)" },
  excluded: { label: "Wykluczone", color: "var(--text-muted)", bg: "var(--bg-hover)" },
};

const REASON_LABEL: Record<string, string> = {
  admin: "administracja / RBAC / system",
  settings: "ustawienia / preferencje",
  internal: "wewnętrzne / techniczne",
  interactive: "interaktywne (pliki/UI/edycja rekordu)",
  teams: "współpraca / zespoły",
  account: "operacje konta",
  dictionary: "słownik konfiguracyjny",
  niche: "niszowe / eksperymentalne",
  redundant: "pokryte inną akcją",
};

type StatusFilter = "all" | CoverageStatus;
type KindFilter = "all" | CoverageKind;

function Badge({ status }: { status: CoverageStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius)", fontSize: 11, fontWeight: 600, color: m.color, background: m.bg, whiteSpace: "nowrap" }}>
      {m.label}
    </span>
  );
}

function Stat({ label, counts }: { label: string; counts: { ai: number; pending: number; excluded: number; total: number } }) {
  return (
    <div style={{ flex: 1, minWidth: 220, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: "var(--accent-green)" }}>{counts.ai}</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>/ {counts.total} dostępnych dla AI</span>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 12, color: "var(--text-secondary)" }}>
        <span style={{ color: "var(--accent-amber)" }}>{counts.pending} do zrobienia</span>
        <span style={{ color: "var(--text-muted)" }}>{counts.excluded} wykluczone</span>
      </div>
    </div>
  );
}

export function AiCoveragePage({ coverage }: { coverage: AiCoverage }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return coverage.modules
      .map((mod) => ({
        ...mod,
        entries: mod.entries.filter((e) => {
          if (status !== "all" && e.status !== status) return false;
          if (kind !== "all" && e.kind !== kind) return false;
          if (query && !e.fn.toLowerCase().includes(query) && !e.module.toLowerCase().includes(query) && !(e.action ?? "").toLowerCase().includes(query)) return false;
          return true;
        }),
      }))
      .filter((mod) => mod.entries.length > 0);
  }, [coverage.modules, status, kind, q]);

  const shownCount = filtered.reduce((n, m) => n + m.entries.length, 0);

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px 64px" }}>
      <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 16 }}>
        <ChevronLeft size={15} /> Panel admina
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Pokrycie akcji przez asystenta AI</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.5 }}>
        Pełna lista akcji użytkownika — <strong>mutacji</strong> (zapis) i <strong>odczytów</strong> (podgląd danych) — z informacją,
        czy asystent AI ma do nich dostęp. Lista jest generowana z manifestu pokrycia, którego kompletność wymusza bramka build'u
        (<code>check:ai-coverage</code>), więc jest zawsze aktualna wobec wdrożonego kodu.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <Stat label="Mutacje (zapis danych)" counts={coverage.mutation} />
        <Stat label="Odczyty (podgląd danych)" counts={coverage.read} />
      </div>

      {/* Filtry */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj akcji / modułu…"
            style={{ width: "100%", padding: "8px 8px 8px 32px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-primary)", fontSize: 13 }}
          />
        </div>
        <SegBtns<StatusFilter>
          value={status} onChange={setStatus}
          options={[["all", "Wszystkie"], ["ai", "AI ✓"], ["pending", "Do zrobienia"], ["excluded", "Wykluczone"]]}
        />
        <SegBtns<KindFilter>
          value={kind} onChange={setKind}
          options={[["all", "Zapis+odczyt"], ["mutation", "Zapis"], ["read", "Odczyt"]]}
        />
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>Pokazano {shownCount} akcji.</p>

      {filtered.map((mod) => (
        <section key={mod.module} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "baseline", gap: 8 }}>
            {mod.module}
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>{mod.aiCount}/{mod.total} dla AI</span>
          </h2>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            {mod.entries.map((e, i) => (
              <Row key={e.key} entry={e} last={i === mod.entries.length - 1} />
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 32 }}>Brak akcji spełniających filtry.</p>
      )}
      </div>
    </div>
  );
}

function Row({ entry, last }: { entry: CoverageEntry; last: boolean }) {
  const note = entry.status === "ai" ? (entry.action ? `→ ${entry.action}` : "") : entry.reason ? (REASON_LABEL[entry.reason] ?? entry.reason) : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: last ? "none" : "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: "var(--radius)", fontSize: 10, color: "var(--text-muted)", background: "var(--bg-hover)", flexShrink: 0 }}>
        {entry.kind === "read" ? "odczyt" : "zapis"}
      </span>
      <code style={{ fontSize: 13, color: "var(--text-primary)", flexShrink: 0 }}>{entry.fn}</code>
      <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note}</span>
      <Badge status={entry.status} />
    </div>
  );
}

function SegBtns<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      {options.map(([val, label]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          style={{
            padding: "8px 12px", fontSize: 12, cursor: "pointer", border: "none",
            background: value === val ? "var(--accent-blue)" : "var(--bg-surface)",
            color: value === val ? "var(--on-accent)" : "var(--text-secondary)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
