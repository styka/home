"use client";

import Link from "next/link";
import {
  FlaskConical,
  ChevronRight,
  Activity,
  Bug,
  Globe,
  BarChart3,
  ShoppingCart,
  CheckSquare,
  FileText,
  ChefHat,
  Home,
  BookOpen,
  Users,
  Settings,
  Lock,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PageHeader, StatTile, SectionHeading, pageContainerStyle, pageInnerStyle, cardStyle, cardHoverHandlers } from "@/components/ui/home";
import { QA_MODULES } from "@/lib/qaModules";
import type { ModuleStats } from "@/actions/qa";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, CheckSquare, FileText, ChefHat, Home, BookOpen, Users, Settings, Lock, Shield, Sparkles, FlaskConical,
};

interface QaHomePageProps {
  stats: ModuleStats[];
  totalScenarios: number;
  totalEpics: number;
  totalStories: number;
  modulesCovered: number;
  isAdmin: boolean;
}

export function QaHomePage({
  stats,
  totalScenarios,
  totalEpics,
  totalStories,
  modulesCovered,
  isAdmin,
}: QaHomePageProps) {
  const statsByModule = new Map(stats.map((s) => [s.module, s]));

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<FlaskConical size={22} />}
          iconColor="var(--accent-red)"
          title="QA — Centrum testowania"
          subtitle={
            totalScenarios > 0
              ? `${totalScenarios} ${plural(totalScenarios, "scenariusz", "scenariusze", "scenariuszy")} w ${modulesCovered} ${plural(modulesCovered, "module", "modułach", "modułach")}`
              : "Brak scenariuszy. Zacznij od utworzenia pierwszego epica w panelu admina."
          }
          action={
            isAdmin ? (
              <Link
                href="/admin/qa"
                style={{
                  fontSize: 12,
                  padding: "7px 12px",
                  borderRadius: 6,
                  background: "var(--accent-red)",
                  color: "var(--on-accent)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Shield size={12} /> Panel admina
              </Link>
            ) : undefined
          }
        />

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
          }}
        >
          <StatTile value={totalScenarios} label="scenariuszy" color="var(--accent-red)" icon={<FlaskConical size={14} />} />
          <StatTile value={totalEpics} label="epików" color="var(--accent-purple)" />
          <StatTile value={totalStories} label="user stories" color="var(--accent-blue)" />
          <StatTile value={modulesCovered} label={`/ ${QA_MODULES.length} modułów`} color="var(--accent-green)" />
        </div>

        {/* Modules grid */}
        <div>
          <SectionHeading>Moduły</SectionHeading>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {QA_MODULES.map((mod) => {
              const s = statsByModule.get(mod.slug);
              const hasContent = (s?.scenarioCount ?? 0) > 0;
              const Icon = ICON_MAP[mod.iconName] ?? Sparkles;
              if (hasContent) {
                return (
                  <Link
                    key={mod.slug}
                    href={`/qa/${mod.slug}`}
                    style={cardStyle}
                    {...cardHoverHandlers}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: `${mod.color}22`,
                        color: mod.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{mod.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {s!.scenarioCount} scenariuszy · {s!.epicCount} {plural(s!.epicCount, "epic", "epiki", "epików")}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  </Link>
                );
              }
              return (
                <div
                  key={mod.slug}
                  style={{
                    ...cardStyle,
                    opacity: 0.4,
                    cursor: "default",
                  }}
                  title="Brak scenariuszy — wkrótce"
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "var(--bg-elevated)",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>{mod.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Brak scenariuszy</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coming soon placeholders */}
        <div>
          <SectionHeading>Wkrótce</SectionHeading>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 8,
            }}
          >
            <ComingSoonTile icon={<Activity size={16} />} title="Test runs" desc="Historia przebiegów testów" />
            <ComingSoonTile icon={<Bug size={16} />} title="Zgłaszanie bugów" desc="Tracker błędów powiązany ze scenariuszami" />
            <ComingSoonTile icon={<BarChart3 size={16} />} title="Statystyki" desc="Coverage, last run, success rate" />
            <ComingSoonTile icon={<Globe size={16} />} title="Środowiska" desc="Prod/staging/local — status, linki" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoonTile({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        border: "1px dashed var(--border)",
        background: "var(--bg-surface)",
        opacity: 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, color: "var(--text-secondary)" }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few;
  return many;
}
