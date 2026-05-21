"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface ManagementItem {
  href: string;
  icon: ReactNode;
  label: string;
  color: string;
  external?: boolean;
}

interface ManagementGridProps {
  items: ManagementItem[];
}

export function ManagementGrid({ items }: ManagementGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
      }}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "14px 8px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            textDecoration: "none",
            color: "var(--text-secondary)",
            fontSize: 12,
            textAlign: "center",
            transition: "background 0.1s, border-color 0.1s, transform 0.1s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-elevated)";
            e.currentTarget.style.borderColor = "var(--border-focus)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-surface)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <span style={{ color: item.color, display: "flex" }}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
