"use client";

import Link from "next/link";
import { FlaskConical, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { getModuleInfo } from "@/lib/qaModules";
import { getScenarioTypeLabel, getScenarioTypeColor, getPriorityColor, getPriorityLabel } from "@/lib/qaConstants";
import { MARKDOWN_STYLES } from "@/lib/markdown";
import { pageContainerStyle } from "@/components/ui/home";
import type { ScenarioWithContext } from "@/actions/qa";

interface ScenarioPageProps {
  scenario: ScenarioWithContext;
  contentHtml: string;
}

export function ScenarioPage({ scenario, contentHtml }: ScenarioPageProps) {
  const moduleInfo = getModuleInfo(scenario.story.epic.module);
  const typeColor = getScenarioTypeColor(scenario.type);
  const priorityColor = getPriorityColor(scenario.priority);

  const idx = scenario.siblings.findIndex((s) => s.slug === scenario.slug);
  const prev = idx > 0 ? scenario.siblings[idx - 1] : null;
  const next = idx >= 0 && idx < scenario.siblings.length - 1 ? scenario.siblings[idx + 1] : null;

  return (
    <div style={pageContainerStyle}>
      <style>{MARKDOWN_STYLES}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Breadcrumb */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-muted)",
            flexWrap: "wrap",
          }}
        >
          <Link href="/qa" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            QA
          </Link>
          <span>›</span>
          <Link
            href={`/qa/${scenario.story.epic.module}`}
            style={{ color: moduleInfo.color, textDecoration: "none" }}
          >
            {moduleInfo.label}
          </Link>
          <span>›</span>
          <span>{scenario.story.epic.title}</span>
          <span>›</span>
          <span>{scenario.story.title}</span>
        </nav>

        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "16px 18px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <FlaskConical size={20} style={{ color: typeColor, flexShrink: 0 }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0, flex: 1, minWidth: 0 }}>
              {scenario.title}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Pill color={typeColor}>{getScenarioTypeLabel(scenario.type)}</Pill>
            <Pill color={priorityColor}>{getPriorityLabel(scenario.priority)}</Pill>
            <Pill color={moduleInfo.color} subtle>
              {moduleInfo.label}
            </Pill>
          </div>
        </div>

        {/* Markdown content */}
        <div
          className="md-content"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
          style={{
            padding: "8px 4px",
          }}
        />

        {/* Prev/Next navigation */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          {prev ? (
            <Link
              href={`/qa/scenariusz/${prev.slug}`}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                textDecoration: "none",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ChevronLeft size={14} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Poprzedni
                </div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {prev.title}
                </div>
              </div>
            </Link>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          {next ? (
            <Link
              href={`/qa/scenariusz/${next.slug}`}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                textDecoration: "none",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                textAlign: "right",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Następny
                </div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {next.title}
                </div>
              </div>
              <ChevronRight size={14} />
            </Link>
          ) : (
            <div style={{ flex: 1 }} />
          )}
        </div>

        <Link
          href={`/qa/${scenario.story.epic.module}`}
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            paddingBottom: 24,
          }}
        >
          <ArrowLeft size={12} /> Wróć do listy modułu
        </Link>
      </div>
    </div>
  );
}

function Pill({ color, children, subtle }: { color: string; children: React.ReactNode; subtle?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 4,
        background: subtle ? "transparent" : `${color}22`,
        color,
        border: subtle ? `1px solid ${color}55` : "none",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}
