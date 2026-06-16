"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Z-111: spójny stan błędu (ikona + komunikat + „spróbuj ponownie"). Używany przez
 * `app/error.tsx` (granica błędu segmentu) i może być reużyty w komponentach, które
 * łapią błędy lokalnie. Dark-theme przez tokeny CSS.
 */
export function ErrorState({
  title = "Coś poszło nie tak",
  message = "Wystąpił nieoczekiwany błąd. Spróbuj ponownie — jeśli problem się powtarza, odśwież stronę.",
  onRetry,
  retryLabel = "Spróbuj ponownie",
  digest,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  digest?: string;
}) {
  return (
    <div
      role="alert"
      style={{
        flex: 1, minHeight: 240, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14, padding: "40px 20px",
        textAlign: "center", color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          width: 48, height: 48, borderRadius: "50%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "color-mix(in srgb, var(--accent-red) 14%, transparent)",
          color: "var(--accent-red)",
        }}
      >
        <AlertTriangle size={24} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 420, lineHeight: 1.5 }}>{message}</div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", marginTop: 4,
            background: "var(--accent-blue)", border: "1px solid var(--accent-blue)", borderRadius: 6,
            color: "var(--on-accent)", fontSize: 14, cursor: "pointer",
          }}
        >
          <RotateCw size={15} /> {retryLabel}
        </button>
      ) : null}
      {digest ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Kod błędu: {digest}</div> : null}
    </div>
  );
}
