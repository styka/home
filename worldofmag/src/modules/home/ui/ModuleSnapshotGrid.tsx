"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart, CheckSquare, AlertCircle, ChefHat, BookOpen, Pin, PawPrint, Car, Wallet, GraduationCap, HeartPulse, Boxes, CalendarClock, Flame, Hammer } from "lucide-react";
import { StatTile } from "@/components/ui/home";
import type { WeatherTodayInfo } from "../contract";

interface ModuleSnapshotGridProps {
  permissions: string[];
  pendingItems: number;
  todayTasks: number;
  overdueTasks: number;
  pinnedNotes: number;
  todayMeals: number;
  expiringSoon: number;
  recentReports: number;
  petCareDue: number;
  vehiclesCount: number;
  vehicleAlerts: number;
  wallet: { totalNet: number; currency: string; monthlyRate: number } | null;
  languagesDue: number;
  healthUpcoming: number;
  storageLowStock: number;
  storageExpiring: number;
  /** 115 (Z-INT-17): nawyki „N/M dziś", braki warsztatowe i bieżąca pogoda domyślnej lokalizacji. */
  habitsTodayDone: number;
  habitsTodayTotal: number;
  workshopLowStock: number;
  weatherToday: WeatherTodayInfo | null;
}

function formatCompactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(".", ",")} mln`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)} tys.`;
  if (abs >= 1_000) return `${sign}${(abs / 1000).toFixed(1).replace(".", ",")} tys.`;
  return `${sign}${Math.round(abs)}`;
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
  petCareDue,
  vehiclesCount,
  vehicleAlerts,
  wallet,
  languagesDue,
  healthUpcoming,
  storageLowStock,
  storageExpiring,
  habitsTodayDone,
  habitsTodayTotal,
  workshopLowStock,
  weatherToday,
}: ModuleSnapshotGridProps) {
  const t = useTranslations("modules.home.ModuleSnapshotGrid");
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
        label={t("zadaniaDzis")}
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
          label={t("zalegle")}
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
        label={t("przypieteNotatki")}
        color={pinnedNotes > 0 ? "var(--accent-amber)" : "var(--text-muted)"}
        icon={<Pin size={14} />}
        href="/notes/all?pinned=1"
      />
    );
  }

  if (has("module.languages")) {
    tiles.push(
      <StatTile
        key="languages"
        value={languagesDue}
        label={t("slowkaDoPowtorki")}
        color={languagesDue > 0 ? "var(--accent-purple)" : "var(--text-muted)"}
        icon={<GraduationCap size={14} />}
        href="/languages"
        emphasized={languagesDue > 0}
      />
    );
  }

  if (has("module.health")) {
    tiles.push(
      <StatTile
        key="health"
        value={healthUpcoming}
        label="Wizyty i badania"
        color={healthUpcoming > 0 ? "var(--accent-red)" : "var(--text-muted)"}
        icon={<HeartPulse size={14} />}
        href="/health"
      />
    );
  }

  if (has("module.pets")) {
    tiles.push(
      <StatTile
        key="pets"
        value={petCareDue}
        label={t("opiekaDzis")}
        color={petCareDue > 0 ? "var(--accent-orange)" : "var(--text-muted)"}
        icon={<PawPrint size={14} />}
        href={petCareDue > 0 ? "/pets/calendar" : "/pets"}
        emphasized={petCareDue > 0}
      />
    );
  }

  if (has("module.kitchen")) {
    tiles.push(
      <StatTile
        key="kitchen-today"
        value={todayMeals}
        label={t("posilkiDzis")}
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
          label={t("wygasajace")}
          color="var(--accent-red)"
          icon={<AlertCircle size={14} />}
          href="/kitchen/pantry"
          emphasized
        />
      );
    }
  }

  if (has("module.flota")) {
    if (vehicleAlerts > 0) {
      tiles.push(
        <StatTile
          key="flota-alerts"
          value={vehicleAlerts}
          label={t("przegladOcWkrotce")}
          color="var(--accent-red)"
          icon={<AlertCircle size={14} />}
          href="/flota"
          emphasized
        />
      );
    } else {
      tiles.push(
        <StatTile
          key="flota"
          value={vehiclesCount}
          label="Pojazdy"
          color={vehiclesCount > 0 ? "var(--accent-blue)" : "var(--text-muted)"}
          icon={<Car size={14} />}
          href="/flota"
        />
      );
    }
  }

  if (has("module.magazynowanie")) {
    if (storageLowStock > 0) {
      tiles.push(
        <StatTile
          key="storage-low"
          value={storageLowStock}
          label={t("magazynDoUzupelnienia")}
          color="var(--accent-amber)"
          icon={<AlertCircle size={14} />}
          href="/magazynowanie"
          emphasized
        />
      );
    }
    if (storageExpiring > 0) {
      tiles.push(
        <StatTile
          key="storage-expiring"
          value={storageExpiring}
          label="Magazyn: terminy / gwarancje"
          color="var(--accent-red)"
          icon={<CalendarClock size={14} />}
          href="/magazynowanie"
          emphasized
        />
      );
    }
    if (storageLowStock === 0 && storageExpiring === 0) {
      tiles.push(
        <StatTile
          key="storage"
          value=""
          label="Magazyn"
          color="var(--accent-blue)"
          icon={<Boxes size={14} />}
          href="/magazynowanie"
        />
      );
    }
  }

  // 115 (Z-INT-17): kafelek nawyków tylko, gdy dziś COKOLWIEK jest zaplanowane — pusty licznik
  // „0/0" mówiłby jedynie, że moduł istnieje.
  if (has("module.habits") && habitsTodayTotal > 0) {
    const komplet = habitsTodayDone >= habitsTodayTotal;
    tiles.push(
      <StatTile
        key="habits"
        value={`${habitsTodayDone}/${habitsTodayTotal}`}
        label={t("nawykiDzis")}
        color={komplet ? "var(--accent-green)" : "var(--accent-purple)"}
        icon={<Flame size={14} />}
        href="/habits"
        emphasized={!komplet}
      />
    );
  }

  if (has("module.warsztaty") && workshopLowStock > 0) {
    tiles.push(
      <StatTile
        key="warsztaty-low"
        value={workshopLowStock}
        label={t("warsztatBraki")}
        color="var(--accent-amber)"
        icon={<Hammer size={14} />}
        href="/warsztaty/przeglady"
        emphasized
      />
    );
  }

  if (has("module.weather") && weatherToday) {
    tiles.push(
      <StatTile
        key="weather"
        value={`${weatherToday.emoji} ${weatherToday.temp}°`}
        label={`${weatherToday.opis} · ${weatherToday.label}`}
        color="var(--accent-blue)"
        href="/pogoda"
      />
    );
  }

  if (has("module.portfel") && wallet) {
    tiles.push(
      <StatTile
        key="portfel"
        value={formatCompactMoney(wallet.totalNet)}
        label={`Majątek · ${wallet.currency}`}
        color={wallet.totalNet >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
        icon={<Wallet size={14} />}
        href="/portfel"
      />
    );
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
