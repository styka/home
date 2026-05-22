"use client";

import Link from "next/link";
import { ShoppingCart, CheckSquare, FileText, ChefHat, type LucideIcon } from "lucide-react";

interface ActivityItem {
  module: string;
  action: string;
  createdAt: Date | string;
  metadata?: Record<string, unknown> | null;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  permissions: string[];
}

const MODULE_INFO: Record<string, { color: string; icon: LucideIcon }> = {
  shopping: { color: "var(--accent-blue)", icon: ShoppingCart },
  tasks: { color: "var(--accent-green)", icon: CheckSquare },
  notes: { color: "var(--accent-amber)", icon: FileText },
  kitchen: { color: "var(--accent-orange)", icon: ChefHat },
};

export function ActivityFeed({ activities, permissions }: ActivityFeedProps) {
  const visible = activities
    .filter((a) => permissions.includes(`module.${a.module}`) || a.module === "shopping")
    .slice(0, 10);

  if (visible.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 12,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      {visible.map((activity, idx) => (
        <ActivityRow key={idx} activity={activity} />
      ))}
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const info = MODULE_INFO[activity.module] ?? MODULE_INFO.shopping;
  const Icon = info.icon;
  const { text, href } = describeActivity(activity);

  const content = (
    <>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: `${info.color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={12} style={{ color: info.color }} />
      </div>
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: "var(--text-secondary)",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
        {relativeTime(activity.createdAt)}
      </span>
    </>
  );

  const baseStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 8px",
    borderRadius: 6,
    textDecoration: "none",
    transition: "background 0.1s",
  };

  if (href) {
    return (
      <Link
        href={href}
        style={baseStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-elevated)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {content}
      </Link>
    );
  }
  return <div style={baseStyle}>{content}</div>;
}

function describeActivity(activity: ActivityItem): { text: string; href?: string } {
  const meta = (activity.metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.name === "string" ? meta.name : null;
  const title = typeof meta.title === "string" ? meta.title : null;
  const listName = typeof meta.listName === "string" ? meta.listName : null;
  const listId = typeof meta.listId === "string" ? meta.listId : null;
  const projectId = typeof meta.projectId === "string" ? meta.projectId : null;
  const slug = typeof meta.slug === "string" ? meta.slug : null;

  const subject = name ?? title ?? "—";

  switch (`${activity.module}/${activity.action}`) {
    case "shopping/add_item":
      return {
        text: listName ? `Dodano „${subject}" do listy „${listName}"` : `Dodano „${subject}"`,
        href: listId ? `/shopping/${listId}` : "/shopping",
      };
    case "shopping/create_list":
      return { text: `Utworzono listę „${subject}"`, href: listId ? `/shopping/${listId}` : "/shopping" };
    case "shopping/complete_item":
      return { text: `Skreślono „${subject}"`, href: listId ? `/shopping/${listId}` : "/shopping" };
    case "tasks/create_task":
      return { text: `Utworzono zadanie „${subject}"`, href: projectId ? `/tasks/${projectId}` : "/tasks" };
    case "tasks/complete_task":
      return { text: `Ukończono „${subject}"`, href: projectId ? `/tasks/${projectId}` : "/tasks/all" };
    case "tasks/create_project":
      return { text: `Utworzono projekt „${subject}"`, href: "/tasks" };
    case "notes/create_note":
      return { text: `Utworzono notatkę „${subject}"`, href: "/notes/all" };
    case "notes/update_note":
      return { text: `Zaktualizowano notatkę „${subject}"`, href: "/notes/all" };
    case "kitchen/create_recipe":
      return { text: `Dodano przepis „${subject}"`, href: slug ? `/kitchen/recipes/${slug}` : "/kitchen/recipes" };
    case "kitchen/mark_cooked":
      return { text: `Ugotowano „${subject}"`, href: slug ? `/kitchen/recipes/${slug}` : "/kitchen" };
    case "kitchen/add_pantry":
      return { text: `Dodano do spiżarni „${subject}"`, href: "/kitchen/pantry" };
    default:
      return {
        text: `${moduleLabel(activity.module)}: ${activity.action.replace(/_/g, " ")}${subject !== "—" ? ` — ${subject}` : ""}`,
        href: `/${activity.module}`,
      };
  }
}

function moduleLabel(module: string): string {
  switch (module) {
    case "shopping": return "Zakupy";
    case "tasks": return "Zadania";
    case "notes": return "Notatki";
    case "kitchen": return "Kuchnia";
    default: return module;
  }
}

function relativeTime(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return "przed chwilą";
  if (diffMin < 60) return `${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} godz.`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "wczoraj";
  if (diffDays < 7) return `${diffDays} dni`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tyg.`;
  return `${Math.floor(diffDays / 30)} mies.`;
}
