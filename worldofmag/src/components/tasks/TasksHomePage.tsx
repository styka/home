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
  Users,
} from "lucide-react";
import { createTaskProject } from "@/actions/taskProjects";
import { PageHeader, StatTile, SectionHeading, ManagementGrid, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import type { TaskProject, TaskPriority } from "@/types";
import { TASK_PRIORITY_COLORS } from "@/types";

interface TodayPreviewItem {
  id: string;
  title: string;
  priority: TaskPriority;
  projectId: string | null;
  projectName: string | null;
  projectEmoji: string | null;
}

interface TasksHomePageProps {
  projects: TaskProject[];
  todayCount: number;
  upcomingCount: number;
  overdueCount: number;
  todayPreview: TodayPreviewItem[];
}

export function TasksHomePage({
  projects,
  todayCount,
  upcomingCount,
  overdueCount,
  todayPreview,
}: TasksHomePageProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();

  const inbox = projects.find((p) => p.isInbox);
  const regularProjects = projects.filter((p) => !p.isInbox);
  const totalOpenCount = todayCount + upcomingCount + overdueCount;

  const subtitle =
    overdueCount > 0
      ? `${overdueCount} ${pluralizePolish(overdueCount, "zaległe", "zaległe", "zaległych")} zadanie · ${todayCount} na dziś`
      : todayCount > 0
      ? `${todayCount} ${pluralizePolish(todayCount, "zadanie", "zadania", "zadań")} na dziś`
      : upcomingCount > 0
      ? `${upcomingCount} ${pluralizePolish(upcomingCount, "zadanie", "zadania", "zadań")} nadchodzących`
      : regularProjects.length > 0
      ? `${regularProjects.length} ${pluralizePolish(regularProjects.length, "projekt", "projekty", "projektów")}`
      : "Zacznij od utworzenia projektu";

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
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<CheckSquare size={22} />}
          iconColor="var(--accent-green)"
          title="Zadania"
          subtitle={subtitle}
          action={
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
          }
        />

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
                color: "var(--on-accent)",
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

        {/* Stats — replaces "Widoki", each tile is clickable */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <StatTile
            value={todayCount}
            label="Dziś"
            color={todayCount > 0 ? "var(--accent-blue)" : "var(--text-muted)"}
            icon={<CalendarClock size={14} />}
            href="/tasks/today"
          />
          <StatTile
            value={overdueCount}
            label="Zaległe"
            color={overdueCount > 0 ? "var(--accent-red)" : "var(--text-muted)"}
            icon={<AlertCircle size={14} />}
            href="/tasks/overdue"
            emphasized={overdueCount > 0}
          />
          <StatTile
            value={upcomingCount}
            label="Nadchodzące"
            color={upcomingCount > 0 ? "var(--accent-amber)" : "var(--text-muted)"}
            icon={<CalendarDays size={14} />}
            href="/tasks/upcoming"
          />
          <StatTile
            value={totalOpenCount}
            label="Wszystkie otwarte"
            color="var(--text-secondary)"
            icon={<LayoutList size={14} />}
            href="/tasks/all"
          />
        </div>

        {/* Today preview */}
        {todayPreview.length > 0 && (
          <div>
            <SectionHeading
              action={
                <Link
                  href="/tasks/today"
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  Zobacz wszystkie <ChevronRight size={11} />
                </Link>
              }
            >
              Na dziś
            </SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {todayPreview.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.projectId ?? "today"}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    textDecoration: "none",
                    transition: "background 0.1s, border-color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-elevated)";
                    e.currentTarget.style.borderColor = "var(--border-focus)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--bg-surface)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: TASK_PRIORITY_COLORS[task.priority],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {task.title}
                  </span>
                  {task.projectName && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                      {task.projectEmoji && <span>{task.projectEmoji}</span>}
                      {task.projectName}
                    </span>
                  )}
                  <ChevronRight size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Inbox */}
        {inbox && (
          <div>
            <SectionHeading>Skrzynka</SectionHeading>
            <ProjectCard project={inbox} />
          </div>
        )}

        {/* Projects */}
        <div>
          <SectionHeading>Projekty</SectionHeading>
          {regularProjects.length === 0 ? (
            <EmptyState
              icon={<CheckSquare size={28} />}
              message="Brak projektów"
              hint="Stwórz projekt, żeby grupować zadania tematycznie"
              cta={{ label: "+ Nowy projekt", onClick: () => setIsAdding(true), color: "var(--accent-green)" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {regularProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>

        {/* Management */}
        <div>
          <SectionHeading>Zarządzanie</SectionHeading>
          <ManagementGrid
            items={[
              { href: "/tasks/tags", icon: <Tag size={16} />, label: "Tagi", color: "var(--accent-green)" },
              { href: "/tasks/all", icon: <LayoutList size={16} />, label: "Wszystkie zadania", color: "var(--accent-green)" },
            ]}
          />
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
        transition: "background 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
        e.currentTarget.style.borderColor = "var(--border-focus)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {project.isInbox ? (
        <Inbox size={16} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
      ) : (
        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{project.emoji}</span>
      )}
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {project.name}
      </span>
      {project.ownerTeamId && (
        <span
          style={{
            fontSize: 11,
            padding: "1px 5px",
            borderRadius: 10,
            backgroundColor: "rgba(168,85,247,0.15)",
            color: "var(--accent-purple)",
            display: "flex",
            alignItems: "center",
            gap: 3,
            flexShrink: 0,
          }}
        >
          <Users size={10} />
          Team
        </span>
      )}
      {project._count?.tasks != null && project._count.tasks > 0 && (
        <span
          style={{
            fontSize: 12,
            color: "var(--accent-green)",
            background: "rgba(34,197,94,0.1)",
            padding: "2px 8px",
            borderRadius: 10,
            border: "1px solid rgba(34,197,94,0.2)",
            fontWeight: 600,
          }}
        >
          {project._count.tasks}
        </span>
      )}
      <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
    </Link>
  );
}

function pluralizePolish(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few;
  return many;
}
