"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart, Calendar, FileText, Briefcase, Zap,
  Settings, Sparkles, Mail, Shield,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface Module {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
}

const MODULES: Module[] = [
  { id: "shopping", label: "Shopping",      icon: <ShoppingCart size={18} />, href: "/shopping", active: true },
  { id: "actions",  label: "Quick Actions", icon: <Zap size={18} />,          href: "/actions",  active: true },
  { id: "calendar", label: "Calendar",      icon: <Calendar size={18} />,     href: "/calendar", active: false },
  { id: "notes",    label: "Notes",         icon: <FileText size={18} />,     href: "/notes",    active: false },
  { id: "work",     label: "Work",          icon: <Briefcase size={18} />,    href: "/work",     active: false },
];

interface User {
  name?: string;
  image?: string;
  role?: string;
}

interface ModuleSidebarProps {
  invitationCount?: number;
  user?: User;
}

export function ModuleSidebar({ invitationCount = 0, user }: ModuleSidebarProps) {
  const pathname = usePathname();

  function navItemStyle(href: string): React.CSSProperties {
    const active = pathname.startsWith(href);
    return {
      backgroundColor: active ? "var(--bg-elevated)" : undefined,
      color: active ? "var(--text-primary)" : "var(--text-secondary)",
    };
  }

  function hoverHandlers(href: string) {
    const active = pathname.startsWith(href);
    return {
      onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          e.currentTarget.style.color = "var(--text-primary)";
        }
      },
      onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = "";
          e.currentTarget.style.color = "var(--text-secondary)";
        }
      },
    };
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
        <Sparkles size={16} style={{ color: "var(--accent-purple)" }} />
        <span className="font-semibold text-sm tracking-wide" style={{ color: "var(--text-primary)" }}>
          WorldOfMag
        </span>
      </div>

      {/* Modules */}
      <nav className="flex-1 py-2">
        {MODULES.map((mod) => {
          if (!mod.active) {
            return (
              <div
                key={mod.id}
                title={`${mod.label} (coming soon)`}
                className="flex items-center gap-3 px-4 py-2 mx-2 rounded cursor-not-allowed"
                style={{ opacity: 0.35, color: "var(--text-secondary)" }}
              >
                {mod.icon}
                <span className="text-sm">{mod.label}</span>
              </div>
            );
          }
          return (
            <Link
              key={mod.id}
              href={mod.href}
              className={cn("flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm")}
              style={navItemStyle(mod.href)}
              {...hoverHandlers(mod.href)}
            >
              {mod.icon}
              <span>{mod.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Invitations, Settings, Admin */}
      <div className="py-2 border-t" style={{ borderColor: "var(--border)" }}>
        <Link
          href="/invitations"
          className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm"
          style={navItemStyle("/invitations")}
          {...hoverHandlers("/invitations")}
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
          style={navItemStyle("/settings")}
          {...hoverHandlers("/settings")}
        >
          <Settings size={18} />
          <span>Ustawienia</span>
        </Link>

        {user?.role === "ADMIN" && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm"
            style={navItemStyle("/admin")}
            {...hoverHandlers("/admin")}
          >
            <Shield size={18} />
            <span>Admin</span>
          </Link>
        )}
      </div>

      {/* User avatar */}
      {user && (
        <div
          className="flex items-center gap-2 px-4 py-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--bg-elevated)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-muted)", fontSize: 12,
              }}
            >
              {(user.name ?? "?")[0].toUpperCase()}
            </div>
          )}
          <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {user.name ?? "Użytkownik"}
          </span>
        </div>
      )}
    </aside>
  );
}
