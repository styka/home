"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Calendar, FileText, Briefcase, Settings, Sparkles, Mail, Shield, CheckSquare, Home, FolderOpen, Tag, Map } from "lucide-react";
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
  accentColor,
  iconColor,
  children,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  pathname: string;
  exact?: boolean;
  accentColor?: string;
  iconColor?: string;
  children?: React.ReactNode;
}) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  const activeColor = accentColor ?? "var(--text-primary)";
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm")}
      style={{
        backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
        color: isActive ? activeColor : "var(--text-secondary)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          e.currentTarget.style.color = accentColor ?? "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "";
          e.currentTarget.style.color = "var(--text-secondary)";
        }
      }}
    >
      {iconColor ? <span style={{ color: iconColor, flexShrink: 0, display: "flex" }}>{icon}</span> : icon}
      <span>{label}</span>
      {children}
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
  const isShoppingActive = pathname.startsWith("/shopping");
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
        <Sparkles size={18} style={{ color: "var(--accent-purple)" }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
          WorldOfMag
        </span>
      </div>

      {/* Modules */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {/* Home */}
        <NavItem href="/" label="Strona główna" icon={<Home size={18} />} pathname={pathname} exact />

        {/* Shopping */}
        <NavItem href="/shopping" label="Zakupy" icon={<ShoppingCart size={18} />} pathname={pathname} iconColor="var(--accent-blue)" />
        {isShoppingActive && (
          <div className="mb-1">
            <NavSubItem href="/shopping/stores" label="Mapy sklepów" icon={<Map size={12} />} pathname={pathname} />
          </div>
        )}

        {/* Notes with sub-items */}
        <NavItem href="/notes" label="Notatki" icon={<FileText size={18} />} pathname={pathname} iconColor="var(--accent-amber)" exact />
        {isNotesActive && (
          <div className="mb-1">
            <NavSubItem href="/notes/all" label="Wszystkie" pathname={pathname} />
            <NavSubItem href="/notes/groups" label="Grupy" icon={<FolderOpen size={12} />} pathname={pathname} />
            <NavSubItem href="/notes/tags" label="Tagi" icon={<Tag size={12} />} pathname={pathname} />
          </div>
        )}

        {/* Tasks with sub-items */}
        <NavItem href="/tasks" label="Zadania" icon={<CheckSquare size={18} />} pathname={pathname} iconColor="var(--accent-green)" />
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
        <NavItem href="/invitations" label="Zaproszenia" icon={<Mail size={18} />} pathname={pathname}>
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
        </NavItem>

        <NavItem href="/settings" label="Ustawienia" icon={<Settings size={18} />} pathname={pathname} />

        {isAdmin && (
          <NavItem href="/admin" label="Admin" icon={<Shield size={18} />} pathname={pathname} accentColor="var(--accent-purple)" />
        )}
      </div>
    </aside>
  );
}
