"use client";

import Link from "next/link";
import { ShoppingCart, CheckSquare, AlertCircle, Lock } from "lucide-react";

interface QuickStatsProps {
  pendingItems: number;
  todayTasks: number;
  overdueTasks: number;
  locked?: boolean;
}

interface StatPillProps {
  href: string;
  icon: React.ReactNode;
  count: number;
  label: string;
  accentColor: string;
  dimColor: string;
  disabled?: boolean;
}

function StatPill({ href, icon, count, label, accentColor, dimColor, disabled }: StatPillProps) {
  const sharedStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "12px 8px",
    borderRadius: 12,
    textDecoration: "none",
    minWidth: 0,
    position: "relative",
  };

  if (disabled) {
    return (
      <div
        style={{
          ...sharedStyle,
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          opacity: 0.35,
          cursor: "not-allowed",
        }}
      >
        <Lock size={9} style={{ position: "absolute", top: 6, right: 6, color: "var(--text-muted)" }} />
        <span style={{ color: "var(--text-muted)" }}>{icon}</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-secondary)", lineHeight: 1 }}>{count}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.3, fontWeight: 500 }}>{label}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      style={{
        ...sharedStyle,
        border: `1px solid ${count > 0 ? accentColor + "33" : "var(--border)"}`,
        background: count > 0 ? accentColor + "0d" : "var(--bg-surface)",
        transition: "background 0.1s",
      }}
    >
      <span style={{ color: count > 0 ? accentColor : "var(--text-muted)" }}>{icon}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: count > 0 ? accentColor : "var(--text-secondary)", lineHeight: 1 }}>
        {count}
      </span>
      <span style={{ fontSize: 10, color: count > 0 ? dimColor : "var(--text-muted)", textAlign: "center", lineHeight: 1.3, fontWeight: 500 }}>
        {label}
      </span>
    </Link>
  );
}

export function QuickStats({ pendingItems, todayTasks, overdueTasks, locked }: QuickStatsProps) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <StatPill
        href="/shopping"
        icon={<ShoppingCart size={18} />}
        count={pendingItems}
        label="do kupienia"
        accentColor="var(--accent-blue)"
        dimColor="var(--text-secondary)"
      />
      <StatPill
        href="/tasks"
        icon={<CheckSquare size={18} />}
        count={todayTasks}
        label="zadań dziś"
        accentColor="var(--accent-green)"
        dimColor="var(--text-secondary)"
        disabled={locked}
      />
      <StatPill
        href="/tasks"
        icon={<AlertCircle size={18} />}
        count={overdueTasks}
        label="zaległych"
        accentColor="var(--accent-red)"
        dimColor="var(--text-secondary)"
        disabled={locked}
      />
    </div>
  );
}
