"use client";

import { useEffect } from "react";
import "./globals.css";
import { reportClientError } from "@/lib/observability/report";

/**
 * Z-111: globalna granica błędu (zastępuje cały root layout, więc renderuje własne
 * <html>/<body>). Łapie błędy, których nie złapał `app/error.tsx` (np. w samym
 * layoutcie). Minimalny, samodzielny UI — bez AppShell.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { source: "global-error-boundary" });
  }, [error]);

  return (
    <html lang="pl">
      <body
        style={{
          margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--bg-base, #0d0d0d)", color: "var(--text-primary, #ffffff)",
          fontFamily: "system-ui, -apple-system, sans-serif", padding: 20,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Aplikacja napotkała błąd</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary, #b0b0b0)", lineHeight: 1.5 }}>
            Przepraszamy, coś poszło nie tak. Spróbuj ponownie lub odśwież stronę.
          </div>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "9px 18px", background: "var(--accent-blue, #3b82f6)", border: "none",
              borderRadius: 6, color: "#fff", fontSize: 14, cursor: "pointer",
            }}
          >
            Spróbuj ponownie
          </button>
          {error.digest ? <div style={{ fontSize: 11, color: "var(--text-muted, #808080)" }}>Kod błędu: {error.digest}</div> : null}
        </div>
      </body>
    </html>
  );
}
