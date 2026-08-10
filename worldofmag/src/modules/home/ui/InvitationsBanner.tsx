"use client";

import Link from "next/link";
import { Mail, ChevronRight } from "lucide-react";

interface InvitationsBannerProps {
  count: number;
}

export function InvitationsBanner({ count }: InvitationsBannerProps) {
  if (count === 0) return null;

  return (
    <Link
      href="/invitations"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 10,
        border: "1px solid rgba(245,158,11,0.35)",
        background: "rgba(245,158,11,0.08)",
        textDecoration: "none",
        transition: "background 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(245,158,11,0.12)";
        e.currentTarget.style.borderColor = "rgba(245,158,11,0.6)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(245,158,11,0.08)";
        e.currentTarget.style.borderColor = "rgba(245,158,11,0.35)";
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "rgba(245,158,11,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Mail size={18} style={{ color: "var(--accent-amber)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          {count === 1 ? "Masz 1 oczekujące zaproszenie" : `Masz ${count} oczekujące zaproszenia`}
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>
          {count === 1 ? "Sprawdź szczegóły zespołu" : "Sprawdź szczegóły zespołów"}
        </p>
      </div>
      <ChevronRight size={16} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
    </Link>
  );
}
