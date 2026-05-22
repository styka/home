"use client";

import Link from "next/link";
import { Shield, Users, BookOpen, ChevronRight, Settings, Code, FileText } from "lucide-react";

interface AdminDashboardWidgetProps {
  userCount: number;
  teamCount: number;
  reportCount: number;
}

export function AdminDashboardWidget({ userCount, teamCount, reportCount }: AdminDashboardWidgetProps) {
  const buildBranch = process.env.NEXT_PUBLIC_BUILD_BRANCH;
  const buildSha = process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA;
  const buildMsg = process.env.NEXT_PUBLIC_BUILD_COMMIT_MESSAGE;
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 10,
        border: "1px solid rgba(168,85,247,0.35)",
        background: "rgba(168,85,247,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent-purple)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <Shield size={14} />
          Panel administratora
        </h3>
        <Link
          href="/admin"
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          Otwórz <ChevronRight size={11} />
        </Link>
      </div>

      {/* Counters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
        <AdminCounter icon={<Users size={14} />} label="Użytkowników" value={userCount} />
        <AdminCounter icon={<Shield size={14} />} label="Zespołów" value={teamCount} />
        <AdminCounter icon={<BookOpen size={14} />} label="Raportów" value={reportCount} />
      </div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <AdminLink href="/admin/access" icon={<Shield size={13} />} label="Kontrola dostępu" />
        <AdminLink href="/admin/config" icon={<Settings size={13} />} label="Konfiguracja" />
        <AdminLink href="/admin/reports" icon={<FileText size={13} />} label="Raporty" />
        <AdminLink href="/admin/architecture" icon={<Code size={13} />} label="Architektura" />
      </div>

      {/* Build info */}
      {(buildBranch || buildSha) && (
        <div
          style={{
            paddingTop: 8,
            borderTop: "1px solid rgba(168,85,247,0.2)",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          {buildBranch && (
            <span>
              <span style={{ color: "var(--text-secondary)", marginRight: 4 }}>branch:</span>
              {buildBranch}
            </span>
          )}
          {buildSha && (
            <span>
              <span style={{ color: "var(--text-secondary)", marginRight: 4 }}>commit:</span>
              <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10 }}>
                {buildSha.slice(0, 7)}
              </code>
              {buildMsg && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  „{truncate(buildMsg, 60)}"
                </span>
              )}
            </span>
          )}
          {buildDate && (
            <span>
              <span style={{ color: "var(--text-secondary)", marginRight: 4 }}>build:</span>
              {buildDate}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function AdminCounter({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-purple)" }}>
        {icon}
        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{value}</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{label}</p>
    </div>
  );
}

function AdminLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
        fontSize: 12,
        textDecoration: "none",
        transition: "background 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
        e.currentTarget.style.borderColor = "rgba(168,85,247,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <span style={{ color: "var(--accent-purple)", display: "flex" }}>{icon}</span>
      {label}
    </Link>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}
