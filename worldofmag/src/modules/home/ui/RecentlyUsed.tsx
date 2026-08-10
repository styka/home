"use client";

import Link from "next/link";
import { Clock, ShoppingCart, CheckSquare, FileText, ChefHat, PawPrint, Car, Wallet, type LucideIcon } from "lucide-react";

interface ActivityItem {
  module: string;
  action: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface ModuleMeta {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
  permission: string;
}

const MODULE_META: Record<string, ModuleMeta> = {
  shopping: { label: "Zakupy", href: "/shopping", icon: ShoppingCart, color: "var(--accent-blue)", permission: "module.shopping" },
  tasks: { label: "Zadania", href: "/tasks", icon: CheckSquare, color: "var(--accent-green)", permission: "module.tasks" },
  notes: { label: "Notatki", href: "/notes/all", icon: FileText, color: "var(--accent-amber)", permission: "module.notes" },
  kitchen: { label: "Kuchnia", href: "/kitchen", icon: ChefHat, color: "var(--accent-orange)", permission: "module.kitchen" },
  pets: { label: "Zwierzęta", href: "/pets", icon: PawPrint, color: "var(--accent-orange)", permission: "module.pets" },
  flota: { label: "Flota", href: "/flota", icon: Car, color: "var(--accent-blue)", permission: "module.flota" },
  portfel: { label: "Portfel", href: "/portfel", icon: Wallet, color: "var(--accent-green)", permission: "module.portfel" },
};

interface RecentlyUsedProps {
  activities: ActivityItem[];
  permissions: string[];
}

export function RecentlyUsed({ activities, permissions }: RecentlyUsedProps) {
  // Modules in recency order, deduped, filtered by access.
  const seen = new Set<string>();
  const modules: ModuleMeta[] = [];
  for (const a of activities) {
    if (seen.has(a.module)) continue;
    const meta = MODULE_META[a.module];
    if (!meta) continue;
    if (!permissions.includes(meta.permission)) continue;
    seen.add(a.module);
    modules.push(meta);
    if (modules.length >= 5) break;
  }

  if (modules.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <Clock size={11} /> Ostatnio
      </span>
      {modules.map((m) => {
        const Icon = m.icon;
        return (
          <Link
            key={m.href}
            href={m.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 11px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: 12.5,
              textDecoration: "none",
              transition: "background 0.1s, color 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-elevated)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-surface)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <Icon size={13} style={{ color: m.color }} />
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}
