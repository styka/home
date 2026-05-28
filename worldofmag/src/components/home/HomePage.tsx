"use client";

import Link from "next/link";
import { BookOpen, Lock } from "lucide-react";
import { BrandLogoCycler } from "@/components/brand/BrandLogoCycler";
import { AISuggestions } from "@/components/home/AISuggestions";
import { InvitationsBanner } from "@/components/home/InvitationsBanner";
import { ModuleSnapshotGrid } from "@/components/home/ModuleSnapshotGrid";
import { TodaySnapshot } from "@/components/home/TodaySnapshot";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { AdminDashboardWidget } from "@/components/home/AdminDashboardWidget";
import { SectionHeading, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import type { TaskPriority } from "@/types";

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
  recentActivity,
  adminStats,
}: HomePageProps) {
  const has = (slug: string) => userPermissions.includes(slug);
  const hasAnyModule =
    has("module.shopping") || has("module.tasks") || has("module.notes") || has("module.kitchen");

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        {/* Greeting */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <BrandLogoCycler px={22} />
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
            {getSubtitle(pendingItems, todayTasks, overdueTasks, todayMeals.length)}
          </p>
        </div>

        {/* Pending invitations banner */}
        <InvitationsBanner count={pendingInvitations} />

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

        {/* Today snapshot */}
        {(todayTaskPreview.length > 0 || todayMeals.length > 0) && (
          <div>
            <SectionHeading>Dziś</SectionHeading>
            <TodaySnapshot
              tasks={todayTaskPreview}
              meals={todayMeals}
              hasTasksAccess={has("module.tasks")}
              hasKitchenAccess={has("module.kitchen")}
            />
          </div>
        )}

        {/* Activity feed */}
        {recentActivity.length > 0 && (
          <div>
            <SectionHeading>Aktywność</SectionHeading>
            <ActivityFeed activities={recentActivity} permissions={userPermissions} />
          </div>
        )}

        {/* AI suggestions */}
        <div>
          <SectionHeading>Sugestie</SectionHeading>
          <AISuggestions
            recentActivity={recentActivity.map((a) => ({
              module: a.module,
              action: a.action,
              createdAt: new Date(a.createdAt),
            }))}
            overdueTasks={overdueTasks}
            locked={!has("module.tasks")}
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
          <FooterLink href="/kitchen" label="Kuchnia" locked={!has("module.kitchen")} />
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

function getSubtitle(pending: number, todayT: number, overdue: number, meals: number): string {
  if (overdue > 0) return `Masz ${overdue} ${pluralizePolish(overdue, "zaległe zadanie", "zaległe zadania", "zaległych zadań")} — warto je dopiąć`;
  if (todayT > 0) return `Dzisiaj czeka ${todayT} ${pluralizePolish(todayT, "zadanie", "zadania", "zadań")}${pending > 0 ? ` i ${pending} ${pluralizePolish(pending, "pozycja", "pozycje", "pozycji")} do kupienia` : ""}`;
  if (pending > 0) return `${pending} ${pluralizePolish(pending, "pozycja", "pozycje", "pozycji")} do kupienia w listach`;
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
