"use client";

import { ShoppingCart, CheckSquare, AlertCircle, FileText, ChefHat, BookOpen, Pin } from "lucide-react";
import { StatTile } from "@/components/ui/home";

interface ModuleSnapshotGridProps {
  permissions: string[];
  pendingItems: number;
  todayTasks: number;
  overdueTasks: number;
  pinnedNotes: number;
  todayMeals: number;
  expiringSoon: number;
  recentReports: number;
}

export function ModuleSnapshotGrid({
  permissions,
  pendingItems,
  todayTasks,
  overdueTasks,
  pinnedNotes,
  todayMeals,
  expiringSoon,
  recentReports,
}: ModuleSnapshotGridProps) {
  const has = (slug: string) => permissions.includes(slug);

  const tiles: React.ReactNode[] = [];

  if (has("module.shopping")) {
    tiles.push(
      <StatTile
        key="shopping"
        value={pendingItems}
        label="Do kupienia"
        color={pendingItems > 0 ? "var(--accent-blue)" : "var(--text-muted)"}
        icon={<ShoppingCart size={14} />}
        href="/shopping"
      />
    );
  }

  if (has("module.tasks")) {
    tiles.push(
      <StatTile
        key="tasks-today"
        value={todayTasks}
        label="Zadania dziś"
        color={todayTasks > 0 ? "var(--accent-green)" : "var(--text-muted)"}
        icon={<CheckSquare size={14} />}
        href="/tasks/today"
      />
    );
    if (overdueTasks > 0) {
      tiles.push(
        <StatTile
          key="tasks-overdue"
          value={overdueTasks}
          label="Zaległe"
          color="var(--accent-red)"
          icon={<AlertCircle size={14} />}
          href="/tasks/overdue"
          emphasized
        />
      );
    }
  }

  if (has("module.notes")) {
    tiles.push(
      <StatTile
        key="notes"
        value={pinnedNotes}
        label="Przypięte notatki"
        color={pinnedNotes > 0 ? "var(--accent-amber)" : "var(--text-muted)"}
        icon={<Pin size={14} />}
        href="/notes/all?pinned=1"
      />
    );
  }

  if (has("module.kitchen")) {
    tiles.push(
      <StatTile
        key="kitchen-today"
        value={todayMeals}
        label="Posiłki dziś"
        color={todayMeals > 0 ? "var(--accent-orange)" : "var(--text-muted)"}
        icon={<ChefHat size={14} />}
        href="/kitchen/plan"
      />
    );
    if (expiringSoon > 0) {
      tiles.push(
        <StatTile
          key="kitchen-expiring"
          value={expiringSoon}
          label="Wygasające"
          color="var(--accent-red)"
          icon={<AlertCircle size={14} />}
          href="/kitchen/pantry"
          emphasized
        />
      );
    }
  }

  // Reports: brak osobnego permission, pokazujemy zawsze gdy są nowe
  if (recentReports > 0) {
    tiles.push(
      <StatTile
        key="reports"
        value={recentReports}
        label="Nowe raporty"
        color="var(--accent-purple)"
        icon={<BookOpen size={14} />}
        href="/reports"
      />
    );
  }

  if (tiles.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
      {tiles}
    </div>
  );
}
