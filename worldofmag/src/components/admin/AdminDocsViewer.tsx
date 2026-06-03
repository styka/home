"use client";

import { useState } from "react";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { FileText, AlertTriangle } from "lucide-react";
import type { AdminDoc } from "@/generated/admin-docs";

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  return `${(b / 1024).toFixed(1)} KB`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export function AdminDocsViewer({ docs, generatedAt }: { docs: AdminDoc[]; generatedAt: string }) {
  const [active, setActive] = useState(docs[0]?.key ?? "");
  const doc = docs.find((d) => d.key === active) ?? docs[0];

  if (!doc) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Brak dokumentów do wyświetlenia.
      </p>
    );
  }

  const html = markdownToHtml(doc.content);

  return (
    <div>
      <style>{MARKDOWN_STYLES}</style>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {docs.map((d) => {
          const isActive = d.key === active;
          return (
            <button
              key={d.key}
              onClick={() => setActive(d.key)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 13px", borderRadius: 8,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                background: isActive ? "var(--bg-elevated)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                border: `1px solid ${isActive ? "var(--border)" : "transparent"}`,
              }}
            >
              <FileText size={14} style={{ color: isActive ? "var(--accent-blue)" : "var(--text-muted)" }} />
              {d.title}
            </button>
          );
        })}
      </div>

      {/* Meta bar */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center",
        padding: "10px 14px", marginBottom: 16,
        background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8,
        fontSize: 12, color: "var(--text-muted)",
      }}>
        <span>{doc.lines} linii</span>
        <span>{fmtBytes(doc.bytes)}</span>
        <span>Zmodyfikowano: {fmtDate(doc.updatedAt)}</span>
        <span style={{ marginLeft: "auto" }}>Zsynchronizowano przy buildzie: {fmtDate(generatedAt)}</span>
      </div>

      {!doc.found && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", marginBottom: 16, borderRadius: 8,
          background: "color-mix(in srgb, var(--accent-amber) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent-amber) 40%, transparent)",
          color: "var(--accent-amber)", fontSize: 12,
        }}>
          <AlertTriangle size={14} />
          Pliku nie znaleziono podczas builda — wyświetlana jest treść zastępcza.
        </div>
      )}

      {/* Content */}
      <div
        className="md-content"
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ lineHeight: 1.7 }}
      />
    </div>
  );
}
