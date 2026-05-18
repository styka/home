"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Calendar, FileText, Briefcase, Settings, Sparkles, Mail, Shield, CheckSquare, Home, FlaskConical, FolderOpen, Tag } from "lucide-react";
import { cn } from "@/lib/cn";
import { TasksSideNav } from "@/components/tasks/TasksSideNav";

interface ModuleSidebarProps {
  invitationCount?: number;
  isAdmin?: boolean;
}

function NavItem({
  href,
  label,
  icon,
  pathname,
  exact = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  pathname: string;
  exact?: boolean;
}) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm")}
      style={{
        backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          e.currentTarget.style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "";
          e.currentTarget.style.color = "var(--text-secondary)";
        }
      }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function NavSubItem({
  href,
  label,
  icon,
  pathname,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  pathname: string;
}) {
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-1.5 mx-2 rounded text-xs"
      style={{
        paddingLeft: 40,
        backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "";
          e.currentTarget.style.color = "var(--text-muted)";
        }
      }}
    >
      {icon}
      {label}
    </Link>
  );
}

export function ModuleSidebar({ invitationCount = 0, isAdmin = false }: ModuleSidebarProps) {
  const pathname = usePathname();
  const isNotesActive = pathname.startsWith("/notes");
  const isTasksActive = pathname.startsWith("/tasks");

  return (
    <aside
      className="hidden md:flex flex-col h-full border-r"
      style={{
        width: "var(--sidebar-width)",
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-4 h-12 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <Sparkles size={16} style={{ color: "var(--accent-purple)" }} />
        <span className="font-semibold text-sm tracking-wide" style={{ color: "var(--text-primary)" }}>
          WorldOfMag
        </span>
      </div>

      {/* Modules */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {/* Home */}
        <NavItem href="/" label="Strona główna" icon={<Home size={18} />} pathname={pathname} exact />

        {/* Shopping */}
        <NavItem href="/shopping" label="Zakupy" icon={<ShoppingCart size={18} />} pathname={pathname} />

        {/* Notes with sub-items */}
        <NavItem href="/notes" label="Notatki" icon={<FileText size={18} />} pathname={pathname} exact />
        {isNotesActive && (
          <div className="mb-1">
            <NavSubItem href="/notes/all" label="Wszystkie" pathname={pathname} />
            <NavSubItem href="/notes/groups" label="Grupy" icon={<FolderOpen size={12} />} pathname={pathname} />
            <NavSubItem href="/notes/tags" label="Tagi" icon={<Tag size={12} />} pathname={pathname} />
          </div>
        )}

        {/* Tasks with sub-items */}
        <NavItem href="/tasks" label="Zadania" icon={<CheckSquare size={18} />} pathname={pathname} />
        {isTasksActive && (
          <div className="mb-1">
            <TasksSideNav />
          </div>
        )}

        {/* Inactive modules */}
        {[
          { label: "Calendar", icon: <Calendar size={18} />, href: "/calendar" },
          { label: "Work", icon: <Briefcase size={18} />, href: "/work" },
        ].map((mod) => (
          <div
            key={mod.href}
            title={`${mod.label} (coming soon)`}
            className="flex items-center gap-3 px-4 py-2 mx-2 rounded cursor-not-allowed"
            style={{ opacity: 0.35, color: "var(--text-secondary)" }}
          >
            {mod.icon}
            <span className="text-sm">{mod.label}</span>
          </div>
        ))}
      </nav>

      {/* Bottom: Invitations + Settings + Admin */}
      <div className="py-2 border-t" style={{ borderColor: "var(--border)" }}>
        <Link
          href="/invitations"
          className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm"
          style={{
            backgroundColor: pathname.startsWith("/invitations") ? "var(--bg-elevated)" : undefined,
            color: pathname.startsWith("/invitations") ? "var(--text-primary)" : "var(--text-secondary)",
          }}
          onMouseEnter={(e) => {
            if (!pathname.startsWith("/invitations")) {
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!pathname.startsWith("/invitations")) {
              e.currentTarget.style.backgroundColor = "";
              e.currentTarget.style.color = "var(--text-secondary)";
            }
          }}
        >
          <Mail size={18} />
          <span>Zaproszenia</span>
          {invitationCount > 0 && (
            <span
              style={{
                marginLeft: "auto",
                background: "#ef4444",
                color: "#fff",
                fontSize: 11,
                borderRadius: 999,
                padding: "1px 6px",
                minWidth: 18,
                textAlign: "center",
              }}
            >
              {invitationCount}
            </span>
          )}
        </Link>

        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm"
          style={{
            backgroundColor: pathname.startsWith("/settings") ? "var(--bg-elevated)" : undefined,
            color: pathname.startsWith("/settings") ? "var(--text-primary)" : "var(--text-secondary)",
          }}
          onMouseEnter={(e) => {
            if (!pathname.startsWith("/settings")) {
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!pathname.startsWith("/settings")) {
              e.currentTarget.style.backgroundColor = "";
              e.currentTarget.style.color = "var(--text-secondary)";
            }
          }}
        >
          <Settings size={18} />
          <span>Ustawienia</span>
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm"
            style={{
              backgroundColor: pathname === "/admin" || pathname.startsWith("/admin/config") ? "var(--bg-elevated)" : undefined,
              color: pathname === "/admin" || pathname.startsWith("/admin/config") ? "var(--accent-purple)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (!(pathname === "/admin" || pathname.startsWith("/admin/config"))) {
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--accent-purple)";
              }
            }}
            onMouseLeave={(e) => {
              if (!(pathname === "/admin" || pathname.startsWith("/admin/config"))) {
                e.currentTarget.style.backgroundColor = "";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            <Shield size={18} />
            <span>Admin</span>
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin/playground"
            className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm"
            style={{
              backgroundColor: pathname.startsWith("/admin/playground") ? "var(--bg-elevated)" : undefined,
              color: pathname.startsWith("/admin/playground") ? "var(--accent-purple)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (!pathname.startsWith("/admin/playground")) {
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--accent-purple)";
              }
            }}
            onMouseLeave={(e) => {
              if (!pathname.startsWith("/admin/playground")) {
                e.currentTarget.style.backgroundColor = "";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            <FlaskConical size={18} />
            <span>Playground</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
