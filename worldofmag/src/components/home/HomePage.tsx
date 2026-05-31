"use client";

import Link from "next/link";
import { BookOpen, Lock } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AISuggestions } from "@/components/home/AISuggestions";
import { InvitationsBanner } from "@/components/home/InvitationsBanner";
import { ModuleSnapshotGrid } from "@/components/home/ModuleSnapshotGrid";
import { TodaySnapshot } from "@/components/home/TodaySnapshot";
import { QuickActions } from "@/components/home/QuickActions";
import { RecentlyUsed } from "@/components/home/RecentlyUsed";
import { AdminDashboardWidget } from "@/components/home/AdminDashboardWidget";
import { SectionHeading, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import type { TaskPriority, CareAgendaItem } from "@/types";

interface ActivityItem {
  module: string;
  action: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface TaskPreview {
  id: string;
  title: string;
  priority: TaskPriority;
  projectId: string | null;
  projectName: string | null;
  projectEmoji: string | null;
}

interface MealPreview {
  id: string;
  slot: string;
  title: string;
  servings: number;
  recipeSlug: string | null;
}

export interface VehicleAlert {
  id: string;
  name: string;
  type: "inspection" | "insurance";
  dueAt: string;
  daysLeft: number;
}

interface AdminStats {
  userCount: number;
  teamCount: number;
  reportCount: number;
}

interface HomePageProps {
  userName: string | null;
  userRoles: string[];
  userPermissions: string[];
  isAdmin: boolean;
  pendingInvitations: number;
  pendingItems: number;
  todayTasks: number;
  overdueTasks: number;
  todayTaskPreview: TaskPreview[];
  pinnedNotes: number;
  todayMeals: MealPreview[];
  expiringSoon: number;
  recentReports: number;
  petCareDue: number;
  petAgenda: CareAgendaItem[];
  vehiclesCount: number;
  vehicleAlerts: VehicleAlert[];
  wallet: { totalNet: number; currency: string; monthlyRate: number } | null;
  recentActivity: ActivityItem[];
  adminStats: AdminStats | null;
}

function getGreeting(name: string | null): string {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? "Dzień dobry" : hour < 18 ? "Cześć" : "Dobry wieczór";
  const firstName = name?.split(" ")[0] ?? null;
  return firstName ? `${prefix}, ${firstName}!` : `${prefix}!`;
}

interface FooterLinkProps {
  href: string;
  label: string;
  locked?: boolean;
  icon?: React.ReactNode;
}

function FooterLink({ href, label, locked, icon }: FooterLinkProps) {
  if (locked) {
    return (
      <span
        style={{ fontSize: 12, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 3, opacity: 0.4, cursor: "not-allowed" }}
        title="Niedostępne dla Twojej roli"
      >
        {icon}
        {label}
        <Lock size={9} />
      </span>
    );
  }
  return (
    <Link
      href={href}
      style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      {icon}
      {label}
    </Link>
  );
}

export function HomePage({
  userName,
  userRoles,
  userPermissions,
  isAdmin,
  pendingInvitations,
  pendingItems,
  todayTasks,
  overdueTasks,
  todayTaskPreview,
  pinnedNotes,
  todayMeals,
  expiringSoon,
  recentReports,
  petCareDue,
  petAgenda,
  vehiclesCount,
  vehicleAlerts,
  wallet,
  recentActivity,
  adminStats,
}: HomePageProps) {
  const has = (slug: string) => userPermissions.includes(slug);
  const hasAnyModule =
    has("module.shopping") ||
    has("module.tasks") ||
    has("module.notes") ||
    has("module.kitchen") ||
    has("module.pets") ||
    has("module.flota") ||
    has("module.portfel");

  const overdueVehicles = vehicleAlerts.filter((v) => v.daysLeft < 0).length;
  const hasTodayContent =
    todayTaskPreview.length > 0 || todayMeals.length > 0 || petAgenda.length > 0 || vehicleAlerts.length > 0;

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        {/* Greeting */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <BrandLogo px={24} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {getGreeting(userName)}
            </h1>
            {userRoles.includes("BETA_TESTER") && !isAdmin && (
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "rgba(168,85,247,0.15)",
                  color: "var(--accent-purple)",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Beta
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, paddingLeft: 30 }}>
            {getSubtitle({
              pending: pendingItems,
              todayTasks,
              overdueTasks,
              meals: todayMeals.length,
              petCareDue,
              overdueVehicles,
            })}
          </p>
        </div>

        {/* Pending invitations banner */}
        <InvitationsBanner count={pendingInvitations} />

        {/* Recently used — szybki powrót do ostatnich działów */}
        <RecentlyUsed activities={recentActivity} permissions={userPermissions} />

        {/* Module snapshot */}
        {hasAnyModule ? (
          <div>
            <SectionHeading>Twoje moduły</SectionHeading>
            <ModuleSnapshotGrid
              permissions={userPermissions}
              pendingItems={pendingItems}
              todayTasks={todayTasks}
              overdueTasks={overdueTasks}
              pinnedNotes={pinnedNotes}
              todayMeals={todayMeals.length}
              expiringSoon={expiringSoon}
              recentReports={recentReports}
              petCareDue={petCareDue}
              vehiclesCount={vehiclesCount}
              vehicleAlerts={vehicleAlerts.length}
              wallet={wallet}
            />
          </div>
        ) : (
          <div
            style={{
              padding: "20px 16px",
              borderRadius: 10,
              border: "1px dashed var(--border)",
              background: "var(--bg-surface)",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            Brak dostępnych modułów. Odwiedź{" "}
            <Link href="/guide" style={{ color: "var(--accent-blue)" }}>
              przewodnik
            </Link>{" "}
            lub poczekaj na zaproszenie.
          </div>
        )}

        {/* Today & upcoming */}
        {hasTodayContent && (
          <div>
            <SectionHeading>Dziś i nadchodzące</SectionHeading>
            <TodaySnapshot
              tasks={todayTaskPreview}
              meals={todayMeals}
              petAgenda={petAgenda}
              vehicleAlerts={vehicleAlerts}
              hasTasksAccess={has("module.tasks")}
              hasKitchenAccess={has("module.kitchen")}
              hasPetsAccess={has("module.pets")}
              hasFlotaAccess={has("module.flota")}
            />
          </div>
        )}

        {/* Quick actions */}
        <div>
          <SectionHeading>Szybkie akcje</SectionHeading>
          <QuickActions permissions={userPermissions} />
        </div>

        {/* AI suggestions */}
        <div>
          <SectionHeading>Sugestie</SectionHeading>
          <AISuggestions
            recentActivity={recentActivity.map((a) => ({
              module: a.module,
              action: a.action,
              createdAt: new Date(a.createdAt),
            }))}
            permissions={userPermissions}
            overdueTasks={overdueTasks}
            pendingItems={pendingItems}
            petCareDue={petCareDue}
            vehicleAlerts={vehicleAlerts}
            expiringSoon={expiringSoon}
            todayMeals={todayMeals.length}
            wallet={wallet}
          />
        </div>

        {/* Admin widget */}
        {isAdmin && adminStats && (
          <div>
            <AdminDashboardWidget
              userCount={adminStats.userCount}
              teamCount={adminStats.teamCount}
              reportCount={adminStats.reportCount}
            />
          </div>
        )}

        {/* Footer links */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            paddingTop: 12,
            paddingBottom: 24,
            flexWrap: "wrap",
            borderTop: "1px solid var(--border)",
            marginTop: 8,
          }}
        >
          <FooterLink href="/shopping" label="Zakupy" locked={!has("module.shopping")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/tasks" label="Zadania" locked={!has("module.tasks")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/notes" label="Notatki" locked={!has("module.notes")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/pets" label="Zwierzęta" locked={!has("module.pets")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/kitchen" label="Kuchnia" locked={!has("module.kitchen")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/flota" label="Flota" locked={!has("module.flota")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/portfel" label="Portfel" locked={!has("module.portfel")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/truck" label="Trasy TIR" locked={!has("module.truck")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/qa" label="QA" locked={!has("module.qa")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/reports" label="Raporty" />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/settings" label="Ustawienia" locked={!has("module.settings")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink
            href="/guide"
            label="Pomoc"
            icon={<BookOpen size={11} style={{ marginRight: 2 }} />}
          />
        </div>
      </div>
    </div>
  );
}

function getSubtitle(opts: {
  pending: number;
  todayTasks: number;
  overdueTasks: number;
  meals: number;
  petCareDue: number;
  overdueVehicles: number;
}): string {
  const { pending, todayTasks, overdueTasks, meals, petCareDue, overdueVehicles } = opts;
  if (overdueTasks > 0)
    return `Masz ${overdueTasks} ${pluralizePolish(overdueTasks, "zaległe zadanie", "zaległe zadania", "zaległych zadań")} — warto je dopiąć`;
  if (overdueVehicles > 0)
    return `${overdueVehicles} ${pluralizePolish(overdueVehicles, "pojazd ma", "pojazdy mają", "pojazdów ma")} zaległy przegląd lub OC`;
  if (petCareDue > 0)
    return `${petCareDue} ${pluralizePolish(petCareDue, "obowiązek", "obowiązki", "obowiązków")} opieki nad zwierzętami na dziś`;
  if (todayTasks > 0)
    return `Dzisiaj czeka ${todayTasks} ${pluralizePolish(todayTasks, "zadanie", "zadania", "zadań")}${pending > 0 ? ` i ${pending} ${pluralizePolish(pending, "pozycja", "pozycje", "pozycji")} do kupienia` : ""}`;
  if (pending > 0)
    return `${pending} ${pluralizePolish(pending, "pozycja", "pozycje", "pozycji")} do kupienia w listach`;
  if (meals > 0) return `Posiłki na dziś są zaplanowane`;
  return "Wszystko pod kontrolą — co możemy dziś zrobić?";
}

function pluralizePolish(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few;
  return many;
}
