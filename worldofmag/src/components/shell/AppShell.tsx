"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles, ShoppingCart, Calendar, FileText, Briefcase, Settings, Mail } from "lucide-react";
import { ModuleSidebar } from "./ModuleSidebar";

interface AppShellProps {
  children: React.ReactNode;
  invitationCount?: number;
}

const MODULES = [
  { id: "shopping", label: "Shopping", icon: <ShoppingCart size={20} />, topBarIcon: <ShoppingCart size={16} />, href: "/shopping", active: true },
  { id: "calendar", label: "Calendar", icon: <Calendar size={20} />, topBarIcon: <Calendar size={16} />, href: "/calendar", active: false },
  { id: "notes", label: "Notes", icon: <FileText size={20} />, topBarIcon: <FileText size={16} />, href: "/notes", active: false },
  { id: "work", label: "Work", icon: <Briefcase size={20} />, topBarIcon: <Briefcase size={16} />, href: "/work", active: false },
];

export function AppShell({ children, invitationCount = 0 }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const activeModule = MODULES.find((m) => pathname.startsWith(m.href));

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <div
      className="flex flex-col md:flex-row h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--bg-base)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Mobile-only top bar */}
      <div
        className="md:hidden flex items-center gap-2 px-3 h-11 border-b flex-shrink-0"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setMenuOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded flex-shrink-0"
          style={{ color: "var(--text-secondary)", position: "relative" }}
          aria-label="Otwórz menu"
        >
          <Menu size={18} />
          {invitationCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                background: "#ef4444",
                borderRadius: "50%",
                width: 8,
                height: 8,
              }}
            />
          )}
        </button>

        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          WorldOfMag
        </span>

        <span style={{ color: "var(--border)" }}>/</span>

        <div className="flex items-center gap-1.5">
          <span style={{ color: "var(--accent-purple)" }}>
            {activeModule?.topBarIcon ?? <Sparkles size={16} />}
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {activeModule?.label ?? "WorldOfMag"}
          </span>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="flex flex-col h-full w-64 border-r"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-4 h-11 border-b flex-shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} style={{ color: "var(--accent-purple)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  WorldOfMag
                </span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded"
                style={{ color: "var(--text-secondary)" }}
                aria-label="Zamknij menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* Module nav */}
            <nav className="flex-1 py-2">
              {MODULES.map((mod) => {
                const isActive = pathname.startsWith(mod.href);
                if (!mod.active) {
                  return (
                    <div
                      key={mod.id}
                      className="flex items-center gap-3 px-4 py-3 mx-2 rounded"
                      style={{ opacity: 0.35, color: "var(--text-secondary)", cursor: "not-allowed" }}
                      title={`${mod.label} (coming soon)`}
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
                    className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                    style={{
                      backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    {mod.icon}
                    <span>{mod.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Bottom: Invitations + Settings */}
            <div className="py-2 border-t" style={{ borderColor: "var(--border)" }}>
              <Link
                href="/invitations"
                className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                style={{
                  backgroundColor: pathname.startsWith("/invitations") ? "var(--bg-elevated)" : undefined,
                  color: pathname.startsWith("/invitations") ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <Mail size={20} />
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
                    }}
                  >
                    {invitationCount}
                  </span>
                )}
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                style={{
                  backgroundColor: pathname.startsWith("/settings") ? "var(--bg-elevated)" : undefined,
                  color: pathname.startsWith("/settings") ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <Settings size={20} />
                <span>Ustawienia</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <ModuleSidebar invitationCount={invitationCount} />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
