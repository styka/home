"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Calendar, FileText, Briefcase, Settings, Sparkles, Mail, Shield, CheckSquare, Home, FolderOpen, Tag, Lock, BookOpen, ChefHat, Package, BookMarked, CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import { TasksSideNav } from "@/components/tasks/TasksSideNav";
import { ShoppingSideNav } from "@/components/shopping/ShoppingSideNav";
import { isPathLocked } from "@/lib/permissions";

interface ModuleSidebarProps {
  invitationCount?: number;
  isAdmin?: boolean;
  userRoles?: string[];
  userPermissions?: string[];
}

function NavItem({
  href,
  label,
  icon,
  pathname,
  exact = false,
  accentColor,
  iconColor,
  locked,
  children,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  pathname: string;
  exact?: boolean;
  accentColor?: string;
  iconColor?: string;
  locked?: boolean;
  children?: React.ReactNode;
}) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  const activeColor = accentColor ?? "var(--text-primary)";

  if (locked) {
    return (
      <div
        className={cn("flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm")}
        style={{ opacity: 0.35, cursor: "not-allowed", color: "var(--text-secondary)" }}
        title="Niedostępne dla Twojej roli"
      >
        {iconColor ? <span style={{ color: iconColor, flexShrink: 0, display: "flex" }}>{icon}</span> : icon}
        <span>{label}</span>
        <Lock size={10} style={{ marginLeft: "auto", color: "var(--text-muted)" }} />
      </div>
    );
  }

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
  locked,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  pathname: string;
  locked?: boolean;
}) {
  const isActive = pathname === href || pathname.startsWith(href + "/");

  if (locked) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 mx-2 rounded text-xs" style={{ paddingLeft: 40, opacity: 0.35, cursor: "not-allowed", color: "var(--text-muted)" }}>
        {icon}{label}
      </div>
    );
  }

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
      {icon}{label}
    </Link>
  );
}

export function ModuleSidebar({ invitationCount = 0, isAdmin = false, userRoles = [], userPermissions = [] }: ModuleSidebarProps) {
  const pathname = usePathname();
  const isShoppingActive = pathname.startsWith("/shopping");
  const isNotesActive = pathname.startsWith("/notes");
  const isTasksActive = pathname.startsWith("/tasks");
  const isKitchenActive = pathname.startsWith("/kitchen");

  function isLocked(href: string): boolean {
    return isPathLocked(userPermissions, href);
  }

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
        <NavItem href="/" label="Strona główna" icon={<Home size={18} />} pathname={pathname} exact locked={isLocked("/")} />

        {/* Shopping */}
        <NavItem href="/shopping" label="Zakupy" icon={<ShoppingCart size={18} />} pathname={pathname} iconColor="var(--accent-blue)" locked={isLocked("/shopping")} />
        {isShoppingActive && !isLocked("/shopping") && (
          <div className="mb-1">
            <ShoppingSideNav />
            {pathname.startsWith("/shopping/icons") && (
              <NavSubItem href="/shopping/icons/categories" label="Przypisania" pathname={pathname} />
            )}
          </div>
        )}

        {/* Notes with sub-items */}
        <NavItem href="/notes" label="Notatki" icon={<FileText size={18} />} pathname={pathname} iconColor="var(--accent-amber)" exact locked={isLocked("/notes")} />
        {isNotesActive && (
          <div className="mb-1">
            <NavSubItem href="/notes/all" label="Wszystkie" pathname={pathname} locked={isLocked("/notes")} />
            <NavSubItem href="/notes/groups" label="Grupy" icon={<FolderOpen size={12} />} pathname={pathname} locked={isLocked("/notes")} />
            <NavSubItem href="/notes/tags" label="Tagi" icon={<Tag size={12} />} pathname={pathname} locked={isLocked("/notes")} />
          </div>
        )}

        {/* Tasks with sub-items */}
        <NavItem href="/tasks" label="Zadania" icon={<CheckSquare size={18} />} pathname={pathname} iconColor="var(--accent-green)" locked={isLocked("/tasks")} />
        {isTasksActive && (
          <div className="mb-1">
            <TasksSideNav />
          </div>
        )}

        {/* Kitchen with sub-items */}
        <NavItem href="/kitchen" label="Kuchnia" icon={<ChefHat size={18} />} pathname={pathname} iconColor="var(--accent-orange)" locked={isLocked("/kitchen")} />
        {isKitchenActive && (
          <div className="mb-1">
            <NavSubItem href="/kitchen/recipes" label="Przepisy" icon={<BookMarked size={12} />} pathname={pathname} locked={isLocked("/kitchen")} />
            <NavSubItem href="/kitchen/plan" label="Plan" icon={<CalendarDays size={12} />} pathname={pathname} locked={isLocked("/kitchen")} />
            <NavSubItem href="/kitchen/pantry" label="Spiżarnia" icon={<Package size={12} />} pathname={pathname} locked={isLocked("/kitchen")} />
            <NavSubItem href="/kitchen/cookbooks" label="Książki" icon={<BookOpen size={12} />} pathname={pathname} locked={isLocked("/kitchen")} />
          </div>
        )}

        {/* Reports — dostępne dla wszystkich */}
        <NavItem href="/reports" label="Raporty" icon={<BookOpen size={18} />} pathname={pathname} iconColor="var(--accent-purple)" locked={isLocked("/reports")} />

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
        <NavItem href="/invitations" label="Zaproszenia" icon={<Mail size={18} />} pathname={pathname} locked={isLocked("/invitations")}>
          {invitationCount > 0 && !isLocked("/invitations") && (
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

        <NavItem href="/settings" label="Ustawienia" icon={<Settings size={18} />} pathname={pathname} locked={isLocked("/settings")} />

        {isAdmin && (
          <NavItem href="/admin" label="Admin" icon={<Shield size={18} />} pathname={pathname} accentColor="var(--accent-purple)" />
        )}
      </div>
    </aside>
  );
}
