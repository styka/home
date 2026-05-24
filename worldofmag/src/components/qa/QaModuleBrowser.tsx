"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, FlaskConical, FileText, Layers, ShoppingCart, CheckSquare, ChefHat, Home, BookOpen, Users, Settings, Lock, Shield, Sparkles, type LucideIcon } from "lucide-react";
import { PageHeader, SectionHeading, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { getModuleInfo } from "@/lib/qaModules";
import { getScenarioTypeLabel, getScenarioTypeColor, getPriorityColor } from "@/lib/qaConstants";
import type { ModuleTree } from "@/actions/qa";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, CheckSquare, FileText, ChefHat, Home, BookOpen, Users, Settings, Lock, Shield, Sparkles, FlaskConical,
};

interface QaModuleBrowserProps {
  module: string;
  tree: ModuleTree[];
}

export function QaModuleBrowser({ module, tree }: QaModuleBrowserProps) {
  const info = getModuleInfo(module);
  const Icon = ICON_MAP[info.iconName] ?? Sparkles;

  const totalScenarios = tree.reduce(
    (sum, ep) => sum + ep.userStories.reduce((s, st) => s + st.scenarios.length, 0),
    0,
  );

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: -8 }}>
          <Link href="/qa" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
            ← QA
          </Link>
        </div>

        <PageHeader
          icon={<Icon size={22} />}
          iconColor={info.color}
          title={info.label}
          subtitle={`${tree.length} ${plural(tree.length, "epic", "epiki", "epików")} · ${totalScenarios} ${plural(totalScenarios, "scenariusz", "scenariusze", "scenariuszy")}`}
        />

        {tree.length === 0 ? (
          <EmptyState
            icon={<Layers size={20} />}
            message="Brak epików dla tego modułu"
            hint="Admin może utworzyć pierwszy epic w /admin/qa"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tree.map((epic) => (
              <EpicCard key={epic.id} epic={epic} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EpicCard({ epic }: { epic: ModuleTree }) {
  const [open, setOpen] = useState(true);
  const scenarioCount = epic.userStories.reduce((s, st) => s + st.scenarios.length, 0);

  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          background: "var(--bg-elevated)",
          border: "none",
          cursor: "pointer",
          color: "var(--text-primary)",
          textAlign: "left",
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Layers size={14} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>{epic.title}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {epic.userStories.length} stories · {scenarioCount} scenariuszy
        </span>
      </button>
      {open && (
        <div style={{ padding: "8px 8px 12px" }}>
          {epic.description && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 12px 12px", lineHeight: 1.5 }}>
              {epic.description}
            </p>
          )}
          {epic.userStories.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 12px" }}>Brak user stories</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {epic.userStories.map((story) => (
                <StoryRow key={story.id} story={story} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StoryRow({ story }: { story: ModuleTree["userStories"][number] }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-secondary)",
          textAlign: "left",
        }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <FileText size={12} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          {story.title}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {story.scenarios.length} scenariuszy
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 8px 8px 28px", display: "flex", flexDirection: "column", gap: 2 }}>
          {story.description && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px", lineHeight: 1.4 }}>
              {story.description}
            </p>
          )}
          {story.scenarios.length === 0 ? (
            <p style={{ fontSize: 11, color: "var(--text-muted)", padding: 4 }}>Brak scenariuszy</p>
          ) : (
            story.scenarios.map((sc) => <ScenarioLink key={sc.id} scenario={sc} />)
          )}
        </div>
      )}
    </div>
  );
}

function ScenarioLink({ scenario }: { scenario: ModuleTree["userStories"][number]["scenarios"][number] }) {
  const typeColor = getScenarioTypeColor(scenario.type);
  const priorityColor = getPriorityColor(scenario.priority);
  return (
    <Link
      href={`/qa/scenariusz/${scenario.slug}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 4,
        textDecoration: "none",
        background: "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <FlaskConical size={11} style={{ color: typeColor, flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12,
          color: "var(--text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {scenario.title}
      </span>
      <Badge color={typeColor}>{getScenarioTypeLabel(scenario.type)}</Badge>
      <Badge color={priorityColor}>{scenario.priority}</Badge>
    </Link>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: "1px 5px",
        borderRadius: 3,
        background: `${color}22`,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few;
  return many;
}
