"use client";

import Link from "next/link";
import {
  ShoppingCart,
  CheckSquare,
  FileText,
  PawPrint,
  ChefHat,
  Fuel,
  Wallet,
  Truck,
  GraduationCap,
  HeartPulse,
  Plus,
  type LucideIcon,
} from "lucide-react";

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
  permission: string | null;
}

const ACTIONS: QuickAction[] = [
  { label: "Dodaj zakupy", href: "/shopping", icon: ShoppingCart, color: "var(--accent-blue)", permission: "module.shopping" },
  { label: "Nowe zadanie", href: "/tasks", icon: CheckSquare, color: "var(--accent-green)", permission: "module.tasks" },
  { label: "Nowa notatka", href: "/notes/all", icon: FileText, color: "var(--accent-amber)", permission: "module.notes" },
  { label: "Opieka", href: "/pets/calendar", icon: PawPrint, color: "var(--accent-orange)", permission: "module.pets" },
  { label: "Zaplanuj posiłek", href: "/kitchen/plan", icon: ChefHat, color: "var(--accent-orange)", permission: "module.kitchen" },
  { label: "Tankowanie", href: "/flota", icon: Fuel, color: "var(--accent-blue)", permission: "module.flota" },
  { label: "Wpis w portfelu", href: "/portfel", icon: Wallet, color: "var(--accent-green)", permission: "module.portfel" },
  { label: "Powtórka słówek", href: "/languages", icon: GraduationCap, color: "var(--accent-purple)", permission: "module.languages" },
  { label: "Wizyta / badanie", href: "/health", icon: HeartPulse, color: "var(--accent-red)", permission: "module.health" },
  { label: "Zaplanuj trasę", href: "/truck", icon: Truck, color: "var(--accent-blue)", permission: "module.truck" },
];

interface QuickActionsProps {
  permissions: string[];
}

export function QuickActions({ permissions }: QuickActionsProps) {
  const actions = ACTIONS.filter((a) => !a.permission || permissions.includes(a.permission));

  if (actions.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href + action.label}
            href={action.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 13px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              transition: "background 0.1s, border-color 0.1s, color 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-elevated)";
              e.currentTarget.style.borderColor = "var(--border-focus)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-surface)";
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <span style={{ position: "relative", display: "flex", color: action.color }}>
              <Icon size={15} />
              <Plus
                size={9}
                style={{ position: "absolute", top: -3, right: -5, color: action.color, strokeWidth: 3 }}
              />
            </span>
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
