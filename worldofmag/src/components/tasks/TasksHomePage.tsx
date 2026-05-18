"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Plus,
  ChevronRight,
  Inbox,
  CalendarClock,
  CalendarDays,
  AlertCircle,
  LayoutList,
  Loader2,
  Tag,
} from "lucide-react";
import { createTaskProject } from "@/actions/taskProjects";
import type { TaskProject } from "@/types";

interface TasksHomePageProps {
  projects: TaskProject[];
  todayCount: number;
  upcomingCount: number;
  overdueCount: number;
}

export function TasksHomePage({
  projects,
  todayCount,
  upcomingCount,
  overdueCount,
}: TasksHomePageProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();

  const inbox = projects.find((p) => p.isInbox);
  const regularProjects = projects.filter((p) => !p.isInbox);

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      await createTaskProject(name);
      setNewName("");
      setIsAdding(false);
    });
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        backgroundColor: "var(--bg-base)",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <CheckSquare size={22} style={{ color: "var(--accent-green)" }} />
            Zadania
          </h1>
          <button
            onClick={() => setIsAdding((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <Plus size={13} />
            Nowy projekt
          </button>
        </div>

        {/* New project form */}
        {isAdding && (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setIsAdding(false);
              }}
              placeholder="Nazwa projektu…"
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-focus)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={handleCreate}
              disabled={isPending || !newName.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent-green)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              Utwórz
            </button>
            <button
              onClick={() => setIsAdding(false)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Anuluj
            </button>
          </div>
        )}

        {/* Virtual views */}
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Widoki
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <VirtualViewCard
              href="/tasks/today"
              icon={<CalendarClock size={16} />}
              label="Dziś"
              count={todayCount}
              accentColor="var(--accent-blue)"
            />
            <VirtualViewCard
              href="/tasks/upcoming"
              icon={<CalendarDays size={16} />}
              label="Nadchodzące"
              count={upcomingCount}
              accentColor="var(--accent-amber)"
            />
            <VirtualViewCard
              href="/tasks/overdue"
              icon={<AlertCircle size={16} />}
              label="Zaległe"
              count={overdueCount}
              accentColor="var(--accent-red)"
            />
            <VirtualViewCard
              href="/tasks/all"
              icon={<LayoutList size={16} />}
              label="Wszystkie"
              count={null}
              accentColor="var(--text-secondary)"
            />
          </div>
        </div>

        {/* Inbox */}
        {inbox && (
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Skrzynka
            </p>
            <ProjectCard project={inbox} />
          </div>
        )}

        {/* Projects */}
        {regularProjects.length > 0 && (
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Projekty
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {regularProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        )}

        {/* Management */}
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Zarządzanie
          </p>
          <Link
            href="/tasks/tags"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              textDecoration: "none",
              transition: "background 0.1s",
            }}
          >
            <Tag size={15} style={{ color: "var(--accent-purple)" }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
              Tagi
            </span>
            <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />
          </Link>
        </div>

      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: TaskProject }) {
  return (
    <Link
      href={`/tasks/${project.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        textDecoration: "none",
        transition: "background 0.1s",
      }}
    >
      {project.isInbox ? (
        <Inbox size={16} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
      ) : (
        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{project.emoji}</span>
      )}
      <span
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        {project.name}
      </span>
      {project._count?.tasks != null && project._count.tasks > 0 && (
        <span
          style={{
            fontSize: 12,
            color: "var(--accent-green)",
            background: "rgba(34,197,94,0.1)",
            padding: "2px 8px",
            borderRadius: 10,
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          {project._count.tasks}
        </span>
      )}
      <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
    </Link>
  );
}

function VirtualViewCard({
  href,
  icon,
  label,
  count,
  accentColor,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count: number | null;
  accentColor: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        textDecoration: "none",
        transition: "background 0.1s",
      }}
    >
      <span style={{ color: accentColor, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
        {label}
      </span>
      {count != null && count > 0 && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: accentColor,
          }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
