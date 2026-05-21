"use client";

import Link from "next/link";
import { ChefHat, AlertTriangle, Clock, Users } from "lucide-react";

interface TodayMealItem {
  id: string;
  slot: string;
  title: string;
  servings: number;
  recipeSlug: string | null;
}

interface ExpiringItem {
  id: string;
  name: string;
  daysLeft: number;
}

interface KitchenWidgetProps {
  todayMeals: TodayMealItem[];
  expiring: ExpiringItem[];
  locked?: boolean;
}

const SLOT_EMOJI: Record<string, string> = {
  breakfast: "☕",
  lunch: "🍽",
  dinner: "🌙",
  snack: "🍪",
};

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

function expiryColor(daysLeft: number): string {
  if (daysLeft < 0) return "var(--kitchen-expired)";
  if (daysLeft <= 1) return "var(--kitchen-expired)";
  if (daysLeft <= 3) return "var(--kitchen-expiring)";
  return "var(--text-muted)";
}

function expiryText(daysLeft: number): string {
  if (daysLeft < 0) return "przeterminowane";
  if (daysLeft === 0) return "dziś";
  if (daysLeft === 1) return "jutro";
  return `za ${daysLeft} dni`;
}

export function KitchenWidget({ todayMeals, expiring, locked }: KitchenWidgetProps) {
  if (locked) return null;
  if (todayMeals.length === 0 && expiring.length === 0) return null;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 12,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--accent-orange)", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <ChefHat size={14} /> Kuchnia
        </h2>
        <Link href="/kitchen/plan" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Plan →
        </Link>
      </div>

      {todayMeals.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>
            <Clock size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Co dziś gotujemy
          </h3>
          {todayMeals.map((m) => {
            const Tag = m.recipeSlug ? Link : "div";
            const props = m.recipeSlug ? { href: `/kitchen/recipes/${m.recipeSlug}` } : {};
            return (
              <Tag
                key={m.id}
                {...(props as { href: string })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  backgroundColor: "var(--bg-elevated)",
                  textDecoration: "none",
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
              >
                <span>{SLOT_EMOJI[m.slot] ?? "🍽"}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 56 }}>
                  {SLOT_LABELS[m.slot] ?? m.slot}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.title}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11, color: "var(--text-muted)" }}>
                  <Users size={10} /> {m.servings}
                </span>
              </Tag>
            );
          })}
        </div>
      ) : null}

      {expiring.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ fontSize: 11, color: "var(--kitchen-expiring)", textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>
            <AlertTriangle size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Kończy się termin
          </h3>
          {expiring.map((e) => (
            <Link
              key={e.id}
              href="/kitchen/pantry"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 8,
                backgroundColor: "var(--bg-elevated)",
                fontSize: 13,
                color: "var(--text-primary)",
                textDecoration: "none",
              }}
            >
              <span>{e.name}</span>
              <span style={{ fontSize: 11, color: expiryColor(e.daysLeft) }}>{expiryText(e.daysLeft)}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
