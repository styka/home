"use client";

import Link from "next/link";
import {
  ShoppingCart,
  CheckSquare,
  FileText,
  ChefHat,
  PawPrint,
  Wallet,
  Car,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

interface ActivityItem {
  module: string;
  action: string;
  createdAt: Date;
}

interface VehicleAlert {
  id: string;
  name: string;
  type: "inspection" | "insurance";
  dueAt: string;
  daysLeft: number;
}

interface SuggestionCard {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: string;
  accentColor: string;
  priority: number; // niższa = pilniejsza
}

interface AISuggestionsProps {
  recentActivity: ActivityItem[];
  permissions: string[];
  overdueTasks: number;
  pendingItems: number;
  petCareDue: number;
  vehicleAlerts: VehicleAlert[];
  expiringSoon: number;
  todayMeals: number;
  wallet: { totalNet: number; currency: string; monthlyRate: number } | null;
}

function pluralTasks(n: number): string {
  return n === 1 ? "zaległe zadanie" : n < 5 ? "zaległe zadania" : "zaległych zadań";
}

export function AISuggestions({
  recentActivity,
  permissions,
  overdueTasks,
  pendingItems,
  petCareDue,
  vehicleAlerts,
  expiringSoon,
  todayMeals,
  wallet,
}: AISuggestionsProps) {
  const has = (slug: string) => permissions.includes(slug);
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const recentNoteCreate = recentActivity.some(
    (a) => a.module === "notes" && a.action === "create_note" && new Date(a.createdAt) > threeDaysAgo
  );

  const suggestions: SuggestionCard[] = [];

  // — Pilne (read + action) —
  if (has("module.tasks") && overdueTasks > 0) {
    suggestions.push({
      icon: CheckSquare,
      title: `${overdueTasks} ${pluralTasks(overdueTasks)}`,
      subtitle: "Sprawdź, co czeka na realizację",
      href: "/tasks/overdue",
      accentColor: "var(--accent-red)",
      priority: 0,
    });
  }

  if (has("module.flota") && vehicleAlerts.length > 0) {
    const overdue = vehicleAlerts.filter((v) => v.daysLeft < 0).length;
    suggestions.push({
      icon: Car,
      title: overdue > 0 ? `Zaległy przegląd lub OC` : `Przegląd / OC wkrótce`,
      subtitle:
        overdue > 0
          ? `${overdue} ${overdue === 1 ? "pojazd wymaga" : "pojazdy wymagają"} uwagi`
          : `Zbliża się termin dla ${vehicleAlerts.length} ${vehicleAlerts.length === 1 ? "pojazdu" : "pojazdów"}`,
      href: "/flota",
      accentColor: overdue > 0 ? "var(--accent-red)" : "var(--accent-orange)",
      priority: 1,
    });
  }

  if (has("module.pets") && petCareDue > 0) {
    suggestions.push({
      icon: PawPrint,
      title: `Opieka nad zwierzętami`,
      subtitle: `${petCareDue} ${petCareDue === 1 ? "obowiązek" : "obowiązków"} na dziś lub zaległych`,
      href: "/pets/calendar",
      accentColor: "var(--accent-orange)",
      priority: 2,
    });
  }

  if (has("module.kitchen") && expiringSoon > 0) {
    suggestions.push({
      icon: ChefHat,
      title: `${expiringSoon} ${expiringSoon === 1 ? "produkt wygasa" : "produkty wygasają"}`,
      subtitle: "Zużyj zanim się zmarnują",
      href: "/kitchen/pantry",
      accentColor: "var(--accent-red)",
      priority: 3,
    });
  }

  // — Bieżące (action) —
  if (has("module.shopping") && pendingItems > 0) {
    suggestions.push({
      icon: ShoppingCart,
      title: `${pendingItems} do kupienia`,
      subtitle: "Twoje listy zakupów czekają",
      href: "/shopping",
      accentColor: "var(--accent-blue)",
      priority: 4,
    });
  }

  if (has("module.portfel") && wallet && wallet.monthlyRate < 0) {
    suggestions.push({
      icon: Wallet,
      title: "Majątek maleje",
      subtitle: `Tempo ok. ${Math.round(wallet.monthlyRate)} ${wallet.currency}/mies. — sprawdź wydatki`,
      href: "/portfel",
      accentColor: "var(--accent-amber)",
      priority: 5,
    });
  }

  if (has("module.kitchen") && todayMeals === 0) {
    suggestions.push({
      icon: ChefHat,
      title: "Zaplanuj posiłki",
      subtitle: "Na dziś nic nie zaplanowano",
      href: "/kitchen/plan",
      accentColor: "var(--accent-orange)",
      priority: 6,
    });
  }

  if (has("module.notes") && !recentNoteCreate) {
    suggestions.push({
      icon: FileText,
      title: "Brak notatek od 3 dni",
      subtitle: "Zapisz coś, zanim zapomnisz",
      href: "/notes/all",
      accentColor: "var(--accent-green)",
      priority: 7,
    });
  }

  // — Fallback, gdy nic pilnego —
  if (suggestions.length === 0) {
    if (has("module.shopping")) {
      suggestions.push({
        icon: ShoppingCart,
        title: "Dodaj produkty do zakupów",
        subtitle: 'Powiedz np. "2 kg jabłek i mleko"',
        href: "/shopping",
        accentColor: "var(--accent-blue)",
        priority: 10,
      });
    }
    if (has("module.tasks")) {
      suggestions.push({
        icon: CheckSquare,
        title: "Zaplanuj nowe zadanie",
        subtitle: 'Np. "Zadzwoń do lekarza jutro"',
        href: "/tasks",
        accentColor: "var(--accent-green)",
        priority: 11,
      });
    }
    if (has("module.portfel")) {
      suggestions.push({
        icon: Wallet,
        title: "Zaktualizuj portfel",
        subtitle: "Dopisz przychód lub wydatek",
        href: "/portfel",
        accentColor: "var(--accent-green)",
        priority: 12,
      });
    }
  }

  if (suggestions.length === 0) return null;

  const visible = suggestions.sort((a, b) => a.priority - b.priority).slice(0, 6);

  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
      {visible.map((s, i) => {
        const Icon = s.icon;
        return (
          <Link
            key={i}
            href={s.href}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              textDecoration: "none",
              minWidth: 170,
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ color: s.accentColor }}>
              <Icon size={16} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>
                {s.title}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2, lineHeight: 1.4 }}>
                {s.subtitle}
              </p>
            </div>
            <ArrowRight size={11} style={{ position: "absolute", bottom: 12, right: 12, color: "var(--text-muted)" }} />
          </Link>
        );
      })}
    </div>
  );
}
