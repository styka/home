"use client";

import Link from "next/link";
import { ShoppingCart, CheckSquare, FileText, Sparkles, ArrowRight } from "lucide-react";

interface ActivityItem {
  module: string;
  action: string;
  createdAt: Date;
}

interface SuggestionCard {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
  accentColor: string;
}

interface AISuggestionsProps {
  recentActivity: ActivityItem[];
  overdueTasks: number;
}

export function AISuggestions({ recentActivity, overdueTasks }: AISuggestionsProps) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const recentShoppingAdd = recentActivity.some(
    (a) => a.module === "shopping" && a.action === "add_item" && new Date(a.createdAt) > oneDayAgo
  );
  const recentNoteCreate = recentActivity.some(
    (a) => a.module === "notes" && a.action === "create_note" && new Date(a.createdAt) > threeDaysAgo
  );

  const suggestions: SuggestionCard[] = [];

  if (overdueTasks > 0) {
    suggestions.push({
      icon: <CheckSquare size={16} />,
      title: `${overdueTasks} zaległ${overdueTasks === 1 ? "e zadanie" : overdueTasks < 5 ? "e zadania" : "ych zadań"}`,
      subtitle: "Sprawdź co czeka na realizację",
      href: "/tasks",
      accentColor: "var(--accent-red)",
    });
  }

  if (recentShoppingAdd) {
    suggestions.push({
      icon: <ShoppingCart size={16} />,
      title: "Lista zakupów aktywna",
      subtitle: "Masz niedawno dodane produkty",
      href: "/shopping",
      accentColor: "var(--accent-blue)",
    });
  }

  if (!recentNoteCreate) {
    suggestions.push({
      icon: <FileText size={16} />,
      title: "Brak notatek od 3 dni",
      subtitle: "Zapisz coś zanim zapomnisz",
      href: "/notes",
      accentColor: "var(--accent-green)",
    });
  }

  if (suggestions.length === 0 && recentActivity.length === 0) {
    suggestions.push({
      icon: <Sparkles size={16} />,
      title: "Zacznij od dodania zadania",
      subtitle: 'Wpisz poniżej np. "Zadzwoń do lekarza jutro"',
      href: "/tasks",
      accentColor: "var(--accent-purple)",
    });
    suggestions.push({
      icon: <ShoppingCart size={16} />,
      title: "Dodaj produkty do zakupów",
      subtitle: 'Powiedz np. "2 kg jabłek i mleko"',
      href: "/shopping",
      accentColor: "var(--accent-blue)",
    });
  }

  if (suggestions.length === 0) return null;

  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
        <Sparkles size={11} />
        Sugestie
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {suggestions.map((s, i) => (
          <Link
            key={i}
            href={s.href}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid var(--border)`,
              background: "var(--bg-surface)",
              textDecoration: "none",
              minWidth: 160,
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ color: s.accentColor }}>{s.icon}</div>
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
        ))}
      </div>
    </div>
  );
}
