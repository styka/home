"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, SlidersHorizontal, Eye, EyeOff, ChevronUp, ChevronDown, Check } from "lucide-react";
import { setDashboardPrefs } from "@/actions/dashboardPrefs";
import { DASHBOARD_SECTIONS } from "@/lib/home/dashboardSections";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AISuggestions } from "@/components/home/AISuggestions";
import { InvitationsBanner } from "@/components/home/InvitationsBanner";
import { ModuleSnapshotGrid } from "@/components/home/ModuleSnapshotGrid";
import { TodaySnapshot } from "@/components/home/TodaySnapshot";
import { DailyBriefingCard } from "@/components/home/DailyBriefingCard";
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

export interface DeckDue {
  id: string;
  name: string;
  targetLang: string;
  dueCount: number;
}

export interface HealthUpcoming {
  id: string;
  kind: "VISIT" | "TEST";
  title: string;
  specialty: string | null;
  scheduledAt: string;
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
  languagesDue: number;
  languageDecks: DeckDue[];
  healthUpcomingCount: number;
  healthUpcoming: HealthUpcoming[];
  storageLowStock: number;
  storageExpiring: number;
  recentActivity: ActivityItem[];
  adminStats: AdminStats | null;
  dashboardPrefs?: { order: string[]; hidden: string[] };
}

// H1: sekcje pulpitu, które użytkownik może przestawiać/ukrywać.
const SECTION_LABELS: Record<string, string> = {
  recently: "Ostatnio używane",
  briefing: "Briefing dnia",
  modules: "Twoje moduły",
  today: "Dziś i nadchodzące",
  quickActions: "Szybkie akcje",
  suggestions: "Sugestie",
};
// Z-218: wspólny whitelist sekcji (źródło prawdy w lib, używane też przez Server Action).
const DEFAULT_SECTION_ORDER: string[] = [...DASHBOARD_SECTIONS];

function ctlBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24,
    borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface)",
    color: disabled ? "var(--text-muted)" : "var(--text-secondary)", cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
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
  // Brak uprawnień → pozycja całkowicie ukryta (nie pokazujemy zablokowanego linku).
  if (locked) return null;
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
  languagesDue,
  languageDecks,
  healthUpcomingCount,
  healthUpcoming,
  storageLowStock,
  storageExpiring,
  recentActivity,
  adminStats,
  dashboardPrefs,
}: HomePageProps) {
  const has = (slug: string) => userPermissions.includes(slug);
  const hasAnyModule =
    has("module.shopping") ||
    has("module.tasks") ||
    has("module.notes") ||
    has("module.kitchen") ||
    has("module.pets") ||
    has("module.flota") ||
    has("module.portfel") ||
    has("module.languages") ||
    has("module.health") ||
    has("module.magazynowanie");

  const overdueVehicles = vehicleAlerts.filter((v) => v.daysLeft < 0).length;
  const hasTodayContent =
    todayTaskPreview.length > 0 ||
    todayMeals.length > 0 ||
    petAgenda.length > 0 ||
    vehicleAlerts.length > 0 ||
    languageDecks.length > 0 ||
    healthUpcoming.length > 0;

  // H1: personalizacja pulpitu — kolejność i ukrywanie sekcji.
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const savedOrder = (dashboardPrefs?.order ?? []).filter((k) => DEFAULT_SECTION_ORDER.includes(k));
  const effectiveOrder = [...savedOrder, ...DEFAULT_SECTION_ORDER.filter((k) => !savedOrder.includes(k))];
  const [order, setOrder] = useState<string[]>(effectiveOrder);
  const [hidden, setHidden] = useState<string[]>(dashboardPrefs?.hidden ?? []);

  function persist(nextOrder: string[], nextHidden: string[]) {
    startTransition(() => { setDashboardPrefs({ order: nextOrder, hidden: nextHidden }); });
  }
  function moveSection(key: string, dir: -1 | 1) {
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    persist(next, hidden);
  }
  function toggleHidden(key: string) {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    setHidden(next);
    persist(order, next);
  }

  // Węzły sekcji — budowane raz, renderowane wg kolejności użytkownika.
  const sectionNodes: Record<string, React.ReactNode> = {
    recently: <RecentlyUsed activities={recentActivity} permissions={userPermissions} />,
    briefing: hasAnyModule ? <DailyBriefingCard /> : null,
    modules: hasAnyModule ? (
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
          languagesDue={languagesDue}
          healthUpcoming={healthUpcomingCount}
          storageLowStock={storageLowStock}
          storageExpiring={storageExpiring}
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
    ),
    today: hasTodayContent ? (
      <div>
        <SectionHeading>Dziś i nadchodzące</SectionHeading>
        <TodaySnapshot
          tasks={todayTaskPreview}
          meals={todayMeals}
          petAgenda={petAgenda}
          vehicleAlerts={vehicleAlerts}
          languageDecks={languageDecks}
          healthUpcoming={healthUpcoming}
          hasTasksAccess={has("module.tasks")}
          hasKitchenAccess={has("module.kitchen")}
          hasPetsAccess={has("module.pets")}
          hasFlotaAccess={has("module.flota")}
          hasLanguagesAccess={has("module.languages")}
          hasHealthAccess={has("module.health")}
        />
      </div>
    ) : null,
    quickActions: (
      <div>
        <SectionHeading>Szybkie akcje</SectionHeading>
        <QuickActions permissions={userPermissions} />
      </div>
    ),
    suggestions: (
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
          languagesDue={languagesDue}
          healthUpcoming={healthUpcoming}
        />
      </div>
    ),
  };

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
            {/* UX: wejście w personalizację pulpitu jako kompaktowa ikonka w wierszu powitania
                (zamiast osobnego, pełnego wiersza — oszczędza przestrzeń pionową nad fałdą). */}
            <button
              onClick={() => setEditing((v) => !v)}
              aria-label={editing ? "Zakończ dostosowywanie pulpitu" : "Dostosuj pulpit"}
              title={editing ? "Zakończ dostosowywanie — kolejność i widoczność sekcji" : "Dostosuj pulpit — kolejność i widoczność sekcji"}
              style={{
                marginLeft: "auto",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                minWidth: 32, minHeight: 32, padding: editing ? "0 10px" : 0,
                fontSize: 12, borderRadius: 8, border: "1px solid var(--border)",
                background: editing ? "var(--bg-elevated)" : "transparent",
                color: editing ? "var(--accent-blue)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {editing ? <Check size={14} /> : <SlidersHorizontal size={14} />}
              {editing && "Gotowe"}
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, paddingLeft: 30 }}>
            {getSubtitle({
              pending: pendingItems,
              todayTasks,
              overdueTasks,
              meals: todayMeals.length,
              petCareDue,
              overdueVehicles,
              healthUpcoming: healthUpcomingCount,
              languagesDue,
            })}
          </p>
        </div>

        {/* Pending invitations banner */}
        <InvitationsBanner count={pendingInvitations} />

        {/* H1: sekcje pulpitu w kolejności użytkownika (z ukrywaniem) */}
        {order.map((key, idx) => {
          const node = sectionNodes[key];
          const isHidden = hidden.includes(key);
          if (!node && !editing) return null;
          if (isHidden && !editing) return null;
          return (
            <div key={key} style={{ position: "relative", opacity: isHidden && editing ? 0.45 : 1 }}>
              {editing && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>{SECTION_LABELS[key] ?? key}</span>
                  <button onClick={() => moveSection(key, -1)} disabled={idx === 0} title="W górę" style={ctlBtn(idx === 0)}><ChevronUp size={13} /></button>
                  <button onClick={() => moveSection(key, 1)} disabled={idx === order.length - 1} title="W dół" style={ctlBtn(idx === order.length - 1)}><ChevronDown size={13} /></button>
                  <button onClick={() => toggleHidden(key)} title={isHidden ? "Pokaż" : "Ukryj"} style={ctlBtn(false)}>{isHidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                </div>
              )}
              {node ?? (editing ? <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>(sekcja pusta — brak danych)</div> : null)}
            </div>
          );
        })}

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
          <FooterLink href="/languages" label="Nauka języków" locked={!has("module.languages")} />
          <span style={{ color: "var(--border)" }}>·</span>
          <FooterLink href="/health" label="Zdrowie" locked={!has("module.health")} />
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
  healthUpcoming: number;
  languagesDue: number;
}): string {
  const { pending, todayTasks, overdueTasks, meals, petCareDue, overdueVehicles, healthUpcoming, languagesDue } = opts;
  if (overdueTasks > 0)
    return `Masz ${overdueTasks} ${pluralizePolish(overdueTasks, "zaległe zadanie", "zaległe zadania", "zaległych zadań")} — warto je dopiąć`;
  if (overdueVehicles > 0)
    return `${overdueVehicles} ${pluralizePolish(overdueVehicles, "pojazd ma", "pojazdy mają", "pojazdów ma")} zaległy przegląd lub OC`;
  if (petCareDue > 0)
    return `${petCareDue} ${pluralizePolish(petCareDue, "obowiązek", "obowiązki", "obowiązków")} opieki nad zwierzętami na dziś`;
  if (healthUpcoming > 0)
    return `${healthUpcoming} ${pluralizePolish(healthUpcoming, "nadchodząca wizyta", "nadchodzące wizyty", "nadchodzących wizyt")} lub ${pluralizePolish(healthUpcoming, "badanie", "badania", "badań")}`;
  if (todayTasks > 0)
    return `Dzisiaj czeka ${todayTasks} ${pluralizePolish(todayTasks, "zadanie", "zadania", "zadań")}${pending > 0 ? ` i ${pending} ${pluralizePolish(pending, "pozycja", "pozycje", "pozycji")} do kupienia` : ""}`;
  if (pending > 0)
    return `${pending} ${pluralizePolish(pending, "pozycja", "pozycje", "pozycji")} do kupienia w listach`;
  if (languagesDue > 0)
    return `${languagesDue} ${pluralizePolish(languagesDue, "słówko", "słówka", "słówek")} do powtórki`;
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
