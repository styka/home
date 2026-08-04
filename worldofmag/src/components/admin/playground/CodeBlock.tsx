"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Blok kodu z kopiowaniem — linijka importu jest tym, po co najczęściej się tu wraca. */
export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Schowek bywa niedostępny (brak uprawnień, kontekst bez HTTPS) — kod i tak
      // widać na ekranie, więc milczymy zamiast straszyć błędem.
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <pre
        style={{
          background: "var(--bg-elevated)",
          border: "var(--border-width) var(--border-style) var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 48px 14px 14px",
          fontSize: 12,
          fontFamily: "var(--font-family-mono)",
          color: "var(--text-secondary)",
          overflowX: "auto",
          margin: 0,
        }}
      >
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label="Kopiuj"
        title="Kopiuj"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-control)",
          background: "var(--bg-surface)",
          border: "var(--border-width) var(--border-style) var(--border)",
          color: copied ? "var(--accent-green)" : "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
