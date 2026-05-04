"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Calendar, FileText, Briefcase, Settings, Sparkles, Mail, Shield } from "lucide-react";
import { cn } from "@/lib/cn";

interface Module {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
}

const MODULES: Module[] = [
  { id: "shopping", label: "Shopping", icon: <ShoppingCart size={18} />, href: "/shopping", active: true },
  { id: "calendar", label: "Calendar", icon: <Calendar size={18} />, href: "/calendar", active: false },
  { id: "notes", label: "Notes", icon: <FileText size={18} />, href: "/notes", active: false },
  { id: "work", label: "Work", icon: <Briefcase size={18} />, href: "/work", active: false },
];

interface ModuleSidebarProps {
  invitationCount?: number;
  isAdmin?: boolean;
}

export function ModuleSidebar({ invitationCount = 0, isAdmin = false }: ModuleSidebarProps) {
  const pathname = usePathname();

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
        <span
          className="font-semibold text-sm tracking-wide"
          style={{ color: "var(--text-primary)" }}
        >
          WorldOfMag
        </span>
      </div>

      {/* Modules */}
      <nav className="flex-1 py-2">
        {MODULES.map((mod) => {
          const isCurrentPath = pathname.startsWith(mod.href);
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
              className={cn(
                "flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm",
                isCurrentPath ? "text-primary" : "hover:text-primary"
              )}
              style={{
                backgroundColor: isCurrentPath ? "var(--bg-elevated)" : undefined,
                color: isCurrentPath ? "var(--text-primary)" : "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                if (!isCurrentPath) {
                  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrentPath) {
                  e.currentTarget.style.backgroundColor = "";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              {mod.icon}
              <span>{mod.label}</span>
            </Link>
          );
        })}
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
              backgroundColor: pathname.startsWith("/admin") ? "var(--bg-elevated)" : undefined,
              color: pathname.startsWith("/admin") ? "var(--accent-purple)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (!pathname.startsWith("/admin")) {
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--accent-purple)";
              }
            }}
            onMouseLeave={(e) => {
              if (!pathname.startsWith("/admin")) {
                e.currentTarget.style.backgroundColor = "";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            <Shield size={18} />
            <span>Admin</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
