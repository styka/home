"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  hint?: string;
  cta?: {
    label: string;
    onClick?: () => void;
    href?: string;
    color?: string;
  };
}

export function EmptyState({ icon, message, hint, cta }: EmptyStateProps) {
  const ctaColor = cta?.color ?? "var(--accent-blue)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "32px 16px",
        borderRadius: 10,
        border: "1px dashed var(--border)",
        background: "var(--bg-surface)",
        textAlign: "center",
      }}
    >
      <div style={{ opacity: 0.5, color: "var(--text-muted)", display: "flex" }}>{icon}</div>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, fontWeight: 500 }}>
        {message}
      </p>
      {hint && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          {hint}
        </p>
      )}
      {cta &&
        (cta.href ? (
          <a
            href={cta.href}
            style={{
              marginTop: 4,
              padding: "6px 14px",
              borderRadius: 8,
              background: ctaColor,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {cta.label}
          </a>
        ) : (
          <button
            onClick={cta.onClick}
            style={{
              marginTop: 4,
              padding: "6px 14px",
              borderRadius: 8,
              background: ctaColor,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            {cta.label}
          </button>
        ))}
    </div>
  );
}
