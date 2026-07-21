"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, Bug, RefreshCw, Copy, Check } from "lucide-react";
import { getRecentAiCalls, type AiCallLogRow } from "@/actions/llmConfig";

// Diagnostyka asystenta AI: surowy log wywołań LLM (per rozmowa), łącznie z
// wywołaniami NIEUDANYMI (status/błąd/liczba prób). Admin może odfiltrować po
// conversationId i skopiować przebieg do wklejenia (np. do Claude Code).

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pl-PL", { hour12: false });
  } catch {
    return iso;
  }
}

function rowsToText(rows: AiCallLogRow[]): string {
  const head = "czas | źródło | op | dostawca | model | ok | status | próby | prompt+compl=total tok | latency ms | conversationId | błąd";
  const lines = rows.map((r) =>
    [
      fmtTime(r.createdAt),
      r.source ?? "—",
      r.operationType,
      r.providerKind,
      r.model,
      r.ok ? "OK" : "FAIL",
      r.status ?? "—",
      r.attempts,
      `${r.promptTokens}+${r.completionTokens}=${r.totalTokens}`,
      r.latencyMs,
      r.conversationId ?? "—",
      r.errorText ? r.errorText.replace(/\s+/g, " ") : "",
    ].join(" | ")
  );
  return [head, ...lines].join("\n");
}

export function AiCallsPage({ initial }: { initial: AiCallLogRow[] }) {
  const [rows, setRows] = useState<AiCallLogRow[]>(initial);
  const [convId, setConvId] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const next = await getRecentAiCalls({ conversationId: convId.trim() || undefined, limit: 200 });
      setRows(next);
    });
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(rowsToText(rows));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* schowek niedostępny */
    }
  }

  const cell: React.CSSProperties = { padding: "6px 8px", fontSize: 12, whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" };

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} /> Admin
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Bug size={20} style={{ color: "var(--accent-amber)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Diagnostyka asystenta AI</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.5 }}>
          Surowy log wywołań modelu (tabela <code>AiCall</code>) — łącznie z <strong>nieudanymi</strong>{" "}
          (status dostawcy, treść błędu, liczba prób). Wklej <code>conversationId</code> z rozmowy, kliknij{" "}
          <strong>Odśwież</strong>, a potem <strong>Kopiuj</strong> — i wklej mi tu przebieg.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            value={convId}
            onChange={(e) => setConvId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") refresh(); }}
            placeholder="conversationId (puste = ostatnie wywołania)"
            style={{ flex: "1 1 320px", minWidth: 220, padding: "8px 10px", fontSize: 13, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)" }}
          />
          <button
            onClick={refresh}
            disabled={pending}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", cursor: "pointer" }}
          >
            <RefreshCw size={14} className={pending ? "animate-spin" : undefined} /> Odśwież
          </button>
          <button
            onClick={copyAll}
            disabled={rows.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, background: "var(--accent-blue)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--on-accent)", cursor: "pointer" }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Skopiowano" : "Kopiuj"}
          </button>
        </div>

        {rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak wpisów (dla tego filtra).</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface)", textAlign: "left", color: "var(--text-secondary)" }}>
                  {["czas", "źródło", "op", "dostawca", "model", "wynik", "próby", "tokeny (p+c=t)", "latency", "błąd"].map((h) => (
                    <th key={h} style={{ ...cell, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ color: "var(--text-primary)", background: r.ok ? undefined : "color-mix(in srgb, var(--accent-red) 12%, transparent)" }}>
                    <td style={cell}>{fmtTime(r.createdAt)}</td>
                    <td style={cell}>{r.source ?? "—"}</td>
                    <td style={cell}>{r.operationType}</td>
                    <td style={cell}>{r.providerKind}</td>
                    <td style={cell}>{r.model}</td>
                    <td style={{ ...cell, color: r.ok ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 600 }}>
                      {r.ok ? "OK" : `FAIL ${r.status ?? ""}`}
                    </td>
                    <td style={cell}>{r.attempts}</td>
                    <td style={cell}>{r.promptTokens}+{r.completionTokens}={r.totalTokens}</td>
                    <td style={cell}>{r.latencyMs} ms</td>
                    <td style={{ ...cell, whiteSpace: "normal", maxWidth: 320, color: "var(--text-muted)" }}>{r.errorText ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
