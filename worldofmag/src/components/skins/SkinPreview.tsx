"use client";

import { resolveTokens, tokensToStyle, type SkinTokens } from "@/lib/skins";

/** Miniatura skórki — renderuje przykładowy „chrom" aplikacji ze zmiennymi danej
 *  skórki zastosowanymi lokalnie (scoped), więc pokazuje wygląd bez zmiany całej strony. */
export function SkinPreview({ tokens, compact = false }: { tokens: SkinTokens; compact?: boolean }) {
  const full = resolveTokens(tokens);
  const style = tokensToStyle(full);

  return (
    <div
      style={{
        ...style,
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        padding: compact ? 10 : 14,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 8 : 10,
        overflow: "hidden",
        fontSize: "var(--font-size-base)",
      }}
    >
      {/* pasek z „akcentem" */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent-blue)" }} />
        <div style={{ height: 8, flex: 1, borderRadius: "var(--radius)", background: "var(--bg-elevated)" }} />
      </div>
      {/* karta powierzchni */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: compact ? 8 : 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: compact ? 12 : 13 }}>Aa</div>
        <div style={{ color: "var(--text-secondary)", fontSize: compact ? 10 : 11 }}>Tekst drugorzędny</div>
        <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
          <span style={{ background: "var(--accent-blue)", color: "var(--on-accent)", padding: "3px 8px", borderRadius: "var(--radius)", fontSize: 10, fontWeight: 500 }}>
            Akcent
          </span>
          <span style={{ background: "var(--accent-green)", color: "var(--on-accent)", padding: "3px 8px", borderRadius: "var(--radius)", fontSize: 10, fontWeight: 500 }}>
            OK
          </span>
          <span style={{ background: "var(--accent-red)", color: "var(--on-accent)", padding: "3px 8px", borderRadius: "var(--radius)", fontSize: 10, fontWeight: 500 }}>
            Uwaga
          </span>
        </div>
      </div>
    </div>
  );
}
