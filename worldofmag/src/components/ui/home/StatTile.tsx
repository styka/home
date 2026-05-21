"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface StatTileProps {
  value: number | string;
  label: string;
  color: string;
  icon?: ReactNode;
  href?: string;
  emphasized?: boolean;
}

const baseStyle = {
  padding: "14px 16px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  textDecoration: "none",
  display: "block",
  position: "relative" as const,
  transition: "background 0.1s, border-color 0.1s",
};

export function StatTile({ value, label, color, icon, href, emphasized }: StatTileProps) {
  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {icon && <span style={{ color, display: "flex" }}>{icon}</span>}
        <p
          style={{
            fontSize: 24,
            fontWeight: 700,
            color,
            margin: 0,
            lineHeight: 1,
          }}
        >
          {value}
        </p>
        {href && (
          <ChevronRight
            size={13}
            style={{ color: "var(--text-muted)", marginLeft: "auto", flexShrink: 0 }}
          />
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{label}</p>
    </>
  );

  const style = {
    ...baseStyle,
    ...(emphasized ? { borderColor: color, boxShadow: `0 0 0 1px ${color} inset` } : {}),
  };

  if (href) {
    return (
      <Link
        href={href}
        style={style}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-elevated)";
          if (!emphasized) e.currentTarget.style.borderColor = "var(--border-focus)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--bg-surface)";
          if (!emphasized) e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        {content}
      </Link>
    );
  }
  return <div style={style}>{content}</div>;
}
